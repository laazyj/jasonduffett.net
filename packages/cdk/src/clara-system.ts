import { Duration, type Stack } from "aws-cdk-lib";
import {
  FunctionCode,
  FunctionEventType,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Source } from "aws-cdk-lib/aws-s3-deployment";

import { compose, ref } from "@composurecdk/core";
import { createCertificateBuilder, type CertificateBuilderResult } from "@composurecdk/acm";
import {
  cloudfrontAliasTarget,
  createHostedZoneBuilder,
  type HostedZoneBuilderResult,
} from "@composurecdk/route53";
import { ALIAS, type RecordSpec, zoneRecords } from "@composurecdk/route53/zone";
import {
  createBucketBuilder,
  createBucketDeploymentBuilder,
  type BucketBuilderResult,
} from "@composurecdk/s3";
import {
  createDistributionBuilder,
  type DistributionBuilderResult,
} from "@composurecdk/cloudfront";
import { outputs } from "@composurecdk/cloudformation";

/**
 * Viewer-request CloudFront Function for the Clara subsite. Unlike the apex
 * site there is no `www`→apex canonicalisation and no legacy redirect map —
 * the subdomain is brand new — so this only does the pretty-URL rewrite that
 * Eleventy's directory-style output needs (`/privacy/` → `/privacy/index.html`).
 * `defaultRootObject` already covers the bare `/`.
 */
const PRETTY_URL_FUNCTION_CODE = `
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri.endsWith("/")) {
    req.uri = uri + "index.html";
  } else if (uri.lastIndexOf(".") < uri.lastIndexOf("/")) {
    req.uri = uri + "/index.html";
  }
  return req;
}
`.trim();

export interface ClaraSubsiteStacks {
  /** Parent zone's stack. The delegated child zone + the NS delegation record both live here. */
  readonly dnsStack: Stack;
  /** ACM certificate. Must be `us-east-1` for CloudFront-attached certificates. */
  readonly certStack: Stack;
  /** S3 bucket, CloudFront distribution, bucket deployment, alias records. */
  readonly siteStack: Stack;
}

export interface ClaraSubsiteOptions {
  /** Fully-qualified subdomain — e.g. `clara.jasonduffett.net`. */
  readonly subdomain: string;
  /** Directory whose contents are uploaded to the subsite bucket. */
  readonly siteContentPath: string;
}

/**
 * Self-contained subsite for `clara.jasonduffett.net`. Mirrors the apex
 * `createSystem()` wiring (see `system.ts` for the full `compose()` pattern
 * walkthrough) but trimmed to a single static page: own hosted zone, own ACM
 * cert, own bucket + CloudFront distribution.
 *
 * The build result exposes the child `zone`, which the composition root
 * (`app.ts`) uses to delegate the subdomain from the parent zone — keeping the
 * one parent↔child reference at the call site rather than inside this module,
 * so lifting the subsite into its own repo later is a call-site edit. Recommended
 * alarms are suppressed to keep the subsite lean — the account-wide budget alarm
 * already covers its cost.
 */
export function createClaraSubsite(stacks: ClaraSubsiteStacks, options: ClaraSubsiteOptions) {
  const { dnsStack, certStack, siteStack } = stacks;
  const { subdomain, siteContentPath } = options;

  const zone = ref<HostedZoneBuilderResult>("zone").get("hostedZone");
  const bucket = ref<BucketBuilderResult>("bucket").get("bucket");
  const distribution = ref<DistributionBuilderResult>("cdn").get("distribution");
  const certificate = ref<CertificateBuilderResult>("cert").get("certificate");

  const cdnAliasTarget = cloudfrontAliasTarget(distribution);
  const aliasSpecs: readonly RecordSpec[] = [
    ALIAS("@", cdnAliasTarget),
    ALIAS("@", cdnAliasTarget, { ipv6: true }),
  ];

  return compose(
    {
      zone: createHostedZoneBuilder().zoneName(subdomain).queryLogging(false),
      // Routed to siteStack (not dnsStack) so the stack graph stays acyclic —
      // these depend on both the zone and the distribution.
      aliasRecords: zoneRecords(aliasSpecs).zone(zone),

      cert: createCertificateBuilder()
        .domainName(subdomain)
        .validationZone(zone)
        .recommendedAlarms(false),

      bucket: createBucketBuilder().lifecycleRules([
        { noncurrentVersionExpiration: Duration.days(30) },
      ]),
      cdn: createDistributionBuilder()
        .comment(subdomain)
        .domainNames([subdomain])
        .certificate(certificate)
        .defaultRootObject("index.html")
        .priceClass(PriceClass.PRICE_CLASS_100)
        .origin(bucket.map((b) => S3BucketOrigin.withOriginAccessControl(b)))
        .defaultBehavior({
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functions: [
            {
              eventType: FunctionEventType.VIEWER_REQUEST,
              functionName: `${siteStack.stackName}-rewrite`,
              code: FunctionCode.fromInline(PRETTY_URL_FUNCTION_CODE),
              comment: "pretty-URL → /index.html rewrite",
            },
          ],
        })
        .errorResponses([
          {
            httpStatus: 403,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: Duration.seconds(60),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: Duration.seconds(60),
          },
        ])
        .recommendedAlarms(false),

      deploy: createBucketDeploymentBuilder()
        .sources([Source.asset(siteContentPath)])
        .destinationBucket(bucket)
        .distribution(distribution)
        .distributionPaths(["/*"])
        .prune(true),
    },
    {
      zone: [],
      aliasRecords: ["zone", "cdn"],
      cert: ["zone"],
      bucket: [],
      cdn: ["bucket", "cert"],
      deploy: ["bucket", "cdn"],
    },
  )
    .withStacks({
      zone: dnsStack,
      aliasRecords: siteStack,
      cert: certStack,
      bucket: siteStack,
      cdn: siteStack,
      deploy: siteStack,
    })
    .afterBuild(
      outputs({
        ClaraDistributionDomainName: {
          value: distribution.map((d) => d.distributionDomainName),
          description:
            "CloudFront distribution domain for the Clara subsite (manual CNAME checks).",
          scope: "cdn",
        },
      }),
    );
}
