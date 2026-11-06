---
title: "What Composure Labs is for"
date: 2026-11-02
project: composure-labs
summary: "Placeholder. Why the tooling around ComposureCDK gets its own name, and how a package's name says what it builds on."
tags:
  - aws
  - composure-labs
---

_Placeholder article for the design phase. It stands in for writing about Composure Labs as a whole, rather than about one package._

ComposureCDK is a library with a narrow job. Most of what you want next to it doesn't belong inside it: guards for the mistakes it can't see, patterns that compose its builders, tools that have nothing to do with infrastructure code at all.

Those are first-party packages, and they're released on their own schedule rather than in lockstep with ComposureCDK.

## A name that says what it builds on

A package's name says what it builds on:

- `composurecdk-` for ComposureCDK's builders
- `cdk-` for plain `aws-cdk-lib`
- no prefix for nothing IaC-specific

> Another placeholder pull quote, to show the same element in an article without any code.

## Why this isn't a separate site

A section of this site is enough for now. This paragraph is here to give the page some length and to show a run of prose with no code in it, since not every article will be about a package.
