import { Duration, Fn, RemovalPolicy, type Stack } from "aws-cdk-lib";
import {
  FunctionCode,
  FunctionEventType,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Source } from "aws-cdk-lib/aws-s3-deployment";

import { compose, ref } from "@composurecdk/core";
import { createCertificateBuilder, type CertificateBuilderResult } from "@composurecdk/acm";
import { alarmActionsPolicy } from "@composurecdk/cloudwatch";
import { createHostedZoneBuilder, type HostedZoneBuilderResult } from "@composurecdk/route53";
import { zoneRecords } from "@composurecdk/route53/zone";
import {
  createBucketBuilder,
  createBucketDeploymentBuilder,
  type BucketBuilderResult,
} from "@composurecdk/s3";
import {
  createDistributionBuilder,
  type DistributionBuilderResult,
} from "@composurecdk/cloudfront";
import { createTopicBuilder, type TopicBuilderResult } from "@composurecdk/sns";
import { outputs } from "@composurecdk/cloudformation";

import { buildRedirectFunctionCode } from "./redirect-function.js";
import { DOMAIN, WWW, ZONE_RECORDS } from "./zone-records.js";

export interface SystemStacks {
  /** Route 53 hosted zone + records. Region is cosmetic — Route 53 is global. */
  readonly dnsStack: Stack;
  /** ACM certificate. Must be `us-east-1` for CloudFront-attached certificates. */
  readonly certStack: Stack;
  /** S3 bucket, CloudFront distribution, bucket deployment, alarms. */
  readonly siteStack: Stack;
}

const topicArnOutput = (refName: "certAlerts" | "siteAlerts", role: string) => ({
  value: ref<TopicBuilderResult>(refName)
    .get("topic")
    .map((t) => t.topicArn),
  description: `Subscribe here to receive ${role}.`,
  scope: refName,
});

/**
 * Kept single-level: composureCDK's nested-compose does not propagate context,
 * so sibling refs only work when every component is a sibling here.
 */
export function createSystem(stacks: SystemStacks, siteContentPath: string) {
  const { dnsStack, certStack, siteStack } = stacks;

  const hostedZone = ref<HostedZoneBuilderResult>("zone").get("hostedZone");
  const bucket = ref<BucketBuilderResult>("bucket").get("bucket");
  const distribution = ref<DistributionBuilderResult>("cdn").get("distribution");
  const certificate = ref<CertificateBuilderResult>("cert").get("certificate");

  return compose(
    {
      // DNS — apex/www A records still resolve to the existing host. The
      // CloudFront alias records are deliberately not yet created so this
      // stack can deploy without changing where end users land.
      zone: createHostedZoneBuilder().zoneName(DOMAIN),
      records: zoneRecords(ZONE_RECORDS).zone(hostedZone),

      // Cert (depends on zone for DNS validation)
      cert: createCertificateBuilder()
        .domainName(DOMAIN)
        .subjectAlternativeNames([WWW])
        .validationZone(hostedZone),

      // CloudWatch alarms can only target same-region SNS topics, so one per stack.
      certAlerts: createTopicBuilder().displayName("jasonduffett.net cert alerts"),
      siteAlerts: createTopicBuilder().displayName("jasonduffett.net site alerts"),

      // Site
      bucket: createBucketBuilder().accessLogging(true).removalPolicy(RemovalPolicy.RETAIN),
      cdn: createDistributionBuilder()
        .comment("jasonduffett.net")
        .domainNames([DOMAIN, WWW])
        .certificate(certificate)
        .defaultRootObject("index.html")
        .priceClass(PriceClass.PRICE_CLASS_100)
        .origin(bucket.map((b) => S3BucketOrigin.withOriginAccessControl(b)))
        .defaultBehavior({
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functions: [
            {
              eventType: FunctionEventType.VIEWER_REQUEST,
              functionName: `${siteStack.stackName}-redirect`,
              code: FunctionCode.fromInline(buildRedirectFunctionCode(DOMAIN)),
              comment: "www→apex 301 + old-URL redirect map",
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
        ]),
      deploy: createBucketDeploymentBuilder()
        .sources([Source.asset(siteContentPath)])
        .destinationBucket(bucket)
        .distribution(distribution)
        .distributionPaths(["/*"])
        .prune(true),
    },
    {
      zone: [],
      records: ["zone"],
      cert: ["zone"],
      certAlerts: [],
      siteAlerts: [],
      bucket: [],
      cdn: ["bucket", "cert"],
      deploy: ["bucket", "cdn"],
    },
  )
    .withStacks({
      zone: dnsStack,
      records: dnsStack,
      cert: certStack,
      certAlerts: certStack,
      siteAlerts: siteStack,
      bucket: siteStack,
      cdn: siteStack,
      deploy: siteStack,
    })
    .afterBuild(
      outputs({
        NameServers: {
          value: hostedZone.map((z) => Fn.join(",", z.hostedZoneNameServers ?? [])),
          description: "Set these as the NS records at the domain registrar to delegate the zone.",
          scope: "zone",
        },
        DistributionDomainName: {
          value: distribution.map((d) => d.distributionDomainName),
          description: "CloudFront distribution domain (for manual CNAME checks).",
          scope: "cdn",
        },
        SiteBucketName: {
          value: bucket.map((b) => b.bucketName),
          description: "S3 bucket backing the distribution.",
          scope: "bucket",
        },
        CertAlertsTopicArn: topicArnOutput("certAlerts", "cert-stack alarm notifications"),
        SiteAlertsTopicArn: topicArnOutput("siteAlerts", "site-stack alarm notifications"),
      }),
    )
    .afterBuild((_scope, _id, results) => {
      alarmActionsPolicy(certStack, {
        defaults: { alarmActions: [new SnsAction(results.certAlerts.topic)] },
      });
      alarmActionsPolicy(siteStack, {
        defaults: { alarmActions: [new SnsAction(results.siteAlerts.topic)] },
      });
    });
}
