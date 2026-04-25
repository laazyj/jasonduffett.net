# jasonduffett.net

Monorepo for `jasonduffett.net` — infrastructure and blog.

## Packages

- `packages/cdk` — AWS CDK app managing the domain, DNS, and site hosting (CloudFront + S3).
- `packages/site` — Eleventy-built blog and landing site.

## Site — develop locally

```sh
npx nx run @jasonduffett-net/site:start     # hot-reload dev server at http://localhost:8080
npx nx run @jasonduffett-net/site:build     # write ./packages/site/dist
```

Posts live under `packages/site/content/tech/` or `packages/site/content/music/` as
Markdown; layout and permalink come from each directory's `*.json` data file.

## Scripts

Nx orchestrates all per-package work (build/test/typecheck/clean) and caches results. The
root `npm run` scripts below delegate to Nx — prefer them over invoking workspace scripts
directly so you benefit from the task graph and cache.

- `npm run build` — build all packages.
- `npm run typecheck` — typecheck all packages.
- `npm test` — run tests across all packages.
- `npm run clean` — remove build outputs across all packages.
- `npm run lint` / `npm run lint:fix` — ESLint across the repo.
- `npm run format` / `npm run format:check` — Prettier across the repo.
- `npm run synth` / `npm run diff` / `npm run deploy` — CDK targets (build runs automatically as a dependency).
- `npm run verify` — format check, build, lint, and test (CI parity).

### Stacks

The CDK app is a single top-level `compose()` of two subsystems (DNS, Site) routed across
three CloudFormation stacks:

- **`JasonDuffettNetDnsStack`** (`eu-west-2`) — Route 53 hosted zone + all DNS records
  (A, CNAME, MX, TXT). Route 53 is a global service; the region choice is cosmetic.
- **`JasonDuffettNetCertStack`** (`us-east-1`) — ACM certificate for apex + www, DNS-validated
  against the hosted zone. `us-east-1` is an AWS requirement for certificates attached to
  CloudFront.
- **`JasonDuffettNetSiteStack`** (`eu-west-2`) — S3 bucket, CloudFront distribution,
  CloudFront Function (`www`→apex + old-URL 301s), bucket deployment of the Eleventy
  output, and an SNS topic collecting recommended alarms from the bucket and
  distribution.

All three stacks opt in to `crossRegionReferences: true`, which lets CDK auto-generate the
SSM-parameter + custom-resource plumbing for the cross-region edge (`zone → cert`).
Deployment order is inferred automatically from these references, so no `addDependency`
calls are needed.

**Cutover pending:** the apex and `www` A records in `ZONE_RECORDS` still point at the
Livemail IP. The CloudFront distribution is provisioned and reachable at its
`*.cloudfront.net` hostname for verification, but is not yet aliased from the zone — that
swap lands in a follow-up PR so this stack can be deployed and exercised without
redirecting end users.

### One-off scripts

```sh
npx nx run @jasonduffett-net/cdk:check:redirects  # validate live 301s match redirects.json
```

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

The CDK app uses the standard `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` environment
variables. Authenticate with the target AWS account first (e.g. `aws sso login`), then:

```sh
npm run synth    # render CloudFormation
npm run diff     # preview changes
npm run deploy   # apply
```

Each of these builds the CDK package first via Nx's task graph (cached when inputs are
unchanged).

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
