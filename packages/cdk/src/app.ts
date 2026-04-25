import { App, Stack } from "aws-cdk-lib";
import { resolve } from "node:path";

import { createSystem } from "./system.js";

const PRIMARY_REGION = "eu-west-2";
// ACM certificates attached to CloudFront must live in us-east-1.
const CLOUDFRONT_CERT_REGION = "us-east-1";

const app = new App();

// Both ends of a cross-region ref must opt in, so every stack sets the flag.
const stackProps = (region: string) => ({
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
  crossRegionReferences: true,
});

const dnsStack = new Stack(app, "JasonDuffettNetDnsStack", {
  ...stackProps(PRIMARY_REGION),
  description: "DNS for jasonduffett.net (Route 53 hosted zone + records).",
});

const certStack = new Stack(app, "JasonDuffettNetCertStack", {
  ...stackProps(CLOUDFRONT_CERT_REGION),
  description: "ACM certificate for jasonduffett.net.",
});

const siteStack = new Stack(app, "JasonDuffettNetSiteStack", {
  ...stackProps(PRIMARY_REGION),
  description: "jasonduffett.net — static site on CloudFront + S3.",
});

const siteContentPath = resolve(import.meta.dirname, "..", "..", "site", "dist");

createSystem({ dnsStack, certStack, siteStack }, siteContentPath).build(app, "App");

app.synth();
