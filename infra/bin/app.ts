#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { SiteStack } from "../lib/site-stack.js";

// Walk up from this file until we find the repo root (identified by _site/
// or package.json + infra/). Works whether this runs from source
// (infra/bin/app.ts) or compiled output (infra/dist/bin/app.js).
const here = dirname(fileURLToPath(import.meta.url));
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, "infra")) && existsSync(resolve(dir, "package.json"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  throw new Error(`Could not locate repo root from ${start}`);
}
const repoRoot = findRepoRoot(here);

const app = new App();

new SiteStack(app, "JasonDuffettNet", {
  domainName: "jasonduffett.net",
  siteContentPath: resolve(repoRoot, "_site"),
  // us-east-1 is required for CloudFront-attached ACM certificates; keeping
  // the whole stack there avoids cross-region cert gymnastics.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  description: "jasonduffett.net — static site on CloudFront + S3 via composureCDK.",
});
