import { type App, type Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { constraints } from "@composurecdk/cloudformation";

import { buildApp, type SubsiteKey } from "../src/app.js";

const STACK_NAMES = [
  "JasonDuffettNetDnsStack",
  "JasonDuffettNetUsEast1AlertsStack",
  "JasonDuffettNetCertStack",
  "JasonDuffettNetSiteStack",
  "JasonDuffettNetCdnAlarmsStack",
  "JasonDuffettNetCiOidcStack",
  "JasonDuffettNetClaraCertStack",
  "JasonDuffettNetClaraSiteStack",
  "JasonDuffettNetClaraCdnAlarmsStack",
  "JasonDuffettNetClaraUsEast1AlertsStack",
  "JasonDuffettNetNaomiCertStack",
  "JasonDuffettNetNaomiSiteStack",
  "JasonDuffettNetNaomiCdnAlarmsStack",
  "JasonDuffettNetNaomiUsEast1AlertsStack",
] as const;

// Every subsite is built from the same `createSubsite()` graph, so the
// structural guarantees below hold for all of them — new subsites join the
// table rather than growing a parallel describe block.
const SUBSITES = [
  { key: "clara", name: "Clara", subdomain: "clara.jasonduffett.net" },
  { key: "naomi", name: "Naomi", subdomain: "naomi.jasonduffett.net" },
] as const satisfies readonly { key: SubsiteKey; name: string; subdomain: string }[];

const stackTemplate = (app: App, name: (typeof STACK_NAMES)[number]) =>
  Template.fromStack(app.node.findChild(name) as Stack);

describe("app synthesis", () => {
  let app: App;
  let templates: Record<(typeof STACK_NAMES)[number], unknown>;

  beforeAll(() => {
    app = buildApp({
      account: "111111111111",
      siteContentPath: resolve(import.meta.dirname, "fixtures", "site"),
      subsiteContentPaths: Object.fromEntries(
        SUBSITES.map(({ key }) => [key, resolve(import.meta.dirname, "fixtures", key)]),
      ) as Record<SubsiteKey, string>,
      alertEmail: "alerts@example.invalid",
    });
    templates = Object.fromEntries(
      STACK_NAMES.map((name) => [name, stackTemplate(app, name).toJSON()]),
    ) as typeof templates;
  });

  // One snapshot file per stack — keeps PR diffs scoped to the stacks that
  // actually changed instead of bundling them all into a single .snap file.
  // The template object is handed to the matcher directly so vitest's snapshot
  // serializer pipeline runs; CDK asset hashes are normalised to a stable
  // placeholder there (see vitest.setup.ts).
  it.each(STACK_NAMES)("%s matches snapshot", async (name) => {
    await expect(templates[name]).toMatchFileSnapshot(`./__snapshots__/${name}.snap`);
  });

  // Belt to `templateTextPolicy`'s braces (see `app.ts`): the Aspect only reads
  // top-level L1 properties, so sweep the whole rendered template for
  // characters CloudFormation would transliterate — that is what reaches the
  // nested `DistributionConfig.Comment` / `FunctionConfig.Comment` fields. Same
  // validator the Aspect applies, so the two cannot disagree about the allowed
  // set.
  it.each(STACK_NAMES)("%s is pure ASCII", (name) => {
    const rendered = JSON.stringify(templates[name]);
    expect(() => {
      constraints.validate.templateText(rendered, `${name} template`);
    }).not.toThrow();
  });

  // Functional assertions sit alongside the snapshots for two reasons. (1) A
  // snapshot diff tells you "something changed" but not whether the change is
  // safe — the assertions below pin properties that *must* hold regardless of
  // refactors. (2) They also illustrate the kinds of checks worth writing
  // against composureCDK output beyond the synth snapshot.

  describe("CI OIDC trust policy", () => {
    it("scopes role assumption to main and PRs from this exact repo", () => {
      stackTemplate(app, "JasonDuffettNetCiOidcStack").hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "sts:AssumeRoleWithWebIdentity",
              Condition: {
                StringEquals: {
                  "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                },
                StringLike: {
                  "token.actions.githubusercontent.com:sub": [
                    "repo:laazyj/jasonduffett.net:ref:refs/heads/main",
                    "repo:laazyj/jasonduffett.net:pull_request",
                  ],
                },
              },
            }),
          ]),
        },
      });
    });
  });

  describe("ACM certificate", () => {
    it("covers apex and www", () => {
      stackTemplate(app, "JasonDuffettNetCertStack").hasResourceProperties(
        "AWS::CertificateManager::Certificate",
        {
          DomainName: "jasonduffett.net",
          SubjectAlternativeNames: ["www.jasonduffett.net"],
        },
      );
    });
  });

  describe("subsite delegation", () => {
    it("gives every subsite a delegated child zone under the parent", () => {
      const dns = stackTemplate(app, "JasonDuffettNetDnsStack");
      // The parent zone plus one delegated child per subsite. Both the child
      // zone and its NS record in the parent must be present for the subdomain
      // to resolve without a manual name-server handoff.
      expect(Object.keys(dns.findResources("AWS::Route53::HostedZone")).length).toBe(
        1 + SUBSITES.length,
      );
    });
  });

  describe.each(SUBSITES)("$subdomain subsite", ({ name, subdomain }) => {
    it("issues a dedicated certificate for the subdomain", () => {
      stackTemplate(app, `JasonDuffettNet${name}CertStack`).hasResourceProperties(
        "AWS::CertificateManager::Certificate",
        {
          DomainName: subdomain,
        },
      );
    });

    it("delegates the subdomain from the parent zone to the child zone", () => {
      stackTemplate(app, "JasonDuffettNetDnsStack").hasResourceProperties(
        "AWS::Route53::RecordSet",
        {
          Type: "NS",
          Name: `${subdomain}.`,
        },
      );
    });

    it("monitors the subdomain with a Route 53 health check", () => {
      stackTemplate(app, `JasonDuffettNet${name}SiteStack`).hasResourceProperties(
        "AWS::Route53::HealthCheck",
        {
          HealthCheckConfig: Match.objectLike({
            Type: "HTTPS",
            FullyQualifiedDomainName: subdomain,
          }),
        },
      );
    });

    it("raises the cert, CloudFront and health-check alarms at apex parity", () => {
      // Cert expiry alarm lives with the cert (us-east-1).
      stackTemplate(app, `JasonDuffettNet${name}CertStack`).hasResourceProperties(
        "AWS::CloudWatch::Alarm",
        Match.objectLike({ MetricName: "DaysToExpiry", Namespace: "AWS/CertificateManager" }),
      );

      // CloudFront + health-check alarms live together in the us-east-1 alarm stack.
      const alarms = stackTemplate(app, `JasonDuffettNet${name}CdnAlarmsStack`);
      alarms.hasResourceProperties(
        "AWS::CloudWatch::Alarm",
        Match.objectLike({ MetricName: "5xxErrorRate", Namespace: "AWS/CloudFront" }),
      );
      alarms.hasResourceProperties(
        "AWS::CloudWatch::Alarm",
        Match.objectLike({
          MetricName: "HealthCheckStatus",
          Namespace: "AWS/Route53",
          // Wired to the subsite's own alert topic, not left actionless.
          AlarmActions: Match.anyValue(),
        }),
      );
    });

    it("owns a dedicated alert topic with an email subscription", () => {
      const alerts = stackTemplate(app, `JasonDuffettNet${name}UsEast1AlertsStack`);
      alerts.resourceCountIs("AWS::SNS::Topic", 1);
      alerts.hasResourceProperties(
        "AWS::SNS::Subscription",
        Match.objectLike({ Protocol: "email", Endpoint: "alerts@example.invalid" }),
      );
    });

    it("serves its own content from a distribution aliased to the subdomain", () => {
      stackTemplate(app, `JasonDuffettNet${name}SiteStack`).hasResourceProperties(
        "AWS::CloudFront::Distribution",
        {
          DistributionConfig: Match.objectLike({
            Aliases: [subdomain],
            DefaultRootObject: "index.html",
          }),
        },
      );
    });
  });

  describe("budget", () => {
    it("limits monthly spend to 6 USD", () => {
      stackTemplate(app, "JasonDuffettNetUsEast1AlertsStack").hasResourceProperties(
        "AWS::Budgets::Budget",
        {
          Budget: Match.objectLike({
            BudgetLimit: { Amount: 6, Unit: "USD" },
            BudgetType: "COST",
            TimeUnit: "MONTHLY",
          }),
        },
      );
    });
  });

  describe("CDN alarms", () => {
    // Recommended-alarm coverage from composureCDK — if this drops to zero,
    // someone has flipped `recommendedAlarms(false)` on the cdn builder.
    it("creates multiple CloudWatch alarms in the edge region", () => {
      const template = stackTemplate(app, "JasonDuffettNetCdnAlarmsStack");
      const alarmCount = Object.keys(template.findResources("AWS::CloudWatch::Alarm")).length;
      expect(alarmCount).toBeGreaterThanOrEqual(5);
    });
  });
});
