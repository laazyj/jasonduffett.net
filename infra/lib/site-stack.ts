import { Duration, Fn, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import {
  Function as CfFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { HostedZone, ARecord, AaaaRecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Source } from "aws-cdk-lib/aws-s3-deployment";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import type { Construct } from "constructs";

import { compose, ref } from "@composurecdk/core";
import { outputs } from "@composurecdk/cloudformation";
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

import { buildRedirectFunctionCode } from "./redirect-function.js";

export interface SiteStackProps extends StackProps {
  /** Apex domain, e.g. "jasonduffett.net". */
  readonly domainName: string;
  /** Absolute path to the built Eleventy output directory (`_site/`). */
  readonly siteContentPath: string;
}

/**
 * Deploys jasonduffett.net:
 *
 *   Route53 zone (created in-stack; point Fasthosts NS at these on first deploy)
 *     └── ACM cert (DNS-validated for apex + www)
 *     └── ARecord / AaaaRecord aliasing apex and www to CloudFront
 *
 *   S3 (private)  ── OAC ──  CloudFront Distribution
 *                                   │
 *                            ┌──────┴──────┐
 *                   CloudFront Function     BucketDeployment (syncs _site/)
 *                   (www→apex + old-URL 301s)
 *
 *   SNS topic collects alarms produced by the bucket and distribution
 *   builders' recommendedAlarms configuration.
 */
export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    const { domainName, siteContentPath } = props;
    const wwwDomainName = `www.${domainName}`;

    // Zone + cert are plain CDK — composureCDK intentionally doesn't wrap
    // everything, so anything outside the S3/CloudFront/SNS trio is normal.
    const hostedZone = new HostedZone(this, "HostedZone", {
      zoneName: domainName,
      comment: "jasonduffett.net — managed by CDK. Point registrar NS here.",
    });

    const certificate = new Certificate(this, "Certificate", {
      domainName,
      subjectAlternativeNames: [wwwDomainName],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const redirectFunction = new CfFunction(this, "RedirectFunction", {
      functionName: `${this.stackName}-redirect`,
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(buildRedirectFunctionCode()),
      comment: "www→apex 301 + old-URL redirect map",
    });

    const system = compose(
      {
        alerts: createTopicBuilder().displayName("jasonduffett.net alarms"),

        site: createBucketBuilder()
          .accessLogging(true)
          .removalPolicy(RemovalPolicy.RETAIN),

        cdn: createDistributionBuilder()
          .comment("jasonduffett.net")
          .domainNames([domainName, wwwDomainName])
          .certificate(certificate)
          .defaultRootObject("index.html")
          .priceClass(PriceClass.PRICE_CLASS_100)
          .origin(
            ref("site", (r: BucketBuilderResult) =>
              S3BucketOrigin.withOriginAccessControl(r.bucket),
            ),
          )
          .defaultBehavior({
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            functionAssociations: [
              {
                eventType: FunctionEventType.VIEWER_REQUEST,
                function: redirectFunction,
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
          .destinationBucket(ref("site", (r: BucketBuilderResult) => r.bucket))
          .distribution(ref("cdn", (r: DistributionBuilderResult) => r.distribution))
          .distributionPaths(["/*"])
          .prune(true),
      },
      {
        alerts: [],
        site: [],
        cdn: ["site"],
        deploy: ["site", "cdn"],
      },
    );

    system
      // Route recommended alarms to the alerts topic, and create the
      // Route53 aliases now that we have the concrete Distribution.
      .afterBuild((scope, _id, results) => {
        const action = new SnsAction(results.alerts.topic);
        for (const alarm of Object.values(results.site.alarms ?? {})) {
          alarm.addAlarmAction(action);
        }
        for (const alarm of Object.values(results.cdn.alarms ?? {})) {
          alarm.addAlarmAction(action);
        }

        const aliasTarget = RecordTarget.fromAlias(
          new CloudFrontTarget(results.cdn.distribution),
        );
        for (const name of [domainName, wwwDomainName]) {
          const safeName = name.replace(/\./g, "-");
          new ARecord(scope, `Alias-${safeName}-A`, {
            zone: hostedZone,
            recordName: name,
            target: aliasTarget,
          });
          new AaaaRecord(scope, `Alias-${safeName}-AAAA`, {
            zone: hostedZone,
            recordName: name,
            target: aliasTarget,
          });
        }
      })
      .afterBuild(
        outputs({
          HostedZoneNameServers: {
            value: Fn.join(", ", hostedZone.hostedZoneNameServers ?? []),
            description: "Comma-separated NS records to paste into the Fasthosts registrar.",
          },
          DistributionDomainName: {
            value: ref("cdn", (r: DistributionBuilderResult) => r.distribution.distributionDomainName),
            description: "CloudFront distribution domain (for manual CNAME checks).",
          },
          SiteBucketName: {
            value: ref("site", (r: BucketBuilderResult) => r.bucket.bucketName),
            description: "S3 bucket backing the distribution.",
          },
          AlertsTopicArn: {
            value: ref("alerts", (r: TopicBuilderResult) => r.topic.topicArn),
            description: "Subscribe an email/SMS here to receive alarm notifications.",
          },
        }),
      )
      .build(this, "Site");
  }
}
