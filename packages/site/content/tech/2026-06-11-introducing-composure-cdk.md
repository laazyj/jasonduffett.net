---
title: "Lose the constructs. Keep your composure."
date: 2026-06-11
ogImage: "/assets/og-keep-your-composure.jpg" # TODO: generate OG image
# SUMMARY TODO — lead with "CDK" for discoverability; the title carries no
# subject keyword by design (see title discussion). One sentence on: a flat map
# of components + fluent builders = infrastructure you describe, not a program
# you run; why that matters more, not less, when an agent writes the code.
summary: "TODO"
tags:
  - aws
  - cdk
  - infrastructure-as-code
  - composurecdk
  - coding-agents
  - agentic-coding
  - vibe-coding
  - ai-assisted-development
---

<!--
SKELETON — article 2 of the composureCDK series. Body below is beats, not prose.
Structure (example-first): §1 intro + the app.ts snippet shown cold; §2 names the
shapes (compose / builder / ref), pointing back at the code; §3 close-reads the
example; §4 the "an agent writes my CDK" turn; §5 conclusion + teasers; references.
Decisions locked with Jason:
  - Anchor example = a simplified single-stack cut of this site's `system.ts`
    (no withStacks / cross-region; dropped alerts, budget, alarm wiring).
  - Snippet uses inline transform-shorthand refs with NO type hints — chosen for
    conciseness to demonstrate the model; compiles under a relaxed tsconfig; the
    type-safety angle is deferred to a later article.
  - Defaults are a later article — keep them a forward-reference here, don't sell.
  - Article-1 teaser shape (config-objects, reads:/consumes:) was DIRECTIONAL;
    acknowledge lightly, don't dwell — the real API is fluent builders.
  - Keep composureCDK powder dry: tease, don't dump (extensibility -> issue #49).
Source refs (../composureCDK):
  - docs/architecture.md — Lifecycle, Builder, compose, Ref (definitive)
  - packages/cdk/src/system.ts — the live anchor (this site), trimmed into the snippet
-->

## 1. A better way, by example

