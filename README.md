# jasonduffett.net

Monorepo for `jasonduffett.net` — infrastructure and blog.

## Packages

- `packages/cdk` — AWS CDK app managing the domain, DNS, and site hosting (CloudFront + S3).
- `packages/site` — Eleventy-built blog and landing site.

## Site — develop locally

```sh
npm run site:start     # hot-reload dev server at http://localhost:8080
npm run site:build     # write ./packages/site/dist
```

Posts live under `packages/site/content/tech/` or `packages/site/content/music/` as
Markdown; layout and permalink come from each directory's `*.json` data file.

Set `GA_MEASUREMENT_ID` at build time to enable Google Analytics 4 and the cookie
consent banner; leave it unset to ship the site without any analytics. See
`packages/site/.env.example`.

## Scripts

Nx orchestrates all per-package work (build/test/typecheck/clean) and caches results. The
root `npm run` scripts below delegate to Nx — prefer them over invoking workspace scripts
directly so you benefit from the task graph and cache.

Cross-cutting:

- `npm run build` — build all packages.
- `npm run typecheck` — typecheck all packages.
- `npm test` — run tests across all packages.
- `npm run clean` — remove build outputs across all packages.
- `npm run lint` / `npm run lint:fix` — ESLint across the repo.
- `npm run format` / `npm run format:check` — Prettier across the repo.
- `npm run verify` — format check, build, lint, and test (CI parity).

Site (`site:*`):

- `npm run site:start` / `npm run site:build` / `npm run site:clean`.

CDK (`cdk:*`) — each runs build + site build first via Nx's task graph:

- `npm run cdk:synth` — render CloudFormation for all stacks.
- `npm run cdk:diff` — preview changes for all stacks.
- `npm run cdk:deploy` — deploy **all** stacks. Default for simplicity; review the
  per-stack snapshot diffs under `packages/cdk/test/__snapshots__/` first.
- `npm run cdk:deploy:stack -- <StackName>` — escape hatch for a single stack
  (e.g. `npm run cdk:deploy:stack -- JasonDuffettNetDnsStack`).
- `npm run cdk:test` — run cdk unit + snapshot tests.
- `npm run cdk:test:update` — regenerate snapshots after intentional infra changes.

### Stacks

The CDK app is a single top-level `compose()` routed across five CloudFormation stacks:

- **`JasonDuffettNetDnsStack`** (`eu-west-2`) — Route 53 hosted zone + all DNS records
  (A, CNAME, MX, TXT). Route 53 is a global service; the region choice is cosmetic.
- **`JasonDuffettNetCertStack`** (`us-east-1`) — ACM certificate for apex + www, DNS-validated
  against the hosted zone. `us-east-1` is an AWS requirement for certificates attached to
  CloudFront.
- **`JasonDuffettNetSiteStack`** (`eu-west-2`) — S3 bucket, CloudFront distribution,
  CloudFront Function (`www`→apex + old-URL 301s), bucket deployment of the Eleventy
  output, apex/www alias records, and an SNS topic collecting site-region alarm
  notifications.
- **`JasonDuffettNetUsEast1AlertsStack`** (`us-east-1`) — SNS topic shared by every
  us-east-1 alarm (cert + CloudFront). Standalone with no downstream deps so any
  us-east-1 stack can target it without creating a cycle.
- **`JasonDuffettNetCdnAlarmsStack`** (`us-east-1`) — CloudFront CloudWatch alarms.
  CloudFront metrics only emit in `us-east-1`, so the alarms must live there too.
  Kept separate from the cert stack to avoid a `cdn ↔ cert` cycle (alarms read the
  distribution id from the site stack, which depends on the cert stack).

Every stack opts in to `crossRegionReferences: true`, which lets CDK auto-generate the
SSM-parameter + custom-resource plumbing for cross-region edges (`zone → cert`,
`cdn → cdnAlarms`, `*alerts → alarmActions`). Deployment order is inferred automatically
from these references, so no `addDependency` calls are needed.

### One-off scripts

```sh
npm run site:smoke              # post-deploy smoke (homepage, feed, sitemap, sample, 404, www→apex)
npm run site:check-redirects    # validate live 301s match redirects.json
```

CI runs both after every deploy. They're exposed as root scripts for ad-hoc runs.

`redirects.json` is committed and derived from each post's `originalUrl` frontmatter; there
is no regeneration step. Run `check:redirects` after a deploy (or against any `BASE_URL`)
to confirm CloudFront returns the expected 301s.

To target a single package or run only affected projects, use Nx directly:

```sh
npx nx run @jasonduffett-net/cdk:test   # one project, one target
npx nx affected -t build test lint       # only projects touched since main
npx nx graph                             # open the task/dependency graph
```

## Deploying

