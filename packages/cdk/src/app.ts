import { App, Stack } from "aws-cdk-lib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { addCiOidc } from "./stacks/ci-oidc-stack.js";
import { createSystem } from "./system.js";

const PRIMARY_REGION = "eu-west-2";
// ACM certificates attached to CloudFront must live in us-east-1.
const CLOUDFRONT_CERT_REGION = "us-east-1";

export interface BuildAppOptions {
  /** AWS account ID. `undefined` produces an env-agnostic synth (cdk's default). */
  readonly account: string | undefined;
  /** Directory whose contents are uploaded to the site bucket. */
  readonly siteContentPath: string;
  /** Email address subscribed to both alarm topics. */
  readonly alertEmail: string;
}

/**
 * Constructs the App + stacks but does not call `synth()`. Tests import this
 * to snapshot the same wiring CDK actually deploys.
 */
export function buildApp({ account, siteContentPath, alertEmail }: BuildAppOptions): App {
  const app = new App();

  // Both ends of a cross-region ref must opt in, so every stack sets the flag.
  const stackProps = (region: string) => ({
    env: { account, region },
    crossRegionReferences: true,
  });

  const dnsStack = new Stack(app, "JasonDuffettNetDnsStack", {
    ...stackProps(PRIMARY_REGION),
    description: "DNS for jasonduffett.net (Route 53 hosted zone + records).",
  });

  // Dedicated topic stack so it has no downstream deps and every us-east-1
  // stack (cert, cdnAlarms, future) can target the same topic without cycles.
  const usEast1AlertsStack = new Stack(app, "JasonDuffettNetUsEast1AlertsStack", {
    ...stackProps(CLOUDFRONT_CERT_REGION),
    description: "Notification topic for us-east-1 alarms (cert + CloudFront).",
  });

  const certStack = new Stack(app, "JasonDuffettNetCertStack", {
    ...stackProps(CLOUDFRONT_CERT_REGION),
    description: "ACM certificate for jasonduffett.net.",
  });

  const siteStack = new Stack(app, "JasonDuffettNetSiteStack", {
    ...stackProps(PRIMARY_REGION),
    description: "jasonduffett.net — static site on CloudFront + S3.",
  });

  // Kept separate from certStack to avoid a cdn↔cert cycle (this stack reads
  // distribution id from siteStack, which depends on certStack). Logical id
  // retains the "CdnAlarms" name so the deployed stack isn't replaced.
  const cdnAlarmsStack = new Stack(app, "JasonDuffettNetCdnAlarmsStack", {
    ...stackProps(CLOUDFRONT_CERT_REGION),
    description: "CloudWatch alarms for site metrics that AWS only emits in us-east-1.",
  });

  createSystem(
    { dnsStack, usEast1AlertsStack, certStack, siteStack, cdnAlarmsStack },
    siteContentPath,
    alertEmail,
  ).build(app, "jasonduffett.net");

  // Standalone bootstrap stack for the CI deploy role. Has no edges to the
  // application stacks: deploying the rest of the app should never require
  // touching the IAM role that powers CI itself.
  const ciOidcStack = new Stack(app, "JasonDuffettNetCiOidcStack", {
    ...stackProps(PRIMARY_REGION),
    description: "GitHub Actions OIDC provider + deploy role for laazyj/jasonduffett.net.",
  });
  addCiOidc(ciOidcStack, { githubOwner: "laazyj", githubRepo: "jasonduffett.net" });

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
    alertEmail,
  }).synth();
}
