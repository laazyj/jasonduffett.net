import { type Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const STACK_NAMES = [
  "JasonDuffettNetDnsStack",
  "JasonDuffettNetUsEast1AlertsStack",
  "JasonDuffettNetCertStack",
  "JasonDuffettNetSiteStack",
  "JasonDuffettNetCdnAlarmsStack",
  "JasonDuffettNetCiOidcStack",
] as const;

describe("app synthesis", () => {
  let templates: Record<(typeof STACK_NAMES)[number], unknown>;

  beforeAll(() => {
    const app = buildApp({
      account: "111111111111",
      siteContentPath: resolve(import.meta.dirname, "fixtures", "site"),
      alertEmail: "alerts@example.invalid",
    });
    templates = Object.fromEntries(
      STACK_NAMES.map((name) => [
        name,
        Template.fromStack(app.node.findChild(name) as Stack).toJSON(),
      ]),
    ) as typeof templates;
  });

  // One snapshot file per stack — keeps PR diffs scoped to the stacks that
  // actually changed instead of bundling all five into a single .snap file.
  it.each(STACK_NAMES)("%s matches snapshot", async (name) => {
    await expect(JSON.stringify(templates[name], null, 2)).toMatchFileSnapshot(
      `./__snapshots__/${name}.json`,
    );
  });
});
