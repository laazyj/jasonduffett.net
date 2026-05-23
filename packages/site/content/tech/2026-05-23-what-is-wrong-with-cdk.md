---
title: "Your infrastructure isn't an app. So why is your CDK?"
date: 2026-05-23
summary: "The CDK gave us a real programming language for AWS infrastructure, then taught us to write a program that builds it — instead of a value that simply describes it. A look at the one design choice behind CDK's most familiar frustrations."
tags:
  - aws
  - cdk
  - infrastructure-as-code
---

If you build anything on AWS, you almost certainly reach for the CDK — and you're right to. It gave us a real programming language where we used to have pages of YAML, and that was a genuine leap forward: types, loops, functions, the ability to factor out a pattern once and use it everywhere. I've shipped a lot of CDK. I'm not here to tell you to stop.

I'm here to point at something the CDK decided on our behalf — so quietly that most of us never noticed we'd agreed to it.

Here's a bucket, a queue, and a function that reads from both. Utterly ordinary CDK:

```typescript
export class OrdersStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const uploads = new Bucket(this, "Uploads", {
      encryption: BucketEncryption.S3_MANAGED,
    });
    const events = new Queue(this, "Events");

    const handler = new Function(this, "Handler", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromAsset("dist"),
      environment: { BUCKET: uploads.bucketName, QUEUE: events.queueUrl },
    });

    uploads.grantReadWrite(handler);
    events.grantConsumeMessages(handler);
  }
}
```

Read it and it looks like a _description_ — three resources and the relationships between them. It isn't. It's a _program_. `new Bucket(...)` doesn't describe a bucket; it constructs one, as a side effect of existing. `grantReadWrite` doesn't note a relationship; it runs, and mutates. By the time synthesis finishes, the description is gone — it only ever existed for as long as the program was running. What you're left with is the exhaust: a pile of generated CloudFormation.

That's the thing. Your infrastructure is a _value_ — a graph of resources and how they relate. Your CDK is an _app_ that builds that value and then throws it away. We say so out loud, in the docs and the CLI: a "CDK app." Nobody blinks.

<figure class="post-figure">
  <img
    src="{{ '/assets/your-infrastructure-as-an-app.webp' | rel }}"
    alt="Cartoon hand holding a phone running infragram, a made-up social app for cloud infrastructure: an S3 bucket, an SQS queue and a Lambda function shown as likeable feed posts, above a big orange Deploy button."
    width="1693"
    height="929"
    decoding="async"
  />
  <figcaption>Infrastructure-as-an-app, taken at its word.</figcaption>
</figure>

You might think the fix is to climb back down a level — fewer abstractions, more honesty, just write the data. It isn't. YAML _is_ the data, and YAML is miserable: no types, no reuse, no way to say "all my buckets look like this." The CDK was right to hand us a language. The mistake was never the language. It's that we use it to write a program that _runs_, when we could use it to describe a value that simply _is_.

Once you see that, you start noticing the seams everywhere: the props threaded down through five constructors, the stacks you can't split without a fight, the base class you extended because there was nowhere else to put the behaviour. None of those are the disease. They're symptoms of the same one — an app pretending to be a description.

This post is about that one idea. The cure can wait for another day; first I want to convince you there's something worth curing.

<!-- =====================================================================
SKELETON / WORKING NOTES (not for publication — delete before shipping)

Framing locked: MANIFESTO, generous to CDK, diagnosis-not-catalogue.
Audience = CDK-on-AWS engineers, pain-agnostic. Indict the model, never
the reader. Emotional arc: recognition -> relief -> curiosity.
Keep composureCDK powder dry — tease only at the end.

---------------------------------------------------------------------
SECTION 2 — THE DIAGNOSIS (one disease, many symptoms)
---------------------------------------------------------------------
Goal: show that the familiar complaints are all symptoms of "describe =
construct" (eager construction). NOT a listicle.

- Open where everyone looks: the Stack. The endless "how many stacks /
  where to split / how to pass a value across them" debate. Note the
  community has been debugging the wrong layer — that fixation is itself
  the tell.
- Pull the camera back: it's not the Stack, it's EVERY construct. A
  construct's constructor does work (registers with scope, mutates the
  tree). To describe is to construct; there is no inert value to hold,
  pass, diff, or compose before things happen.
- ANCHOR EXAMPLE: prefer a NON-Stack construct pair wired together
  inside a single stack — proves the disease isn't a deploy-boundary
  quirk before a reader can dismiss it as one. Then scale it up to show
  the props-drilling / cross-stack version everyone already complains
  about.
- Walk the symptoms back to the one root:
    * props-drilling / wiring (relay refs down the tree; worst across
      stacks where it degrades into Fn::ImportValue deadlocks)
    * inheritance / extends Construct|Stack; L3 libraries as subclass
      towers; "ever-growing props"
    * implicit dependency graph (deps derived from references, never
      declared; manual addDependency)
    * StackA/StackB config-only duplication (variants expressed as code,
      not data)
    * no prescriptive structure — CDK is a library, not a framework;
      `cdk init` gives layout, not architecture. The recommended path
      (AWS docs) and the paved path (templates/defaults) diverge, so the
      path of least resistance wins.
    * defaults are INCONSISTENT, not best-practice (precise claim — NOT
      "insecure"; some L2s are secure-ish; you need cdk-nag to know
      which).
- Land it: these aren't user mistakes. The tool's defaults and templates
  pull you here. (Sets up Section 4: a way that makes the recommended
  path the paved path.)

CITATIONS: verify each one first-hand (live + on-thesis) before using.
Several search hits were stale/wrong/counter-productive (aws-cdk#21696
closed as intentional; Lloyd McKie blog dead; garbe.io "write less code"
advocates the pattern we argue against). Re-vet before citing anything.

---------------------------------------------------------------------
SECTION 3 — IT COULD BE WORSE
---------------------------------------------------------------------
Job: buy credibility by being fair, then exhale with comedy.

- Credit CDK sincerely as a real leap past raw CloudFormation YAML/JSON
  (no types, no reuse, stringly-typed !Ref/!GetAtt).
- HONESTLY CONCEDE the things NO CDK-based tool escapes (Class A):
  CloudFormation is slow; logical-ID churn deletes resources on rename;
  synthesis isn't pure (fromLookup / context). composureCDK inherits
  these — say so. The integrity is the point.
- The jsii / Java-CDK comedy: the abomination is load-bearing, not
  accidental. CDK is authored in TypeScript and machine-translated via
  jsii, so Java CDK is TypeScript in a Java costume — Builder().build()
  towers because Java has no keyword args. Verify the jsii detail before
  publishing.

---------------------------------------------------------------------
SECTION 4 — A DIFFERENT SHAPE (teaser, powder dry)
---------------------------------------------------------------------
- One idea only, not a feature list. Don't name the package list or the
  defaults machinery — that's articles 2+.
- The idea: a system is a VALUE — a flat map of named components, with
  dependencies declared as DATA, assembled by a runtime. Description and
  construction finally become two different things.
- Lineage hook: Stuart Sierra's Component (Clojure). Fresh angle — most
  CDK criticism comes from a Terraform/ops direction; this comes from
  functional dependency-injection-as-data. Built ON CDK, keeps the
  ecosystem (one disarming sentence vs "isn't this just Pulumi?").
- End on curiosity, set up the series.
===================================================================== -->
