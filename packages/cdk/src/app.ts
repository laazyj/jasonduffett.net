import { App, Duration, Stack } from "aws-cdk-lib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compose, ref, type Lifecycle } from "@composurecdk/core";
import { createNsRecordBuilder, type HostedZoneBuilderResult } from "@composurecdk/route53";

import { addCiOidc } from "./stacks/ci-oidc-stack.js";
import { createClaraSubsite } from "./clara-system.js";
import { createSystem } from "./system.js";

/**
 * Edit-points for forking this app to a different domain or repository.
 * Everything domain- or repo-specific lives here; the rest of the code reads
 * from the values passed through `createSystem()` and `addCiOidc()`.
 *
 * `edgeRegion` is fixed to `us-east-1` because that's where ACM certificates
 * attached to CloudFront must live and where CloudFront/Route 53 metrics
 * emit. `primaryRegion` is otherwise free.
 */
const CONFIG = {
  domain: "jasonduffett.net",
  githubOwner: "laazyj",
  githubRepo: "jasonduffett.net",
  primaryRegion: "eu-west-2",
  edgeRegion: "us-east-1",
} as const;

export interface BuildAppOptions {
  /** AWS account ID. `undefined` produces an env-agnostic synth (cdk's default). */
  readonly account: string | undefined;
  /** Directory whose contents are uploaded to the site bucket. */
  readonly siteContentPath: string;
  /** Directory whose contents are uploaded to the Clara subsite bucket. */
  readonly claraContentPath: string;
  /** Email address subscribed to both alarm topics. */
  readonly alertEmail: string;
}

/**
 * Wraps a {@link Lifecycle} so it ignores the construct id `compose()` assigns
 * it (`${parentId}/${key}`) and always builds under `id` instead.
 *
 * `compose()` derives every nested component's construct path from its key, so
 * lifting an already-deployed system into a parent graph would otherwise rotate
 * all of its CloudFormation logical ids and replace the live resources. Pinning
 * the inner build id keeps those paths — and therefore the logical ids —
 * stable, which is what lets the apex system become a sub-lifecycle without a
 * destructive redeploy.
 *
 * TODO: Replace with solution from https://github.com/laazyj/composureCDK/issues/245
 */
const withFixedId = <T extends object>(inner: Lifecycle<T>, id: string): Lifecycle<T> => ({
  build: (scope, _id, context) => inner.build(scope, id, context),
});

/**
 * Constructs the App + stacks but does not call `synth()`. Tests import this
 * to snapshot the same wiring CDK actually deploys.
 */
