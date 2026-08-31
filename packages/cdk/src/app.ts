import { App, Duration, Stack } from "aws-cdk-lib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { templateTextPolicy } from "@composurecdk/cloudformation";
import { at, compose, ref } from "@composurecdk/core";
import { createNsRecordBuilder, type HostedZoneBuilderResult } from "@composurecdk/route53";

import { addCiOidc } from "./stacks/ci-oidc-stack.js";
import { createSubsite, type SubsiteStacks } from "./subsite.js";
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

/**
 * Every subsite is one key. `clara` means the domain `clara.jasonduffett.net`,
 * the content at `packages/clara/dist`, the `JasonDuffettNetClara…` stacks, the
 * `Clara…` CloudFormation outputs, and the `clara`/`claraDelegation` components
 * below — all derived, so they cannot drift apart. Adding a subsite is this row
 * plus its `packages/<key>` Eleventy package.
 */
const SUBSITE_KEYS = ["clara", "naomi"] as const;

export type SubsiteKey = (typeof SUBSITE_KEYS)[number];

/** `clara` -> `Clara`: the PascalCase form used in stack names and output keys. */
const pascal = (key: string) => key[0].toUpperCase() + key.slice(1);

export interface BuildAppOptions {
  /** AWS account ID. `undefined` produces an env-agnostic synth (cdk's default). */
  readonly account: string | undefined;
  /** Directory whose contents are uploaded to the site bucket. */
  readonly siteContentPath: string;
  /** Directory whose contents are uploaded to each subsite's bucket, by subsite key. */
  readonly subsiteContentPaths: Record<SubsiteKey, string>;
  /** Email address subscribed to both alarm topics. */
  readonly alertEmail: string;
}

/**
 * Constructs the App + stacks but does not call `synth()`. Tests import this
 * to snapshot the same wiring CDK actually deploys.
 */
