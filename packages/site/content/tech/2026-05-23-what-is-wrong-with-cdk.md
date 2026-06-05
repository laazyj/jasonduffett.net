---
title: "Your infrastructure isn't an app. So why is your CDK?"
date: 2026-05-23
ogImage: "/assets/og-what-is-wrong-with-cdk.jpg"
summary: "The CDK gave us a real programming language for AWS infrastructure, then taught us to write a program that builds it — instead of a value that simply describes it. A look at the one design choice behind CDK's most familiar frustrations."
tags:
  - aws
  - cdk
  - infrastructure-as-code
---

Your CDK code _looks_ like a description of your infrastructure. It isn't — it's an _app_ that **builds** the description, first in memory as a construct tree, then on disk as a CloudFormation template you didn't write. Almost everything awkward about working with CDK starts there.

Here's a simple order/fulfilment system. Utterly ordinary CDK:

```typescript
// orders/orders-stack.ts
export class OrdersStack extends Stack {
  readonly uploads: Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.uploads = new Bucket(this, "Uploads", {
      encryption: BucketEncryption.S3_MANAGED,
    });
    const events = new Queue(this, "Events");

    const handler = new Function(this, "Handler", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromAsset("dist"),
      environment: { BUCKET: this.uploads.bucketName },
    });

    this.uploads.grantReadWrite(handler);
    handler.addEventSource(
      new SqsEventSource(events, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );
  }
}

// fulfilment/fulfilment-stack.ts
interface FulfilmentStackProps extends StackProps {
  uploads: Bucket;
}

export class FulfilmentStack extends Stack {
  constructor(scope: Construct, id: string, props: FulfilmentStackProps) {
    super(scope, id, props);

    const fulfil = new Function(this, "Fulfil", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromAsset("dist/fulfilment"),
    });

    props.uploads.grantRead(fulfil);
    props.uploads.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(fulfil));
  }
}
```

And an `app.ts` binds the two together:

```typescript
// app.ts
const app = new App();

const orders = new OrdersStack(app, "Orders");
new FulfilmentStack(app, "Fulfilment", {
  uploads: orders.uploads,
});
```

Run this and synthesis does the rest, or so the pitch goes: each constructor mutates the tree, lazy tokens resolve into cross-references, and CloudFormation falls out the other end — no template written by hand.

**But where is the description of the system?**
Even for this simple example it's spread over 3 files, entwined in the ordering of the procedural code in the constructors of the two components, and dependencies must be hunted for by looking for method calls across the files.

**Don't believe me?**

Fair enough. Then I guess you've already spotted the bug. This system fails at synthesis time. `grantRead` puts an IAM policy on the fulfilment Lambda’s role pointing at the orders bucket; the bucket’s notification points back at the Lambda. Across the stack boundary those two references close a loop, and synthesis halts with a cyclic-reference error before any template exists. Nothing in the code looks wrong — and that’s exactly the problem. The form that would show the cycle at a glance — the dependencies laid out as data — is the one thing CDK never asks you to write.

There _is_ a description — synthesis assembles one, and normally `cdk synth` hands it to you as generated CloudFormation. But that's an output, not the thing you author or reason about — and it's the last place you'd catch a loop like this. You wrote a program to generate a description. The docs call it a "CDK app", after all.

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

