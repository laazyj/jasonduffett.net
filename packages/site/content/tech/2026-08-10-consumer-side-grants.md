---
title: "Permission granted. Dependency inverted."
date: 2026-08-10
series: composure-cdk
seriesPart: 3
ogImage: "/assets/og-after-you-no-after-you.jpg"
summary: "CDK's grant methods live on the resource, but the policy they write lands on the consumer. That backwards arrow is invisible in a single stack, spreads into every L3 construct you build, and eventually shows up as a circular reference in a template you didn't write. composureCDK declares the grant where the dependency already points."
tags:
  - aws
  - cdk
  - infrastructure-as-code
  - composurecdk
  - iam
  - security
---

{% macro dir(from, to) %}<span class="dir">({{ from }}&nbsp;&rarr;&nbsp;{{ to }})</span>{% endmacro %}
{% macro dirs(from, targets) %}<div class="dir-block"><span>{{ from }}</span><span class="dir-tos">{% for to in targets %}<span class="dir-to">&rarr;&nbsp;{{ to }}</span>{% endfor %}</span></div>{% endmacro %}
{% macro chain(nodes) %}<div class="dir-block">{% for node in nodes %}{% if not loop.first %}<span>&rarr;</span>{% endif %}<span>{{ node }}</span>{% endfor %}</div>{% endmacro %}

<style>
  /* An inline directional arrow between two named things — "(a → b)" — for
     prose that has to keep saying "which way does this point". One small mono
     unit, styled uniformly so both ends and the arrow read as a single object,
     and never wrapped across lines. Local to this article. */
  .dir {
    font-family: var(--mono);
    font-size: 0.86em;
    white-space: nowrap;
  }

  /* Several arrows out of one thing. The source is named once and the targets
     stack beside it, so the fan-out is the shape you see. Accent rule borrowed
     from `article pre` so it reads as a sibling of the code blocks. */
  .dir-block {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-family: var(--mono);
    font-size: 0.86em;
    line-height: 1.45;
    margin: 1.5rem 0;
    padding: 0.15rem 0 0.15rem 1.15rem;
    border-left: 3px solid var(--accent);
  }

  .dir-tos {
    display: flex;
    flex-direction: column;
  }

  .dir-to {
    white-space: nowrap;
  }
</style>

Here is one line of CDK, straight out of AWS's own [best-practices guide](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html):

```typescript
bucket.grants.read(myLambda);

// Or equivalent in earlier aws-cdk-lib versions
bucket.grantRead(myLambda);
```

This single function call adds a policy to the Lambda function's role. You wrote a method call **on the bucket**. It changed **the function**. The bucket is not modified; it is only _read_ — CDK takes its ARN and writes it into an IAM statement on _the function's role_. The function needs the bucket to exist; the bucket has never heard of the function. You wrote {{ dir("bucket", "fn") }} and got {{ dir("fn", "bucket") }}. **The dependency direction has been inverted.**

