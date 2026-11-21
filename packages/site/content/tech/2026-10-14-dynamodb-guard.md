---
title: "Reserved words, caught before deploy"
date: 2026-10-14
project: dynamodb-guard
summary: "Placeholder. An introduction to dynamodb-guard, which catches DynamoDB expression mistakes at synth, in unit tests and in lint."
tags:
  - aws
  - composure-labs
---

_Placeholder article for the design phase. The real introduction lands when the package is at or close to 1.0._

DynamoDB rejects a request whose expression names a reserved word without an alias, and nothing catches that before the first real call. `cdk synth` accepts it. Unit tests with mocked clients accept any string.

So the mistake waits for production, and the error it gives you is at least honest about what went wrong:

```text
ValidationException: Invalid UpdateExpression: Attribute name is a reserved keyword; reserved keyword: metrics
```

## Guards, not runtime checks

Every guard runs **before deploy**: in the editor, in lint, in unit tests or at synth. Nothing in the package runs in production. Once a request reaches DynamoDB, DynamoDB reports the mistake itself, and a guard's job is to move that report earlier.

```ts
import { checkExpression } from "@composure-labs/dynamodb-guard";

const problems = checkExpression({
  UpdateExpression: "SET metrics = :m",
  ExpressionAttributeValues: { ":m": 1 },
});
```

> A placeholder pull quote, to show how a block quote sits on this design.

## Where the expression is written

- A Step Functions definition fails at `cdk synth`.
- Handler code fails in unit tests, including names built at runtime.
- A literal in any code fails in [the editor and in lint](https://github.com/composure-labs/dynamodb-guard).

The rest of this article would walk through each guard in turn. It is here to give the page some length, so that you can judge the measure, the headings and how the end of the page resolves.
