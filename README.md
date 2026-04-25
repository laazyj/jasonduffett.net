# jasonduffett.net

Monorepo for `jasonduffett.net` — infrastructure and blog.

## Packages

- `packages/cdk` — AWS CDK app managing the domain, DNS, and hosting infrastructure.
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
unchanged). A first-time account also needs `npx cdk bootstrap` once per account/region.

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