export function buildApp({
  account,
  siteContentPath,
  subsiteContentPaths,
  alertEmail,
}: BuildAppOptions): App {
  const app = new App();

  // CloudFormation stores template text as ASCII and transliterates anything
  // else to `?` at deploy time, so the deployed template never matches the
  // synthesised one and `cdk diff` reports a change on every run forever. Fail
  // synth instead.
  //
  // `functionCode` is added to the built-in registry because it is the only
  // free-text field here fed by external data: `redirects.json` is stringified
  // into the CloudFront Function body, and `redirects.ts` validates that file's
  // shape but not its character set. Registering it names the offending
  // character at synth rather than leaving it to the test sweep.
  //
  // The policy only reads top-level L1 properties, so the two nested
  // `...Config.Comment` fields stay out of reach; the "is pure ASCII" sweep in
  // `test/app.test.ts` covers those.
  templateTextPolicy(app, {
    fields: { "AWS::CloudFront::Function": ["functionCode"] },
  });

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

  // jasonduffett.net CDN
  const siteStack = new Stack(app, "JasonDuffettNetSiteStack", {
    ...stackProps(CONFIG.primaryRegion),
    description: `${CONFIG.domain} - static site on CloudFront + S3.`,
  });

  // Separate CDN alarms from cert stacks to avoid cycles
  const cdnAlarmsStack = new Stack(app, "JasonDuffettNetCdnAlarmsStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: "CloudWatch alarms for site metrics that AWS only emits in us-east-1.",
  });

  // Dedicated topic stack for every us-east-1 has no downstream deps
  const usEast1AlertsStack = new Stack(app, "JasonDuffettNetUsEast1AlertsStack", {
    ...stackProps(CONFIG.edgeRegion),
    description: "Notification topic for us-east-1 alarms (cert + CloudFront).",
  });

  // Each subsite gets the same four stacks as the apex, named
  // `JasonDuffettNet<Name>…` and kept separate from the apex's (and from every
  // other subsite's) so one subsite's deploy can't disturb another's. Only the
  // parent `dnsStack` is shared — that is where the child zone and its NS
  // delegation record live.
  const subsiteStacks = (key: SubsiteKey): SubsiteStacks => {
    const name = pascal(key);
    const subdomain = `${key}.${CONFIG.domain}`;
    return {
      dnsStack,
      certStack: new Stack(app, `JasonDuffettNet${name}CertStack`, {
        ...stackProps(CONFIG.edgeRegion),
        description: `ACM certificate for ${subdomain}.`,
      }),
      siteStack: new Stack(app, `JasonDuffettNet${name}SiteStack`, {
        ...stackProps(CONFIG.primaryRegion),
        description: `${subdomain} - static subsite on CloudFront + S3.`,
      }),
      cdnAlarmsStack: new Stack(app, `JasonDuffettNet${name}CdnAlarmsStack`, {
        ...stackProps(CONFIG.edgeRegion),
        description: `CloudWatch alarms for ${subdomain} metrics that AWS only emits in us-east-1.`,
      }),
      usEast1AlertsStack: new Stack(app, `JasonDuffettNet${name}UsEast1AlertsStack`, {
        ...stackProps(CONFIG.edgeRegion),
        description: `Notification topic for ${subdomain} us-east-1 alarms (cert + CloudFront + health check).`,
      }),
    };
  };

  // -- Declare the system -- //

  // The apex site and each subsite are a self-contained `compose()` graph (own
  // bucket, CloudFront distribution, ACM cert, hosted zone). Rather than build
  // them independently and bridge them with a raw construct, they are nested as
  // sub-lifecycles of one outer `compose()` — `ComposedSystem` is itself a
  // `Lifecycle`, so composition is recursive. The outer graph adds one
  // `<name>Delegation` component per subsite, delegating <name>.{domain} from
  // the parent zone to that subsite's child zone.
  //
  // `compose()` builds each component with the construct id `${id}/${key}`, so
  // naively nesting the apex under the key `jduffett` would shift every apex
  // construct path (and thus every CloudFormation logical id) — replacing the
  // live apex resources. `at()` pins the apex sub-lifecycle's build id so its
  // components keep building at `jasonduffett.net/<key>` regardless of the
  // outer key. The subsites nest without pinning: they were deployed under
  // these keys from the start.
  //
  // The pinned id is a hard-coded literal, not `CONFIG.domain`: it records the
  // path these resources were originally deployed at and must stay fixed even
  // if the apex is later re-pointed at a different domain — otherwise the pin
  // would rotate with the config and replace every live resource.
  const delegation = (key: SubsiteKey) =>
    createNsRecordBuilder()
      .zone(ref<{ zone: HostedZoneBuilderResult }>("jduffett").get("zone").get("hostedZone"))
      .recordName(`${key}.${CONFIG.domain}`)
      .values(
        ref<{ zone: HostedZoneBuilderResult }>(key)
          .get("zone")
          .get("hostedZone")
          .map((z) => z.hostedZoneNameServers ?? []),
      )
      .ttl(Duration.minutes(30));

  // `perSubsite("Delegation", f)` -> `{ claraDelegation: f("clara"), … }`. Each
  // subsite contributes two components — itself, keyed `<key>`, and the NS
  // record delegating its subdomain, keyed `<key>Delegation` — so the component
  // map, the dependency map and the stack routing below are each spelled once
  // and stay in step by construction.
  const perSubsite = <T>(suffix: string, build: (key: SubsiteKey) => T): Record<string, T> =>
    Object.fromEntries(SUBSITE_KEYS.map((key) => [`${key}${suffix}`, build(key)]));

  compose(
    {
      jduffett: at(
        "jasonduffett.net",
        createSystem(
          { dnsStack, usEast1AlertsStack, certStack, siteStack, cdnAlarmsStack },
          { domain: CONFIG.domain, siteContentPath, alertEmail },
        ),
      ),
      ...perSubsite("", (key) =>
        createSubsite(subsiteStacks(key), {
          subdomain: `${key}.${CONFIG.domain}`,
          name: pascal(key),
          siteContentPath: subsiteContentPaths[key],
          alertEmail,
        }),
      ),
      ...perSubsite("Delegation", delegation),
    },
    {
      jduffett: [],
      ...perSubsite("", () => []),
      ...perSubsite("Delegation", (key) => ["jduffett", key]),
    },
  )
    .withStacks(perSubsite("Delegation", () => dnsStack))
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
    subsiteContentPaths: Object.fromEntries(
      SUBSITE_KEYS.map((key) => [key, resolve(import.meta.dirname, "..", "..", key, "dist")]),
    ) as Record<SubsiteKey, string>,
    alertEmail,
  }).synth();
}
