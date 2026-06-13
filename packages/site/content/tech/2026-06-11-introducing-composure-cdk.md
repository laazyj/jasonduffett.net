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
Structure (example-first): §1 intro + the app.ts snippet shown cold; §2 walkthrough
close-reads the example, surfacing the shapes as it goes; §3 names the shapes
(compose / builder / ref); §4 the "an agent writes my CDK" turn; §5 conclusion +
teasers; references.
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

## 2. Walkthrough — reading the example

The first thing you notice is that this is a clear declaration of the system's
infrastructure: no misdirection, and no need to trace through levels of constructs
to grasp the high-level architecture. It declares the DNS zone (`zone`) and records
(`aliasRecords`), the site's certificate (`cert`), its asset store (`bucket`),
distribution (`cdn`), deployment (`deploy`), and health checker (`health`) right
there in front of you. You also see each component's _dependencies_ laid out as a
second map.

Each of those components is a [_Lifecycle_](#lifecycle): composure's minimal
contract for something that can be built. [`compose`](#compose) takes the map of
named Lifecycles, together with the dependency map, and assembles them into a
single Lifecycle of its own. That's why _Lifecycle_ is the spine of the composure
architecture — because a composed system is itself a Lifecycle, systems nest as
components inside larger systems.

The second thing you'll notice (I'm guessing) is the [_Builders_](#builder).
Composure uses the [Builder Pattern](https://en.wikipedia.org/wiki/Builder_pattern)
to express the underlying CDK constructs. This has many advantages, but most
importantly it separates the _declaration_ of a component's configuration from the
_construction_ of the component itself.

And finally, you'll notice the [`ref`](#ref) that glues components to their
dependencies.

For this simplified example, I've pushed everything into a single Stack. We'll talk
more about Stack management in a future article.

Now let's drill down into the four core shapes we've identified.

## 3. The shapes

<!-- The walkthrough surfaced these. Four shapes: Lifecycle (the contract) +
     compose / builder / ref (how you use it). Beats, not prose — the Lifecycle
     entry reads fuller because the walkthrough links straight to it. -->

<a id="lifecycle"></a>

### Lifecycle — good posture, by design

**Lifecycle** is the contract every component implements: a single
`build(scope, id, context)` method that creates its CDK constructs and hands them
back. It is deliberately minimal — one method, no base class to extend, no
`super()` to call; a component is anything with a matching `build`.

```typescript
interface Lifecycle<T, Context> {
  build(scope: IConstruct, id: string, context?: Context): T;
}
```

<a id="compose"></a>

### compose — a system is a value

`compose` assembles components (which are _Lifecycles_) into a system - itself also a _Lifecycle_.

When compose is called, it:

1. Builds a directed acyclic graph from the dependency declarations.
2. Validates that the graph has no cycles. If a cycle is found, a `CyclicDependencyError` is thrown immediately.
3. Returns a new _Lifecycle_ whose build method topologically sorts the graph and builds each component in dependency order, passing the resolved outputs of its dependencies as context.

The _eager validation_ is a big win for CDK projects. Catching cyclic references in
this way surfaces errors earlier and with better context for diagnostics compared to
catching them at synthesis time.

Because the composed system returned by `compose` is also a _Lifecycle_, it can also
be used as a component in a larger system. Composition is recursive — systems can be
nested without special handling.

```typescript
function compose<Components extends Record<string, Lifecycle>>(
  components: Components,
  dependencies: { [Property in keyof Components]: Dependency<Components> },
);
```

<a id="builder"></a>

### The fluent builder — intent, not mutation

The builder pattern provides a fluent API for configuring components. It is a separate concern from _Lifecycle_ — a component does not need a builder to work, and the builder does not need to know about composition. But it does provide quite a number of benefits to us:

- The API surface is more discoverable than a large tree of nested props: after each `.`, the IDE offers the next valid option with its documentation inline, so you configure a resource by autocompletion instead of having to know the shape of a deeply nested props object up front.
- It can enforce constraints between props (e.g. mutual exclusivity).
- It provides the extensibility required to meet another of Composure's core value propositions - secure and operationally sound defaults (more on this in a later article)

To avoid duplicating the entire `aws-cdk-lib` API surface, _Builders_ are declared as proxies
over their underlying construct's props. This provides a small footprint to adapt the
out-of-the-box CDK construct that automatically inherits the functionality
available in whatever peer aws-cdk-lib version your system uses.

```typescript
// 1. Define the props type (often an alias for the CDK props)
type FunctionBuilderProps = lambda.FunctionProps;

// 2. Define the build result
interface FunctionBuilderResult {
  function: lambda.Function;
}

// 3. Implement the class with Lifecycle and a props field
class FunctionBuilder implements Lifecycle<FunctionBuilderResult> {
  props: Partial<FunctionBuilderProps> = {};

  build(scope: IConstruct, id: string): FunctionBuilderResult {
    return {
      function: new lambda.Function(scope, id, this.props as FunctionBuilderProps),
    };
  }
}

// 4. Export a factory function
function createFunctionBuilder(): IFunctionBuilder {
  return Builder<FunctionBuilderProps, FunctionBuilder>(FunctionBuilder);
}
```

<a id="ref"></a>

### ref — lazy wiring

_Lifecycle_, _Builder_, and `compose` each solve a distinct problem. But there is a gap between them: **builders are configured before their dependencies are built**. `Ref<T>` lets us capture a reference at configuration time that resolves at build time and its partner `Resolvable<T>` signposts the sites where
a lazy reference can be used.

You can see this in the code snippet where the ACM `CertificateBuilder` has the member
`validationZone(Resolvable<acm.IHostedZone>)`. The system's declaration glues this with a
`ref`. The snippet above uses composure's concise shorthand; annotate the callback parameter
and the same wiring is fully typed:

```typescript
ref("zone", (z: HostedZoneBuilderResult) => z.hostedZone);
```

where:

- `"zone"` is the sibling component, declared as a dependency of `cert` in the dependency map.
- `z` is the result of building zone's _Lifecycle_ (a `HostedZoneBuilderResult` in this case).
- `hostedZone` is an `IHostedZone` prop of `HostedZoneBuilderResult`.

With the parameter annotated, TypeScript checks the transform end to end: `z.hostedZone` must
exist and must satisfy the `Resolvable<acm.IHostedZone>` that `validationZone` expects, so a
mistyped property or the wrong shape is a compile error.
The names you wire with are checked too, in two different ways. A dependency in the second
map is `keyof` the component map, so a typo like `cdn: ["bukcet"]` won't compile. The component
name inside a `ref` is a plain string, resolved when the system is built — so a typo there
fails fast with a clear error at build time, rather than passing silently.

This is how cross-component wiring stays declarative instead of post-build glue.

## 4. "But an agent writes my CDK anyway"

> That's all very nice, Jason, but why do I care? I'm a 100x vibe-coder and agents do
> all my coding!

Fair. So let's assume an agent writes all of it. That makes the case for composure
_stronger_, not weaker.

LLM coding agents like Claude Code are improving at a remarkable pace, but some invariants
in how they work are already clear. They behave like a capable but pressured engineer: they
read _just enough_ to start, then follow whatever patterns they find in the slice of the
codebase they've loaded. It's fast, and in a small field of view it looks good: the local code
is neat and readable. Zoom out, though, and it is often not architecturally sound. Personal
experience and a growing body of research agree the costs land on the maintainability and
coherence of a codebase, for humans and agents alike.

**Problem 1: Limited context.** An agent reasons over a bounded context window and reads only
_just enough_ to start. Tight coupling, like inheritance, and opaque API surfaces (a CDK Construct
is a fine example) force it to drag a swathe of the codebase into context just to understand one
function, diluting the signal it needs with noise. And context is finite: every token spends the
model's
[attention budget](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
and recall degrades as the window fills.

**Problem 2: Patterns compound.** Agents build on what already exists. An
[inheritance tower](https://wiki.c2.com/?DeepClassHierarchies) begets another level; props get
threaded through one more constructor; each session adds a little opacity. Thoughtworks names the
mechanism plainly: drift
["compounds as agents and humans replicate existing patterns, including degraded ones, creating a feedback loop where poor code begets poorer code"](https://www.thoughtworks.com/radar/techniques/architecture-drift-reduction-with-llms).
Whatever your codebase rewards, you get more of.

**Problem 3: Conventions aren't constraints.** The usual defence against all this is a convention:
a comment, a docstring, a line in `CONTRIBUTING.md` that says "register the dependency here." But a
convention is text, and an agent treats it as text: a suggestion it can quietly ignore while still
producing code that compiles and runs. Only something the type system or the build _enforces_ is a
boundary it cannot cross. Leave an illegal state merely discouraged and
[the agent will still write code that reaches it](https://aipatternbook.com/make-illegal-states-unrepresentable);
make that state unrepresentable and the option is gone.

> Ok, yeah. But how does ComposureCDK help?

**It's declarative, not imperative.** A `compose` system is _declared_: every component, and every
dependency, laid out as data in one place. The agent gets the high-level architecture
without spelunking through constructors to reconstruct it. Research comparing a declarative
vs imperative user interface with computer-use agents measured a [67% jump in success rate and a 43.5% drop in error-prone interaction steps](https://arxiv.org/abs/2510.04607). Describe the
_what_ instead of a program that builds it, and there's far less for the agent to get wrong.

**It's local and loosely coupled.** The whole description lives in one value, so there's less to
assemble in-context and less to hallucinate when it can't. A component's coupling is spelled out in
the dependency map, not hidden in a constructor, so its context carries more signal and less noise,
and re-use beats duplication. One controlled study found agents on cleaner code used
[7–8% fewer tokens and revisited files 34% less often](https://arxiv.org/abs/2605.20049).

**It enforces, rather than suggests.** A convention can be ignored; the dependency map can't. To
connect one component to another you declare the dependency and reach it through a `ref`. There's no
implicit way to couple them, so coupling stays explicit: if two components are connected, the map
says so.

I'll be honest about the limits. This is a young project, and the long-term claim, that a composure
codebase stays coherent as it grows, is still to prove. And conciseness on its own is no virtue:
agents are good at producing code that _looks_ clean while
[scoring worse on maintainability](https://arxiv.org/abs/2603.13723) (one study saw the
Maintainability Index fall in 56% of agent-refactored commits), and terse code that hides its intent
is worse for an agent, not better. So the win I'm claiming isn't fewer _characters_. It's less
_boilerplate_: stripping out the procedural glue, the constructors and the manual wiring, so a
component's intent is what's left on the page. Fewer states to represent, fewer relationships left
implicit, fewer ways for the next session to drift. The mechanism is already measurable; the
durability is the gamble.

## 5. Conclusion + what's next

- One-line restatement of the shift: from a program that BUILDS a description to
  a description you READ, diff, and hand off — and why that holds up under an
  agent's hands.
- Teasers (powder dry):
  - Extensibility / custom builders / AWS CDK Mixins as external validation — issue #49.
  - Secure-by-default, following AWS Well-Architected — "defaults should be correct."

## References

If you want to go deeper into any of the above topics, or are curious to know more, I
recommend the following links:

- [composureCDK/architecture](https://github.com/laazyj/composureCDK/blob/main/docs/architecture.md)
- [Stuart Sierra's Component framework for Clojure](https://github.com/stuartsierra/component)
- "AI Coding Agents accelerate drift from the intended ... architecture": [Thoughtworks Technology Radar (Apr 2026)](https://www.thoughtworks.com/radar/techniques/architecture-drift-reduction-with-llms)
- [When Agentic Coding Goes Off the Rails (Planet Argon)](https://blog.planetargon.com/blog/entries/when-agentic-coding-goes-off-the-rails) - first point is good, rest ¯\_(ツ)\_/¯
- [Code for the AI Reader: Redesigning Architecture for the LLM Era (dasroot)](https://dasroot.net/posts/2026/05/code-for-ai-reader-redesigning-architecture-llm-era/) - the "indirection tax" and the coupling / signal-to-noise framing behind Problem 1
- [Effective Context Engineering for AI Agents (Anthropic)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - "attention budget" and "context rot"; grounds Problem 1's finite-context claim
- [AI Coding Agents in 2026: Coherence Through Orchestration, Not Autonomy (Apr 2026)](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) - mostly slop
- [Asymmetric Goal Drift in Coding Agents Under Value Conflict (Apr 2026)](https://arxiv.org/pdf/2603.03456) - only lightly related to our problem (context size diluting core values)
- [From Imperative to Declarative: Towards LLM-friendly OS Interfaces for Boosted Computer-Use Agents](https://arxiv.org/abs/2510.04607) - declarative user interfaces
- [Do AI Agents Really Improve Code Readability? (Mar 2026)](https://arxiv.org/pdf/2603.13723)