In [Your infrastructure isn't an app. So why is your CDK?](/tech/what-is-wrong-with-cdk/)
I argued that CDK's most familiar frustrations all trace back to one design choice.
Think of the props threaded through five constructors, the stacks you can't split
without a fight, the base class you extended because there was nowhere else to put
the behaviour. They're symptoms of one cause: a Construct builds itself in its
constructor, so to _describe_ your infrastructure you have to run a program that
_constructs_ it. There's no plain value you can read, diff, or hand to a colleague.

This post is about the way out, and it doesn't ask you to leave CDK behind.
**[composureCDK](https://github.com/laazyj/composureCDK)** keeps the language, the
L2 constructs, and the whole ecosystem. It changes only the part I wanted to change:
how you describe the system before any of it runs. You get the conciseness of a
declarative structure and the clarity of explicit dependencies, in a project that
still reads as CDK to anyone who already knows CDK.

Enough hand-waving. Here's a whole system as a single value. It stands up a small
website: an S3 bucket behind a CloudFront distribution, an ACM certificate, Route 53
DNS, and a health check to confirm the thing's actually up. It's a trimmed-down cut
of the CDK that ships this very page, so it's not a toy
([source](https://github.com/laazyj/jasonduffett.net/blob/main/packages/cdk/src/system.ts)):

```typescript
// app.ts
compose(
  // Components — a flat map of named builders.
  {
    // DNS
    zone: createHostedZoneBuilder().zoneName(domain),
    aliasRecords: zoneRecords([
      ALIAS("@", cloudfrontAliasTarget(ref("cdn", (d) => d.distribution))),
      ALIAS("www", cloudfrontAliasTarget(ref("cdn", (d) => d.distribution))),
    ]).zone(ref("zone", (z) => z.hostedZone)),

    // Certificate — DNS-validated against the zone
    cert: createCertificateBuilder()
      .domainName(domain)
      .subjectAlternativeNames([www])
      .validationZone(ref("zone", (z) => z.hostedZone)),

    // Site
    bucket: createBucketBuilder(),
    cdn: createDistributionBuilder()
      .domainNames([domain, www])
      .certificate(ref("cert", (c) => c.certificate))
      .defaultRootObject("index.html")
      .origin(ref("bucket", (b) => S3BucketOrigin.withOriginAccessControl(b.bucket)))
      .defaultBehavior({ viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS }),
    deploy: createBucketDeploymentBuilder()
      .sources([Source.asset("../site/dist")])
      .destinationBucket(ref("bucket", (b) => b.bucket))
      .distribution(ref("cdn", (d) => d.distribution))
      .distributionPaths(["/*"]),

    // Uptime health check on the public apex
    health: createHealthCheckBuilder().type(HealthCheckType.HTTPS).fqdn(domain),
  },
  // Dependencies — as data.
  {
    zone: [],
    aliasRecords: ["zone", "cdn"],
    cert: ["zone"],
    bucket: [],
    cdn: ["bucket", "cert"],
    deploy: ["bucket", "cdn"],
    health: [],
  },
).build(stack, "Site");
```

## 2. The shapes

<!-- The reader has now SEEN these in the snippet above — name them, point back
     to the code. Three shapes, kept to what the reader uses. -->

### compose — a system is a value

- `compose({ components }, { deps })`: a flat map of named components + a second
  map declaring each one's dependencies as data.
- No `new`, no `this`, no constructor side-effects. The description IS a value.
- The deps map is the thing article 1 said CDK never lets you write.
- Eager validation: cycles throw `CyclicDependencyError` at compose time, not
  build/synth time. (Plant this — §3 pays it off against article 1's bug.)

### The fluent builder — intent, not mutation

- `createXBuilder().a().b()`: reads as a declaration; small, discoverable surface;
  only the values you care about need stating (see the bare `createBucketBuilder()`).
- The builder fills in sensible config for you — but that's its own pillar; the
  deep-dive is a later post (keep powder dry).
- (Builder mechanics — Proxy, IBuilder type, .copy() — NOT for this article.)

### ref — lazy wiring

- `ref("name", (r) => r.prop)`: a reference to a value a sibling produces at build
  time, resolved in dependency order — the wiring sits right at the call site (see
  the snippet's `.origin(...)`, `.certificate(...)`, alias records).
- This is how cross-component wiring stays declarative instead of post-build glue.
- (Typed `.get()` / `.map()` forms + the type-safety story — later article.)

## 3. Walkthrough — reading the example

<!-- Close-read the app.ts above. The "it's really this site" framing now lives
     in the §1 intro. -->

- Dependencies are readable at a glance in the deps map — contrast article 1's
  "spread over 3 files, hunt for method calls."
- `ref("name", (r) => r.prop)` doing the wiring at the call site — bucket ->
  origin, cert -> cdn, distribution -> alias records.
- The bare `createBucketBuilder()` already gives a well-configured bucket —
  _less code, more architecture_ (the defaults story is its own later post).
- **Eager cycle detection** — callback to article 1's cyclic-reference bug: the
  same mistake that died at synth with a cryptic error is now a compose-time
  `CyclicDependencyError`, before anything builds.
- OPTIONAL, light: one line that stack-routing exists (`withStacks`) and pays off
  article 1's stack-splitting fight — deep-dive deferred. Drop if it bloats.

## 4. "But an agent writes my CDK anyway"

<!-- The turn. Counterintuitive hook: if a machine writes it, surely legibility
     matters LESS? Exactly backwards. Three claims, each cited. -->

- Hook: the vibe-coding objection, stated fairly, then inverted.

- **Claim 1 — Locality / reduced indirection.** An agent reasons over a bounded
  context window. Props threaded through five constructors + deps inferred from
  scattered method calls force it to reassemble the picture from fragments —
  the exact surface where it drifts. composureCDK keeps the whole description
  local: one value, one place.
  <!-- CITE: dasroot, "Code for the AI Reader: Redesigning Architecture for the
       LLM Era" — https://dasroot.net/posts/2026/05/code-for-ai-reader-redesigning-architecture-llm-era/
       VERIFY FIRST-HAND before citing (memory: verify-citations-first-hand). -->

- **Claim 2 — Patterns compound.** Agents build on what already exists. An
  inheritance-tower codebase trains the agent toward more inheritance towers;
  problems inherent in the model amplify with every generated change. A flat map
  is a smaller surface to drift on.

- **Claim 3 — The spec is enforced at the call site.** The deps map + typed
  `ref` ARE the spec; a wrong wire is a compose-time error, not a silent
  deploy-time surprise. Rhymes with the ts-fake "coding agents" note (the type
  signature is the spec, enforced at the call site, agents can't drift).
  <!-- Reuse the §3 cyclic-error callback as the concrete instance. -->

- Land it: composure isn't nostalgia for human-readable code — it's what makes
  the codebase agent-tractable. The declarative shape matters MORE in this world.

## 5. Conclusion + what's next

- One-line restatement of the shift: from a program that BUILDS a description to
  a description you READ, diff, and hand off — and why that holds up under an
  agent's hands.
- Teasers (powder dry):
  - Extensibility / custom builders / AWS CDK Mixins as external validation — issue #49.
  - Secure-by-default, following AWS Well-Architected — "defaults should be correct."

## References

<!-- Curated, first-hand-verified per memory rule. WebFetch each + confirm
     on-thesis before it goes in. Offer: run /deep-research to vet this list and
     surface stronger academic anchors on LLM code comprehension / locality. -->

- dasroot — "Code for the AI Reader: Redesigning Architecture for the LLM Era" (TODO verify)
- AWS — "Announcing AWS CDK Mixins" (validation that the construct model doesn't compose) (TODO verify)
- Stuart Sierra — Component (Clojure), the lineage for compose (carry-over from article 1)
- TODO: academic anchors on LLM code comprehension / locality / indirection