Pushes to `main` deploy automatically — see [Continuous deployment](#continuous-deployment)
below. The manual flow here is the fallback for emergencies or first-time bootstrap.

The CDK app uses the standard `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` environment
variables, plus `ALERT_EMAIL` (the address subscribed to both alarm topics — synth fails
if it is unset). Authenticate with the target AWS account first (e.g.
`aws sso login --profile jasonduffett.net`, then `export AWS_PROFILE=jasonduffett.net`
for the rest of the shell), then:

```sh
export ALERT_EMAIL=you@example.com
export GA_MEASUREMENT_ID=G-XXXXXXXXXX
npm run site:build   # build site content
npm run cdk:synth    # render CloudFormation
npm run cdk:diff     # preview changes
npm run cdk:deploy   # apply (all stacks)
```

After the first deploy, AWS sends one confirmation email per topic (us-east-1 and
eu-west-2). Click both confirm links — alerts only flow once the subscriptions are in
the `Confirmed` state.

Each of these builds the CDK package and the site first via Nx's task graph (cached when
inputs are unchanged). To deploy a single stack:

```sh
npm run cdk:deploy:stack -- JasonDuffettNetSiteStack
```

### Reviewing infra changes

`packages/cdk/test/system.test.ts` snapshots the synthesised CloudFormation for every
stack. Any change that affects the templates (DNS records, alarm thresholds, distribution
config) shows up in the snapshot diff in the PR. If you intend the change, regenerate
with `npm run cdk:test:update`. If you don't, you have a regression.

### First-time setup

A new AWS account needs `cdk bootstrap` run once per region the app deploys into. This
app spans two regions, so bootstrap both. `cdk bootstrap` requires either a `cdk.json` in
the working directory or an explicit `aws://ACCOUNT/REGION` env URI — the snippet below
uses the explicit form so it works from the repo root:

```sh
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$ACCOUNT/eu-west-2   # DNS + Site stacks
npx cdk bootstrap aws://$ACCOUNT/us-east-1   # Cert stack (CloudFront requirement)
```

## Continuous deployment

`main` auto-deploys via GitHub Actions:

- **`.github/workflows/pr.yml`** — runs on every PR: lint, format, build, test, plus
  `cdk diff` posted as a comment so infra changes are visible at review time.
- **`.github/workflows/deploy.yml`** — runs on push to `main`: full verify, fresh
  `site:build` (with `GITHUB_SHA` baked into a `<meta name="build-sha">` tag),
  `cdk deploy --all`, post-deploy smoke test (`packages/cdk/scripts/smoke-test.mjs`),
  redirect compatibility check, and IndexNow ping. A failure on any step fails the
  workflow; GitHub emails the repo owner by default.

Both workflows authenticate to AWS via OpenID Connect — there are no long-lived AWS
keys in GitHub. The OIDC provider and the deploy role are managed as a CDK stack
(`JasonDuffettNetCiOidcStack`) so the trust policy lives in source control.

### CI bootstrap (one-time)

After the standard `cdk bootstrap` in [First-time setup](#first-time-setup), deploy the
OIDC stack locally:

```sh
ALERT_EMAIL=you@example.com npm run cdk:deploy:stack -- JasonDuffettNetCiOidcStack
```

The stack outputs `GitHubActionsDeployRoleArn`. Configure GitHub:

- **Repository secrets** (Settings → Secrets and variables → Actions → Secrets):
  - `AWS_DEPLOY_ROLE_ARN` — the role ARN from the stack output.
  - `ALERT_EMAIL` — same address used for the alarm topics.
  - `INDEXNOW_KEY` — the IndexNow key (matches `packages/site/static/<key>.txt`).
- **Repository variables** (same page → Variables tab):
  - `GA_MEASUREMENT_ID` — `G-XXXXXXXXXX` (public; not a secret).
- **Branch protection on `main`** (Settings → Branches): require a pull request before
  merging and require the `verify` status check to pass.

The deploy role's trust policy is restricted to `repo:laazyj/jasonduffett.net:*` — forks
run workflows under their own OIDC namespace and cannot assume the role, so making the
repository public does not expand who can deploy.

## Domain delegation

The `jasonduffett.net` is registered with [FastHosts](https://admin.fasthosts.co.uk/DomainNames/3867580/). To update the name servers of the zone:

1. Read the new name servers from the stack output:

   ```sh
   aws cloudformation describe-stacks \
     --stack-name JasonDuffettNetDnsStack \
     --query "Stacks[0].Outputs[?OutputKey=='NameServers'].OutputValue" \
     --output text
   ```

2. At the registrar ([FastHosts](https://admin.fasthosts.co.uk/DomainNames/3867580/)), replace the
   existing NS records with the Route 53 name servers from step 1.

3. Wait for propagation (a few minutes to a few hours). Verify with:

   ```sh
   dig +short NS jasonduffett.net
   ```
