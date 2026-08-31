import { Duration, type Stack } from "aws-cdk-lib";
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

/**
 * Viewer-request CloudFront Function shared by every subsite. Unlike the apex
 * site there is no `www`→apex canonicalisation and no legacy redirect map —
 * each subdomain is brand new — so this only does the pretty-URL rewrite that
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

export interface SubsiteStacks {
  /** Parent zone's stack. The delegated child zone + the NS delegation record both live here. */
  readonly dnsStack: Stack;
  /** ACM certificate + its expiry alarm. Must be `us-east-1` for CloudFront-attached certificates. */
  readonly certStack: Stack;
  /**
   * S3 bucket, CloudFront distribution, bucket deployment, alias records, the
   * Route 53 health check, and the site-region (`siteAlerts`) topic.
   */
  readonly siteStack: Stack;
  /**
   * CloudFront + health-check alarms. Must be `us-east-1` — AWS only emits
   * CloudFront and Route 53 health-check metrics there.
   */
  readonly cdnAlarmsStack: Stack;
  /**
   * The `usEast1Alerts` topic. Stands alone (no downstream deps) so the cert
   * and CloudFront alarm stacks can target it without forming a cycle. Must be
   * `us-east-1` — alarms only target a same-region topic.
   */
  readonly usEast1AlertsStack: Stack;
}

export interface SubsiteOptions {
  /** Fully-qualified subdomain — e.g. `clara.jasonduffett.net`. */
  readonly subdomain: string;
  /**
   * PascalCase name for the subsite, used to prefix its CloudFormation outputs
   * (`ClaraDistributionDomainName`) and to label them in prose. Must be unique
   * across subsites — outputs share the app, not the stack.
   */
  readonly name: string;
  /** Directory whose contents are uploaded to the subsite bucket. */
  readonly siteContentPath: string;
  /** Email address subscribed to both of the subsite's alert topics. */
  readonly alertEmail: string;
}

const topicArnOutput = (refName: "usEast1Alerts" | "siteAlerts", role: string) => ({
  value: ref<TopicBuilderResult>(refName)
    .get("topic")
    .map((t) => t.topicArn),
  description: `Subscribe here to receive ${role}.`,
  scope: refName,
});

/**
 * Self-contained subsite for one subdomain of the apex — `clara.` and `naomi.`
 * are both built from here. Mirrors the apex `createSystem()` wiring (see
 * `system.ts` for the full `compose()` pattern walkthrough) but trimmed to a
 * single static page: own hosted zone, own ACM cert, own bucket + CloudFront
 * distribution.
 *
 * It also owns its monitoring at full parity with the apex — a Route 53 health
 * check plus the recommended certificate and CloudFront alarms — all wired to
 * its own SNS alert topics, so the subsite has the same availability coverage
 * without reaching into the parent system's alerting. As on the apex, alarms
 * can only target a same-region topic, so there is a `us-east-1` topic (for the
 * cert, CloudFront and health-check alarms) and a site-region topic. The
 * account-wide budget alarm is not duplicated here.
 *
 * Every subsite gets its own four stacks (cert, site, cdn alarms, alerts) so
 * one subsite's deploy can never disturb another's; only the parent `dnsStack`
 * is shared, because that is where the child zone and its NS delegation live.
 *
 * The build result exposes the child `zone`, which the composition root
 * (`app.ts`) uses to delegate the subdomain from the parent zone — keeping the
 * one parent↔child reference at the call site rather than inside this module,
 * so lifting a subsite into its own repo later is a call-site edit.
 */
export function createSubsite(stacks: SubsiteStacks, options: SubsiteOptions) {
  const { dnsStack, certStack, siteStack, cdnAlarmsStack, usEast1AlertsStack } = stacks;
  const { subdomain, name, siteContentPath, alertEmail } = options;

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

      // Cert (depends on zone for DNS validation). The recommended expiry alarm
      // lands in certStack (us-east-1) and is wired to usEast1Alerts below.
      cert: createCertificateBuilder().domainName(subdomain).validationZone(zone),

      // CloudWatch alarms can only target a same-region SNS topic, so one topic
      // per region — matching the apex split.
      usEast1Alerts: createTopicBuilder()
        .displayName(`${subdomain} us-east-1 alerts`)
        .addSubscription("email", new EmailSubscription(alertEmail)),
      siteAlerts: createTopicBuilder()
        .displayName(`${subdomain} site alerts`)
        .addSubscription("email", new EmailSubscription(alertEmail)),

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
              comment: "pretty-URL -> /index.html rewrite",
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

      // Route 53 health check on the public subdomain. AWS/Route53 metrics emit
      // only in us-east-1, so the recommended alarm is suppressed here and
      // re-created in cdnAlarmsStack via the standalone alarm builder.
      healthCheck: createHealthCheckBuilder()
        .type(HealthCheckType.HTTPS)
        .fqdn(subdomain)
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
      aliasRecords: ["zone", "cdn"],
      cert: ["zone"],
      usEast1Alerts: [],
      siteAlerts: [],
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
      aliasRecords: siteStack,
      cert: certStack,
      usEast1Alerts: usEast1AlertsStack,
      siteAlerts: siteStack,
      bucket: siteStack,
      cdn: siteStack,
      cdnAlarms: cdnAlarmsStack,
      healthCheck: siteStack,
      healthCheckAlarms: cdnAlarmsStack,
      deploy: siteStack,
    })
    .afterBuild(
      outputs({
        [`${name}DistributionDomainName`]: {
          value: distribution.map((d) => d.distributionDomainName),
          description: `CloudFront distribution domain for the ${name} subsite (manual CNAME checks).`,
          scope: "cdn",
        },
        [`${name}UsEast1AlertsTopicArn`]: topicArnOutput(
          "usEast1Alerts",
          `${name} subsite alarm notifications from us-east-1 (cert + CloudFront + health check)`,
        ),
        [`${name}SiteAlertsTopicArn`]: topicArnOutput(
          "siteAlerts",
          `${name} subsite site-region alarm notifications`,
        ),
      }),
    )
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