_A team adopting [composureCDK](https://github.com/laazyj/composureCDK) were surprised by the intentional deviation from CDK's familiar patterns. The explanation is interesting and I felt it was worth an article of its own._

## Why a backwards arrow is more than a nitpick

In one stack, with five resources, nothing bad happens. CDK's synthesiser knows perfectly well which way the true reference runs, emits `Fn::GetAtt` on the bucket inside the role's policy document, and orders the two resources correctly {{ dir("fn", "bucket") }}. The template is right. The inversion lives entirely in your head and in your editor.

But a wrong arrow that never produces a wrong answer is still a wrong arrow — you just stop noticing while it slowly spreads through your code. It spreads in two directions: **up**, into the abstractions you build on top; and **out**, across stack boundaries, where it stops being cosmetic and starts blocking deployments.

### Up: the inversion infects your L3 constructs

AWS is clear about how you're meant to grow a CDK codebase: [model with constructs, deploy with stacks](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html#best-practices-constructs-model) — "represent each logical unit as a Construct, not as a Stack." Good advice. Let's take it, and pull the first article's orders stack down a level into the construct that guidance asks for:

```typescript
// orders/orders-service.ts
export class OrdersService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const uploadBucket = new Bucket(this, "Uploads");
    const eventQueue = new Queue(this, "Events");
    const handlerFn = new Function(this, "Handler", {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromAsset("dist/orders"),
    });

    uploadBucket.grantReadWrite(handlerFn);
    handlerFn.addEventSource(new SqsEventSource(eventQueue));
  }
}
```

Nothing public. Nothing leaks. Encapsulation is correct. This is the shape the guidance asks for, and it's nice while it lasts.

Now the reporting team needs a Lambda that reads the orders bucket. Their function lives in their code, not yours. Somebody has to call `grantRead`, and `grantRead` is a method on _your_ bucket. Three options, and [you've made this choice before](/tech/what-is-wrong-with-cdk/): expose `uploadBucket` as a public field and let the caller grant; hoist the bucket up to the stack, so the service no longer owns the thing that made it a service; or keep the bucket private and let the service do the granting.

Teams usually pick the third: it's the only one that preserves encapsulation, and it looks like ordinary dependency injection. Here's what it looks like a year in.

```typescript
export interface OrdersServiceProps {
  readonly reporting: IGrantable;
  readonly fraudCheck: IGrantable;
  readonly dataLakeExport: IGrantable;
  readonly analyticsCrawler?: IGrantable;
}
```

{{ dirs("OrdersService", ["reporting", "fraudCheck", "dataLakeExport", "analyticsCrawler"]) }}

Every arrow points the wrong way, and there are four of them. The public API of your reusable service construct is now **a list of everybody who consumes it**. Every new consumer is a change to the _shared provider construct_, a version bump, compatibility checks, and a release. Ugh!

### Out: the cycle you can't see

The second failure mode is louder. A Stack is a unit of deployment, not a runtime resource — and AWS recommends the split for deployment reasons, not modelling ones. Split the same system across stacks:

```typescript
// app.ts
const orders = new OrdersStack(app, "Orders"); // owns the uploads bucket
new ReportingStack(app, "Reporting", { uploads: orders.uploads });
```

Reporting grants its own function read access to the orders bucket. One direction, no drama: CDK exports the bucket ARN from Orders and imports it into Reporting {{ dir("Reporting", "Orders") }}.

Months later, an operability push. Somebody on the orders team adds a dashboard and an alarm on the reporting function's error rate — it is, after all, part of the orders pipeline. The first article closed its loop with a bucket notification; this time nobody touches the bucket at all:

```typescript
// orders/orders-stack.ts
new Alarm(this, "ReportFailures", {
  metric: props.report.metricErrors(),
  threshold: 1,
  evaluationPeriods: 1,
});
```

`metricErrors()` puts the function's name into the alarm's dimensions. That's a real reference, so `Orders` now depends on `Reporting` — and `Reporting` already depended on `Orders`, because of the grant:

{{ chain(["Orders", "Reporting", "Orders"]) }}

Synthesis stops:

```
Error: 'Orders' depends on 'Reporting' (Orders -> Reporting/Report/Resource.Ref).
Adding this dependency (Reporting -> Orders/Uploads/Resource.Arn) would create a
cyclic reference.
```

Now open both files and find the loop. The alarm doesn't reference a policy; the grant doesn't reference an alarm. **The cycle does not exist in your CDK code.** It exists in the synthesised template, between an `Fn::ImportValue` you never wrote and an IAM statement you never wrote. Your only clue is an error naming logical IDs.

<figure class="post-figure">
  <img
    src="{{ '/assets/after-you-no-after-you.webp' | rel }}"
    alt="Hand-drawn editorial cartoon: two road signs face each other across a street, one labelled ORDERS with an orange arrow pointing right, the other labelled REPORTING with an orange arrow pointing left. Between them two cars are stopped nose to nose, drivers throwing their arms up, with traffic backed up behind both. In the foreground a developer ticks off a clipboard, entirely pleased with himself."
    width="1568"
    height="672"
    decoding="async"
  />
  <figcaption>Each stack points at the other. Nothing in either file looks wrong.</figcaption>
</figure>

## Mutator methods

None of this is a novel observation. And the grant isn't even the only offender — it's the clearest example of something CDK does everywhere.

Look at what these calls actually change:

- `bucket.grantRead(fn)` → mutates **`fn`'s role policy**
- `bucket.addEventNotification(…, new LambdaDestination(fn))` → mutates **`fn`'s resource policy**
- `rule.addTarget(new SqsQueue(queue))` → mutates **`queue`'s resource policy**
- `rule.addTarget(new LambdaFunction(fn))` → mutates **`fn`'s resource policy**

A relationship like a permission, a notification or an event target needs both constructs to exist before it can be described at all — and props are fixed at construction, so they only reach backwards, to something already built. Mutator methods are CDK's answer: once both constructs exist, a method can wire them together in either direction, whatever order you declared them in. But a method has to hang off something, and CDK hung this one on the resource. `bucket.grantRead(fn)` couples the two as tightly as any constructor argument would — it just couples them the wrong way round.

This raises two problems for [composureCDK](https://github.com/laazyj/composureCDK). The directionality of the graph is incorrect, and **the grant methods are imperative and cannot be described as data** ([Your infrastructure isn't an app](/tech/what-is-wrong-with-cdk/)).

## Command and Compose

If a method call can't live in a description, then stop making a call. Make the request a value. That's the [Command pattern](https://en.wikipedia.org/wiki/Command_pattern) from the Gang of Four book:

> Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations.

So instead of calling a method on the bucket, you write down the request:

```typescript
bucketGrants.read(ref("uploads", (r) => r.bucket));
```

There is no method on the bucket here, and no bucket is touched. The call returns a `Grant` — a piece of data describing a permission that hasn't happened yet, with a type, which can sit in a description alongside the runtime and the handler and the code.

The key word in the pattern's description is _queue_. The system declaration describes the system as data, which is queued so it can be executed at build time. That's the config-time/build-time split [`ref`](/tech/introducing-composure-cdk/#ref) exists to bridge.

Now something has to hold that queue and fire it when the time comes, and only one construct in the relationship can: the one whose role the policy lands on. The policy belongs to the grantee, and **the grantee is the consumer**. Builders get a `grant()` method, and the call now runs {{ dir("consumer", "resource") }}, the way the dependency was pointing all along.

That's composureCDK's answer, recorded in [ADR-0013](https://github.com/laazyj/composureCDK/blob/main/docs/adr/0013-consumer-side-grants.md), in a single move: **the grant is declared on the consumer.**

```typescript
compose(
  {
    uploads: createBucketBuilder(),
    report: createFunctionBuilder()
      .runtime(Runtime.NODEJS_22_X)
      .handler("index.handler")
      .code(Code.fromAsset("dist/report"))
      .grant(bucketGrants.read(ref("uploads", (r) => r.bucket))),
  },
  { uploads: [], report: ["uploads"] },
);
```

Read `report` top to bottom and it says one coherent thing: this function runs this code, and it reads that bucket. The dependency map agrees — `report` depends on `uploads` — and so does the template. Three descriptions of the system, one direction.

The [function builder](/tech/introducing-composure-cdk/#builder) holds the grant and applies it during its own `build()`, once its execution role exists and the `ref` to `uploads` has resolved. This is [`ref`](/tech/introducing-composure-cdk/#ref) doing what it always does — only the resolution ends in a call to the bucket's own `grantRead` rather than a props assignment.

If you're familiar with the pattern, you can see its five participants each doing their job here:

- **Command** — _"declares an interface for executing an operation."_ That's `Grant<G>`: one method, apply yourself to a grantee.
- **ConcreteCommand** — _"binds an action to a receiver."_ That's what `bucketGrants.read(ref("uploads", …))` returns: a capability bound to a particular resource, not yet executed.
- **Receiver** — _"knows how to perform the operations."_ The resource construct — `IBucket`, `ITable` — which owns `grantRead` and knows what it means.
- **Invoker** — _"asks the command to carry out the request."_ The grantee builder, holding its grants and firing them during `build()`.
- **Client** — _"creates a ConcreteCommand and sets its receiver."_ Your system declaration, the place you write the grant down.

Three things make this design pattern such a good fit.

First, that Client and Invoker are separate participants is critical for us: the code that composes the request is not the code that triggers it. In composureCDK that's the gap between the `compose({…})` call where you declare a grant and the `.build()` that later executes it.

Second, **grantee and resource are roles a construct plays, not identities it has.** A Lambda function is a grantee when it reaches out to a table (`createFunctionBuilder().grant(tableGrants.read(...))`) and a resource when something else is allowed to call it (`functionGrants.invoke(...)`). Two different edges pointing opposite ways, each declared on its own consumer. The test for a grantee is whether it implements `IGrantable` — a role does, a function does via its execution role, a bucket never will.

And finally, **the reason CDK put the grant on the resource is a (really) good one.** Permission mechanics are resource knowledge. Knowing that "read" on a DynamoDB table means `GetItem`, `Query`, `Scan`, `BatchGetItem` — and the index ARNs as well as the table's — while "read" on a bucket means `GetObject`, `GetBucket*`, `List*` across two different ARN shapes, is precisely the sort of thing you want stated once, next to the table, by the people who maintain the table. The alternative is every grantee in the system carrying the action vocabulary of every resource it might ever touch. That's untenable. But a Command has a _Receiver_.

The knowledge stays exactly where it was — `bucketGrants.read` closes over the bucket's own `grantRead` and adds precisely nothing to it — but the _call_ now travels the other way. The grantee never learns what "read" means. It learns that a `Grant` has an `applyTo`, which is the entire contract.

Summed up, three principles hold the design together:

1. **Direction follows dependency.** The grant is allowed to travel along an edge that already exists — consumer to resource — and is never permitted to invent a new one.
2. **Defer to the construct's authority.** composureCDK holds no IAM policy of its own, so it cannot drift from AWS's.
3. **The shared contract couples nothing.** The whole contract — a deferred `Grant<G>`, generic over the grantee type — lives in core and never mentions `aws-cdk-lib`.

## The two examples, revisited

**The L3.** [A composed system is itself a component](/tech/introducing-composure-cdk/#compose), so the orders service is a value that nests inside a larger one:

```typescript
// orders/orders-system.ts — reusable, exported, knows nothing about consumers
export const ordersSystem = compose(
  {
    uploads: createBucketBuilder(),
    events: createQueueBuilder(),
    handler: createFunctionBuilder()
      .runtime(Runtime.NODEJS_22_X)
      .handler("index.handler")
      .code(Code.fromAsset("dist/orders"))
      .grant(
        bucketGrants.readWrite(ref("uploads", (r) => r.bucket)),
        queueGrants.consume(ref("events", (r) => r.queue)),
      ),
  },
  { uploads: [], events: [], handler: ["uploads", "events"] },
);

// app.ts — the reporting team, in their own file
compose(
  {
    orders: ordersSystem,
    report: createFunctionBuilder()
      .runtime(Runtime.NODEJS_22_X)
      .handler("index.handler")
      .code(Code.fromAsset("dist/report"))
      .grant(bucketGrants.read(ref("orders", (o) => o.uploads.bucket))),
  },
  { orders: [], report: ["orders"] },
);
```

`ordersSystem` has no props for its consumers, because there is nothing for a consumer to hand it. Adding the fraud checker and the data-lake export means adding two more components to the outer map. The shared unit is untouched, unversioned, unreleased — a true reusable shared library.

**The stacks.** I still owe you a proper article on stack management; here is the part that matters for grants. Splitting is a routing decision applied to the same value, not a restructuring of it:

```typescript
compose({ orders: ordersSystem, report: reportFunction }, { orders: [], report: ["orders"] })
  .withStacks({ orders: ordersStack, report: reportingStack })
  .build(app, "Orders");
```

The description doesn't change when the deployment boundary moves — the opposite of what CDK teaches. Now let the orders team add their alarm on the reporting function's errors, which means `orders` needs a reference to `report`:

```typescript
{
  orders: ["report"],  // the orders dashboard alarms on report's errors
  report: ["orders"],  // report reads the orders bucket
}
```

There's the cycle you couldn't see earlier — two adjacent lines of a two-line map, pointing at each other. `compose` builds the graph, finds it, and throws `CyclicDependencyError` before a single construct is instantiated, let alone synthesised.

Compare that with the error CDK gave you. That one arrived at synthesis and named `Orders/Uploads/Resource.Arn`: a logical ID in a template you didn't write, standing in for a policy statement you didn't write either. This one names `orders` and `report` — two keys you typed yourself, on two lines you can see at once. That's [the eager validation from the last article](/tech/introducing-composure-cdk/#compose) finally able to do its job: a cycle can only be caught in the graph if the graph tells the truth.

## The smallest possible version of the whole argument

I keep coming back to this one method call because it's the entire thesis of the series compressed into a single line.

`bucket.grantRead(handler)` is not a bug. It's a reasonable answer to a real problem — permission knowledge belongs with the resource — asked in a world where your code is a program that constructs things. In that world there's no graph to contradict, so direction is a matter of taste, and putting the method on the resource reads nicely.

Make the description a value with a real dependency graph and direction stops being taste. It becomes something the model can be right or wrong about — and once it can be wrong, you can make it right. That the fix turned out to be a pattern from 1994 is either reassuring or a little deflating, depending on your mood.

## References

If you want to go deeper into any of the above topics, or are curious to know more, I
recommend the following links:

- [Define permissions for L2 constructs with the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/define-iam-l2.html)
- [Facades — AWS CDK v2 Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/facades.html)
- [Resolving circular dependency in provisioning of Amazon S3 buckets with AWS Lambda event notifications (AWS)](https://aws.amazon.com/blogs/mt/resolving-circular-dependency-in-provisioning-of-amazon-s3-buckets-with-aws-lambda-event-notifications/)
