# `@jasonduffett-net/cdk`

AWS CDK app that owns the domain, DNS, certificate, CDN, S3 bucket, alarms,
and CI deploy role for [jasonduffett.net](https://jasonduffett.net).

This is the **worked composureCDK example** that the rest of the repo exists
to demonstrate. It composes one logical "system" out of independent builders
and routes those builders across five CloudFormation stacks (two regions) so
the whole thing deploys as one `cdk deploy --all`.

## Composition map

The composition lives in [`src/system.ts`](./src/system.ts) under the single
`compose(builders, deps)` call. Three concepts you'll keep meeting:

- **`ref<T>("name")`** — a lazy reference to another builder's result. The
  value is resolved at build time, so `cert: ...validationZone(hostedZone)`
  works even though the zone hasn't been created yet at the point you write
  it. References make cross-builder wiring declarative — you don't have to
  hand-order anything.
- **Dependency block** (the second argument to `compose()`) — an explicit
  declaration of which builders depend on which. composureCDK uses it to
  topologically order builds and to attach cross-stack references when a
  dependency lives in a different stack.
- **`.withStacks(...)` + `.afterBuild(...)`** — `withStacks()` decides which
  Stack each builder is added to (used here to keep the cross-region graph
  acyclic). `afterBuild()` runs after every builder has produced its result;
  it's where you register stack outputs, override CFN logical IDs, or apply
  cross-cutting wiring like alarm-action policies.

## File map

| File                                                           | Role                                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/app.ts`](./src/app.ts)                                   | Entry point. Builds the `App`, the five stacks, and the CI OIDC stack. Top-of-file `CONFIG` is the only place to edit when forking.                               |
| [`src/system.ts`](./src/system.ts)                             | The composition root — the `compose(...)` call that wires every builder.                                                                                          |
| [`src/stacks/ci-oidc-stack.ts`](./src/stacks/ci-oidc-stack.ts) | Standalone OIDC provider + GitHub Actions deploy role.                                                                                                            |
| [`src/redirect-function.ts`](./src/redirect-function.ts)       | The CloudFront viewer-request function source itself: `www`→apex, old-URL 301s, directory→index rewrite. Only the string between the backticks ships to the edge. |
| [`src/redirects.ts`](./src/redirects.ts)                       | Synth-time loader and validator for `redirects.json`. Not deployed to CloudFront.                                                                                 |
| [`src/zone-records.ts`](./src/zone-records.ts)                 | DNS records for the zone (mail, DKIM, verification tokens). Apex and `www` ALIASes are added in `system.ts` because they depend on the CloudFront distribution.   |
| [`redirects.json`](./redirects.json)                           | Map of legacy URL paths → new paths. Compiled into the CloudFront Function at synth time, after validation by `src/redirects.ts`.                                 |
| [`scripts/`](./scripts/)                                       | Post-deploy operational scripts: redirect verification, smoke test, IndexNow ping.                                                                                |
| [`test/`](./test/)                                             | Vitest snapshot tests + functional assertions. Snapshots are committed and reviewed in PRs.                                                                       |

## Stack architecture

See the [top-level README](../../README.md#stacks) for the prose walkthrough
and the architecture diagram.

## Adapting for your domain

Most of the repo only knows your domain through the `CONFIG` object at the
top of [`src/app.ts`](./src/app.ts):

```ts
const CONFIG = {
  domain: "jasonduffett.net",
  githubOwner: "laazyj",
  githubRepo: "jasonduffett.net",
  primaryRegion: "eu-west-2",
  edgeRegion: "us-east-1",
} as const;
```

To fork:

1. Edit `CONFIG`.
2. Replace the records in [`src/zone-records.ts`](./src/zone-records.ts) with
   your own subdomain records (mail provider, DKIM, verification tokens, …).
3. Replace [`redirects.json`](./redirects.json) with your own legacy-URL map
   (or empty `{}` if you don't have one).
4. The CDK stack ids hardcode the original domain (e.g.
   `JasonDuffettNetSiteStack`) — rename them only if you don't want to inherit
   the deployed-stack identities. Logical-id stability is intentional; see the
   `HOSTED_ZONE_LOGICAL_ID` comment in `src/system.ts`.

The budget alarm threshold (4 USD/month) is set in
[`src/system.ts`](./src/system.ts); raise or lower it for your traffic shape.

## Tests

```sh
npx nx run @jasonduffett-net/cdk:test
```

Two test files:

- [`test/app.test.ts`](./test/app.test.ts) — synthesises every stack, snapshots
  the CloudFormation, and adds functional assertions for invariants that
  must hold regardless of refactors (OIDC trust policy, certificate SANs,
  budget limit, alarm coverage).
- [`test/redirects.test.ts`](./test/redirects.test.ts) — validates the shape
  of [`redirects.json`](./redirects.json) at build time, so bad data fails
  the test rather than reaching the deployed CloudFront Function (which
  has a sub-millisecond CPU budget per request).

After intentional infra changes, regenerate snapshots with
`npx nx run @jasonduffett-net/cdk:test -- -u`.

## Linting and formatting

Inherits the root ESLint and Prettier configs. Run `npm run lint` /
`npm run format:check` from the repo root.

## See also

- [Top-level README](../../README.md) — quickstart, deploy, CI bootstrap.
- [composureCDK](https://github.com/laazyj/composureCDK) — the framework this package showcases.
