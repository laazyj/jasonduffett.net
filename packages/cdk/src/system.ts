import { type CfnResource, Duration, Fn, type Stack } from "aws-cdk-lib";
import {
  FunctionCode,
  FunctionEventType,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { HealthCheckType } from "aws-cdk-lib/aws-route53";
import { Source } from "aws-cdk-lib/aws-s3-deployment";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

import { compose, ref } from "@composurecdk/core";
import { createCertificateBuilder, type CertificateBuilderResult } from "@composurecdk/acm";
import { createBudgetBuilder } from "@composurecdk/budgets";
import { alarmActionsPolicy } from "@composurecdk/cloudwatch";
import {
  cloudfrontAliasTarget,
  createHealthCheckAlarmBuilder,
  createHealthCheckBuilder,
  createHostedZoneBuilder,
  type HealthCheckBuilderResult,
  type HostedZoneBuilderResult,
} from "@composurecdk/route53";
import { ALIAS, type RecordSpec, zoneRecords } from "@composurecdk/route53/zone";
import {
  createBucketBuilder,
  createBucketDeploymentBuilder,
  type BucketBuilderResult,
} from "@composurecdk/s3";
import {
  createCloudFrontAlarmBuilder,
  createDistributionBuilder,
  type DistributionBuilderResult,
} from "@composurecdk/cloudfront";
import { createTopicBuilder, type TopicBuilderResult } from "@composurecdk/sns";
import { outputs } from "@composurecdk/cloudformation";

import { buildRedirectFunctionCode } from "./redirect-function.js";
import { DOMAIN, WWW, ZONE_RECORDS } from "./zone-records.js";

// Pinning the hosted zone's CFN logical ID decouples it from the construct
// path, so structural refactors (rename build id, regroup components, swap
// composurecdk versions) never force-replace the live zone. Replacing it
// would rotate the registrar-facing NS records — the one expensive thing in
// this stack. Records intentionally get path-derived IDs; recreating them is
// cheap.
const HOSTED_ZONE_LOGICAL_ID = "HostedZone";

// 90 days is shorter than the package default of 731 days, but ample audit
// runway for a personal blog and well below the threshold where stored log
// volume meaningfully shows up against the budget alarm.
const LOG_BUCKET_LIFECYCLE_RULES = [{ expiration: Duration.days(90) }];

export interface SystemStacks {
  /** Route 53 hosted zone + records. Region is cosmetic — Route 53 is global. */
  readonly dnsStack: Stack;
  /** SNS topic shared by every us-east-1 alarm. No downstream deps to avoid cycles. */
  readonly usEast1AlertsStack: Stack;
  /** ACM certificate. Must be `us-east-1` for CloudFront-attached certificates. */
  readonly certStack: Stack;
  /** S3 bucket, CloudFront distribution, bucket deployment, Route 53 health check, site-region alarms. */
  readonly siteStack: Stack;
  /**
   * Alarms whose underlying CloudWatch metrics emit only in `us-east-1`:
   * CloudFront distribution metrics and AWS/Route53 health-check metrics.
   */
  readonly cdnAlarmsStack: Stack;
}

const topicArnOutput = (refName: "usEast1Alerts" | "siteAlerts", role: string) => ({
  value: ref<TopicBuilderResult>(refName)
    .get("topic")
    .map((t) => t.topicArn),
  description: `Subscribe here to receive ${role}.`,
  scope: refName,
});

export function createSystem(stacks: SystemStacks, siteContentPath: string, alertEmail: string) {
  const { dnsStack, usEast1AlertsStack, certStack, siteStack, cdnAlarmsStack } = stacks;

  const hostedZone = ref<HostedZoneBuilderResult>("zone").get("hostedZone");
  const bucket = ref<BucketBuilderResult>("bucket").get("bucket");
  const distribution = ref<DistributionBuilderResult>("cdn").get("distribution");
  const certificate = ref<CertificateBuilderResult>("cert").get("certificate");

  const cdnAliasTarget = cloudfrontAliasTarget(distribution);
  const aliasSpecs: readonly RecordSpec[] = [
    ALIAS("@", cdnAliasTarget),
    ALIAS("@", cdnAliasTarget, { ipv6: true }),
    ALIAS("www", cdnAliasTarget),
    ALIAS("www", cdnAliasTarget, { ipv6: true }),
  ];

  return compose(
    {
      // DNS
      zone: createHostedZoneBuilder().zoneName(DOMAIN),
      records: zoneRecords(ZONE_RECORDS).zone(hostedZone),
      // Routed to siteStack in withStacks() so the stack graph stays acyclic.
      aliasRecords: zoneRecords(aliasSpecs).zone(hostedZone),

      // Cert (depends on zone for DNS validation)
      cert: createCertificateBuilder()
        .domainName(DOMAIN)
        .subjectAlternativeNames([WWW])
        .validationZone(hostedZone),

      // CloudWatch alarms can only target same-region SNS topics, so one topic per region.
      usEast1Alerts: createTopicBuilder()
        .displayName("jasonduffett.net us-east-1 alerts")
        .addSubscription("email", new EmailSubscription(alertEmail)),
      siteAlerts: createTopicBuilder()
        .displayName("jasonduffett.net site alerts")
        .addSubscription("email", new EmailSubscription(alertEmail)),

      // Notifies usEast1Alerts at AWS-recommended thresholds (80% actual, 100%
      // forecasted). The builder auto-creates the SNS topic policy granting
      // budgets.amazonaws.com:Publish — distinct from the alarmActionsPolicy
      // wired in the afterBuild block below.
      budget: createBudgetBuilder()
        .budgetName("jasonduffett.net-monthly")
        .limit({ amount: 4, unit: "USD" })
        .withRecommendedThresholds(ref<TopicBuilderResult>("usEast1Alerts").get("topic"))
        .recommendedAlarms(false),

      // Site. Builder defaults give us versioning, RETAIN, server access logging,
      // 7-day multipart abort, and 365-day noncurrent expiration; only override
      // where the personal-blog scale wants tighter retention than the defaults.
      bucket: createBucketBuilder()
        .serverAccessLogs({
          prefix: "logs/",
          configure: (sub) => sub.lifecycleRules(LOG_BUCKET_LIFECYCLE_RULES),
        })
        .lifecycleRules([{ noncurrentVersionExpiration: Duration.days(30) }]),
      cdn: createDistributionBuilder()
        .comment("jasonduffett.net")
        .domainNames([DOMAIN, WWW])
        .certificate(certificate)
        .defaultRootObject("index.html")
        .priceClass(PriceClass.PRICE_CLASS_100)
        .accessLogs({
          prefix: "logs/",
          configure: (sub) => sub.lifecycleRules(LOG_BUCKET_LIFECYCLE_RULES),
        })
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
        ])
        // CloudFront metrics only emit in us-east-1; alarms must live there too.
        .recommendedAlarms(false),
      cdnAlarms: createCloudFrontAlarmBuilder().distribution(ref<DistributionBuilderResult>("cdn")),

      // Route 53 health check on the public apex. Health checks are global
      // resources so the construct can live in any region; we co-locate it
      // with the site for operational locality. AWS/Route53 metrics emit only
      // in us-east-1, so the recommended alarm is suppressed here and
      // re-created in cdnAlarmsStack via the standalone alarm builder.
      healthCheck: createHealthCheckBuilder()
        .type(HealthCheckType.HTTPS)
        .fqdn(DOMAIN)
        .recommendedAlarms(false),
      healthCheckAlarms: createHealthCheckAlarmBuilder().healthCheck(
        ref<HealthCheckBuilderResult>("healthCheck"),
      ),

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
      aliasRecords: ["zone", "cdn"],
      cert: ["zone"],
      usEast1Alerts: [],
      siteAlerts: [],
      budget: ["usEast1Alerts"],
      bucket: [],
      cdn: ["bucket", "cert"],
      cdnAlarms: ["cdn"],
      healthCheck: [],
      healthCheckAlarms: ["healthCheck"],
      deploy: ["bucket", "cdn"],
    },
  )
    .withStacks({
      zone: dnsStack,
      records: dnsStack,
      aliasRecords: siteStack,
      cert: certStack,
      usEast1Alerts: usEast1AlertsStack,
      siteAlerts: siteStack,
      budget: usEast1AlertsStack,
      bucket: siteStack,
      cdn: siteStack,
      cdnAlarms: cdnAlarmsStack,
      healthCheck: siteStack,
      healthCheckAlarms: cdnAlarmsStack,
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
        UsEast1AlertsTopicArn: topicArnOutput(
          "usEast1Alerts",
          "alarm notifications from every us-east-1 stack",
        ),
        SiteAlertsTopicArn: topicArnOutput("siteAlerts", "site-stack alarm notifications"),
      }),
    )
    .afterBuild((_scope, _id, { zone }) => {
      (zone.hostedZone.node.defaultChild as CfnResource).overrideLogicalId(HOSTED_ZONE_LOGICAL_ID);
    })
    .afterBuild((_scope, _id, results) => {
      const usEast1Action = new SnsAction(results.usEast1Alerts.topic);
      alarmActionsPolicy(usEast1AlertsStack, { defaults: { alarmActions: [usEast1Action] } });
      alarmActionsPolicy(certStack, { defaults: { alarmActions: [usEast1Action] } });
      alarmActionsPolicy(cdnAlarmsStack, { defaults: { alarmActions: [usEast1Action] } });
      alarmActionsPolicy(siteStack, {
        defaults: { alarmActions: [new SnsAction(results.siteAlerts.topic)] },
      });
    });
}