export function buildApp({
  account,
  siteContentPath,
  claraContentPath,
  alertEmail,
}: BuildAppOptions): App {
  const app = new App();
  const claraDomain = `clara.${CONFIG.domain}`;

  // -- Setup stacks across home region and us-east-1 where required by AWS -- //

  // Both ends of a cross-region ref must opt in, so every stack sets the flag.
  const stackProps = (region: string) => ({
    env: { account, region },
    crossRegionReferences: true,
  });

  // DNS zone
  const dnsStack = new Stack(app, "JasonDuffettNetDnsStack", {
    ...stackProps(CONFIG.primaryRegion),
    description: `DNS for ${CONFIG.domain} (Route 53 hosted zone + records).`,
  });

  // jasonduffett.net cloudFront certificate in us-east-1
  const certStack = new Stack(app, "JasonDuffettNetCertStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: `ACM certificate for ${CONFIG.domain}.`,
  });

  // clara.jasonduffett.net cloudFront certificate in us-east-1
  const claraCertStack = new Stack(app, "JasonDuffettNetClaraCertStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: `ACM certificate for ${claraDomain}.`,
  });

  // jasonduffett.net CDN
  const siteStack = new Stack(app, "JasonDuffettNetSiteStack", {
    ...stackProps(CONFIG.primaryRegion),
    description: `${CONFIG.domain} — static site on CloudFront + S3.`,
  });

  // clara.jasonduffett.net CDN
  const claraSiteStack = new Stack(app, "JasonDuffettNetClaraSiteStack", {
    ...stackProps(CONFIG.primaryRegion),
    description: `${claraDomain} — static subsite on CloudFront + S3.`,
  });

  // Separate CDN alarms from cert stacks to avoid cycles
  const cdnAlarmsStack = new Stack(app, "JasonDuffettNetCdnAlarmsStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: "CloudWatch alarms for site metrics that AWS only emits in us-east-1.",
  });

  // clara.jasonduffett.net equivalent — kept separate from the apex alarms so
  // the subsite's monitoring stands alone.
  const claraCdnAlarmsStack = new Stack(app, "JasonDuffettNetClaraCdnAlarmsStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: `CloudWatch alarms for ${claraDomain} metrics that AWS only emits in us-east-1.`,
  });

  // Dedicated topic stack for every us-east-1 has no downstream deps
  const usEast1AlertsStack = new Stack(app, "JasonDuffettNetUsEast1AlertsStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: "Notification topic for us-east-1 alarms (cert + CloudFront).",
  });

  // clara.jasonduffett.net's own us-east-1 alert topic stack.
  const claraUsEast1AlertsStack = new Stack(app, "JasonDuffettNetClaraUsEast1AlertsStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: `Notification topic for ${claraDomain} us-east-1 alarms (cert + CloudFront + health check).`,
  });

  // -- Declare the system -- //

  // The apex site and Clara's subsite are each a self-contained `compose()`
  // graph (own bucket, CloudFront distribution, ACM cert, hosted zone). Rather
  // than build them independently and bridge them with a raw construct, they
  // are nested as sub-lifecycles of one outer `compose()` — `ComposedSystem`
  // is itself a `Lifecycle`, so composition is recursive. The outer graph adds
  // a single `claraDelegation` component that delegates clara.{domain} from the
  // parent zone to Clara's child zone.
  //
  // `compose()` builds each component with the construct id `${id}/${key}`, so
  // naively nesting the apex under the key `jduffett` would shift every apex
  // construct path (and thus every CloudFormation logical id) — replacing the
  // live apex resources. `withFixedId` pins the apex sub-lifecycle's internal
  // build id to the bare domain, so its components keep building at
  // `jasonduffett.net/<key>` regardless of the outer key. Clara is new, so its
  // ids are free to change and it nests without pinning.
  compose(
    {
      jduffett: withFixedId(
        createSystem(
          { dnsStack, usEast1AlertsStack, certStack, siteStack, cdnAlarmsStack },
          { domain: CONFIG.domain, siteContentPath, alertEmail },
        ),
        CONFIG.domain,
      ),
      clara: createClaraSubsite(
        {
          dnsStack,
          certStack: claraCertStack,
          siteStack: claraSiteStack,
          cdnAlarmsStack: claraCdnAlarmsStack,
          usEast1AlertsStack: claraUsEast1AlertsStack,
        },
        { subdomain: claraDomain, siteContentPath: claraContentPath, alertEmail },
      ),
      claraDelegation: createNsRecordBuilder()
        .zone(ref<{ zone: HostedZoneBuilderResult }>("jduffett").get("zone").get("hostedZone"))
        .recordName(claraDomain)
        .values(
          ref<{ zone: HostedZoneBuilderResult }>("clara")
            .get("zone")
            .get("hostedZone")
            .map((z) => z.hostedZoneNameServers ?? []),
        )
        .ttl(Duration.minutes(30)),
    },
    {
      jduffett: [],
      clara: [],
      claraDelegation: ["jduffett", "clara"],
    },
  )
    .withStacks({ claraDelegation: dnsStack })
    .build(app, CONFIG.domain);

  // -- CI Support -- //

  // Standalone bootstrap stack for the CI deploy role. Has no edges to the
  // application stacks: deploying the rest of the app should never require
  // touching the IAM role that powers CI itself.
  const ciOidcStack = new Stack(app, "JasonDuffettNetCiOidcStack", {
    ...stackProps(CONFIG.primaryRegion),
    description: `GitHub Actions OIDC provider + deploy role for ${CONFIG.githubOwner}/${CONFIG.githubRepo}.`,
  });
  addCiOidc(ciOidcStack, {
    githubOwner: CONFIG.githubOwner,
    githubRepo: CONFIG.githubRepo,
  });

  return app;
}

// Synth only when invoked as the cdk app entry. Importing from tests doesn't
// trigger synth — keeps the wiring in one file without side-effecting on import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) {
    throw new Error("ALERT_EMAIL is required, e.g. `export ALERT_EMAIL=you@example.com`.");
  }
  buildApp({
    account: process.env.CDK_DEFAULT_ACCOUNT,
    siteContentPath: resolve(import.meta.dirname, "..", "..", "site", "dist"),
    claraContentPath: resolve(import.meta.dirname, "..", "..", "clara", "dist"),
    alertEmail,
  }).synth();
}