That's the trade CDK made. Other popular infrastructure-as-code systems — [Terraform's HCL](https://developer.hashicorp.com/terraform/intro), [CloudFormation's own templates](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html), [Azure's Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview) — are _declarative_: the file _is_ the description; the engine reconciles. CDK gave that up for the conveniences of a real programming language: types, loops, functions, the ability to factor out a pattern once and use it everywhere. That trade bought us something great, and cost us something we're still paying for.

But going back to YAML can't be the answer. YAML _is_ the data, but YAML is miserable: no types, no reuse, no way to say "all my buckets look like this." A typed declarative language like Bicep proves the concept — you can have types and reuse in the description itself without turning it into a program. CDK leaned on generic TypeScript instead, and lost the declarative context that makes infrastructure-as-code what it is. A language was the right instinct; the mistake was using it to write a _program_ that builds the description, instead of using it to write the description itself.

Once you see that, the jankiness of CDK starts to line up: the props threaded through five constructors, the stacks you can't split without a fight, the base class you extended because there was nowhere else to put the behaviour. None of these is the disease; they're symptoms of one.

This post is about that one idea. The cure can wait for another day; first I want to convince you the problem is real.

## It isn't the Stack

If you've worked on a CDK codebase that grew, you've had this conversation. How many stacks should this app have? Where should the database live — its own stack, the application stack, a shared "data" stack with the analytics warehouse? When you split, how do you pass values across? AWS publishes guidance. Every consultancy publishes guidance. None of it agrees, and none of it ever feels right.

That argument is the most visible symptom of the problem I'm pointing at. It's also a misdirection. A Stack is a unit of deployment, not a runtime resource. The argument keeps coming back because _something_ resists being lined up, and the Stack is the biggest knob the tool gives you. But the resistance isn't coming from the Stack. It's coming from every Construct underneath it.

And it bites before you ever split a stack. Keep everything in `OrdersStack`, let the team grow, and group the bucket, queue, and function into an `OrdersService` so the stack just composes services. Now a second team needs a Lambda that also reads the orders queue, and every place to put it is a compromise: inside the service, where one team's class grows another's feature; beside it, where the service must expose its queue as a public field; or hoisted up to the stack, where the service no longer owns the queue that made it a service. None is wrong — they're the same move in different clothes: there is no way to refer to a Construct except through the construct tree, and the only way to put one into the tree is to instantiate it, in place. Anything that needs a reference has to sit adjacent to it, or you thread the reference up to a common ancestor and back down.

Faced with that, the easy move is to stop composing and start subclassing. Look at the familiar complaints with that frame in place — starting with the one it leads straight to.

**[Inheritance towers](https://wiki.c2.com/?DeepClassHierarchies).** Because a component _is_ a construct and a construct _is_ a class, the only handle you have for varying one is the class itself. "A service like _this_, but with X" becomes a subclass; "but also with Y" becomes a subclass of that, or an ever-widening props object, or both. Shared L3 libraries are where this breaks down fastest: reuse is expressed through inheritance, so every consumer's special case bloats the base or deepens the hierarchy, until the abstraction is too rigid to reuse and teams quietly fork it. Composition would sidestep all of it — but CDK only composes by construction. You can nest a construct inside another; you can't hold a description as a value and assemble it later.

**[Props-drilling](https://www.geeksforgeeks.org/reactjs/what-is-prop-drilling-and-how-to-avoid-it/).** A reference can only travel through constructor calls. So when a value needs to reach somewhere five constructors away, it gets threaded through every constructor in between — including the ones that don't use it. The wider the tree, the wider the props.

**Implicit dependency graphs.** Dependencies between resources are inferred from where you reference one in another's props. There's no place to write "this depends on that." When the inference is wrong, you fall back to `addDependency` — the manual version of the thing the tool was meant to do for you.

**Duplicate Boilerplate.** When the same shape needs to appear with small differences (per-environment, per-tenant, per-region), the differences live in code, not data — because there is no data to vary, only constructors to call. Three stacks that should be one shape and three configurations become three classes that drift.

Cross a Stack boundary and every one of these gets worse. A reference can no longer be a TypeScript variable; it has to become a `CfnOutput` on one side, a `Fn::ImportValue` on the other.

You already watched this bite. The grant helpers read one way and wire the other: `bucket.grantRead(fulfil)` looks like bucket-grants-to-fulfil, but [the policy is attached to the grantee's role](https://docs.aws.amazon.com/cdk/v2/guide/permissions.html), referencing the bucket. Within a stack that's invisible; across the boundary the dependency runs opposite to the API, and the moment anything points back — as the bucket notification did — the two directions close into the circular reference from the opener. [Open since 2021](https://github.com/aws/aws-cdk/issues/14213), [still biting](https://github.com/aws/aws-cdk/issues/26539).

The community calls this "stack splitting pain". But splitting doesn't create the problem — it only exposes it. The same dependency constraints exist entirely within a stack; the boundary merely makes them impossible to ignore, forcing you to admit in writing that your references were never values to begin with.

None of this is a user mistake. The CDK didn't ship a confusing template; it shipped the only template the model allows. `cdk init` gives you layout, not architecture, because in the construct-composition model there is no other architecture available. Every codebase that grows past a few resources rediscovers the same shape — and the same fights — because there is no other shape to discover.

## The fix

If all of this sounds depressing, it isn't. There's a way out — and it doesn't involve giving up on CDK.

Imagine the system from earlier looked like this:

```typescript
const system = compose(
  // resources
  {
    uploads: bucket({ encryption: "S3_MANAGED" }),
    events: queue(),
    handler: lambda({
      runtime: "nodejs20.x",
      handler: "index.handler",
      code: fromAsset("dist"),
      environment: { BUCKET: ref("uploads").bucketName },
      reads: [ref("uploads")],
      consumes: [ref("events")],
    }),
    fulfil: lambda({
      runtime: "nodejs20.x",
      handler: "index.handler",
      code: fromAsset("dist/fulfilment"),
      reads: [ref("uploads")],
      observes: [ref("uploads")],
    }),
  },
  // dependencies
  {
    uploads: [],
    events: [],
    handler: ["uploads", "events"],
    fulfil: ["uploads"],
  },
);
```

No `new`. No `this`. No constructor side effects. Just the resources and the dependencies between them, laid out as data in a single file — a _clear, concise, unambiguous_ description of the system.

This is what I want from infrastructure code: not a program that builds a description, but a description I can read, diff, and hand to someone else without a guided tour of five constructors. It isn't a new wish — it's what Terraform and Bicep already give you, what Stuart Sierra's [Component](https://github.com/stuartsierra/component) gives you in Clojure. I just want it on CDK, without leaving the ecosystem I'm already in.

So I'm building it. **composureCDK** is my attempt at that shape. It's still CDK underneath — it doesn't escape what CDK can't escape: CloudFormation's gravity, logical-ID churn on rename, impure synth via `fromLookup`, slow deploys. What it changes is the part I actually wanted to change: how I describe the system before any of that runs.

And the symptoms from earlier — props-drilling, inheritance towers, implicit dependency graphs, the cross-stack grant inversion — stop being problems you have to live with. They stop being problems at all.

That's a tease. The next post unpacks the model — and shows why the shared-library reuse engineers have chased for years finally starts to click.
