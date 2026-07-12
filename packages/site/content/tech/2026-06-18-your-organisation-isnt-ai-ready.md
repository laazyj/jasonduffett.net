---
title: "Your Organisation Isn't AI Ready."
date: 2026-06-18
ogImage: "/assets/og-your-organisation-isnt-ai-ready.jpg"
summary: "TODO"
tags:
  - ai
  - software-engineering
  - agentic-coding
  - ai-assisted-development
  - engineering-culture
  - sdlc
---

<figure class="post-figure">
  <img
    src="{{ '/assets/ai-ready-iceberg.webp' | rel }}"
    alt="Hand-drawn editorial cartoon: a suited executive stands on the deck of a large ship with 'AI READY' painted in orange on the hull, arms wide and grinning at the viewer — while behind them, a crew member shuffles a deck chair and an enormous iceberg towers at the ship's bow, its peak cropped beyond the frame."
    width="1376"
    height="768"
    decoding="async"
  />
  <figcaption>The "AI Ready" banner looks great from the deck. The iceberg disagrees.</figcaption>
</figure>

It seems like every day I'm surrounded by people throwing out catch-phrases - "We need to be AI Ready", "Agentic Readiness is our goal", "How do we become AI Native?". And just as often, when challenged them on what they mean by these phrases, I receive a proverbial ¯\\_(ツ)_/¯. Like the definition doesn't matter - _don't be a 🔳 man_ - we'll somehow vibe-code ourselves to this undefined nirvana.

This article is a rant, rage prose to capture my frustration, about why the definition **does matter**. Why organisations, especially large ones, are failing to grasp the importance. Why might it be existential. And why anything you do before you understand the definition is probably just moving the chairs around.

## What "AI Native" is not

<!--
  Flesh out each of these to describe the results of the anit-pattern
-->

Spoiler, this list not hyperbole but based on unfortunate real world experience 🤦🏻‍♂️.

AI Native **does not** mean:

- Sprawling, AI-slopped, `AGENTS.md` whose size dwarfs the code base it is describing, contains myriads of hallucinations, and will be out-of-date on the next commit.
- An "AutoSDE" code reviewer who nit-picks code syntax and argues against itself on every subsequent revision.
- AI generated BRDs that need 6 pages to describe a 2 sentence idea someone fed through Opus because they couldn't really explain it themselves.
- A dark factory churning out "features" customers don't need, against an architecture that doesn't exist, using code nobody can maintain.
- Throwing out your data governance safeguards in the name of innovation _needs a stronger landing_
- Forcing 100s of engineers to adopt a hodge-podge list of one person's favourite static analysers or other tools.

_insert more examples_

## Why this is possibly existential

If you're in a startup all of this probably sounds anachronistic, but its real. Teams and VP-size organisations are doing all of the above in the name of becoming "AI Ready". I _believe_ there are people in these teams who know better but they're not being heard. Or maybe they're not there? It's hard to tell with all the slop.

And that's the reason this might be existential. These teams were constituted in a different world. Bureaucracy, inertia, and lack of direction, was a tax that large organisations needed to pay to support huge engineering divisions. But we don't need huge software engineering divisions anymore. We always knew smaller teams are nimbler, more responsive, and more productive but we just couldn't do the big things without scaling up. Now we don't need to scale up as LLMs make a 1 pizza team more effective than 20 of the 2-pizza team model.

## How I define AI Native?

Before I give you my humble definition, let me paint you a picture. Indulge me. Imagine an organisation that has actually arrived.

It's a Tuesday. A customer raises a ticket: a report is timing out for accounts with more than ten thousand rows. Nobody is paged. An Agent picks up the ticket, reproduces the issue against a production-like environment, writes a failing test that captures the customer's exact scenario, fixes the query, watches the test go green, and ships the change behind a flag. The latency graph recovers. A human sees a one-line summary the next morning and moves on. The whole thing cost nobody an afternoon.

Down the metaphoric corridor; the team is six people across three time zones. A product lead is not writing a feature list. She is sharpening the _strategy_: who the customer is, what outcome they're buying, where the business will and won't compete. That guidance is precise enough that Agents can generate a backlog from it, and precise enough that a human can tell, at a glance, when a proposed change is off-strategy. The two engineers on the team aren't hand-writing CRUD. They're up to their elbows in the one genuinely novel part of the product, directing Agents around it and reviewing only the changes that are actually load-bearing or controversial.

All the _keeping-the-lights-on_ churn — the bug fixes, the dependency bumps, the maintenance, a surprising share of the customer-facing features — flows from idea to production without a human in the critical path. Not because anyone was reckless, but because the guardrails are _real_: tests verify the outcome you actually care about, gates ensure an Agent cannot smile its way past, and telemetry feeds straight back into the machine. The feedback loop runs day and night. It is, recognisably, the old SDLC cycle — plan, build, test, release, learn — but with the human cost stripped out of every step that no longer needs one.

That is what "AI Native" looks like to me. A small team, enormous leverage, and a positive feedback loop that compounds while everyone sleeps.

It sounds like a utopia, and from where most large organisations stand today it may as well be. But the interesting thing about this picture is not how shiny it is — it's what it _quietly implies_. Every sentence above smuggles in a precondition. Reproduce the issue against a production-like environment. Strategy precise enough to generate a backlog. Clean and extensible software architecture that an agent can work within. Guardrails an Agent cannot talk its way past. Telemetry that feeds back automatically. Pull any one of those threads and the whole loop stalls.

This matters because, as the DORA team put it in their 2026 report, **AI is an amplifier**.[^dora2026] It magnifies the strengths of high-performing teams and, just as faithfully, the dysfunctions of struggling ones. The biggest returns don't come from the tools — they come from "the quality of the internal platform, the clarity of workflows, and the alignment of teams." Bolt an Agent onto a broken process and you get a faster broken process. DORA even warn that the path to value is rarely a straight line: most organisations should expect a _J-Curve_, a productivity dip they call the "tuition cost of transformation," driven by exactly the frictions I want to talk about — the learning curve, the **verification tax**, and the work of adapting your pipeline.

And there's a sharper point buried in the report. More code is not the prize. Code, they remind us, "is often seen as a liability, not an asset" — the operational cost of running software dwarfs the cost of writing it, and generating more of it without oversight just inflates your verification overhead and your long-term debt. The win isn't volume. It's _reducing rework_ to recover capacity — DORA call it "free headcount" — that you reinvest in the novel work only humans can do.

So the utopia is not a tooling problem. It's a system of bottlenecks. The work that used to be slow and expensive — writing code, drafting docs, doing research, building prototypes — has collapsed in cost. But that collapse doesn't make a system fast; it just relocates the constraint. The questions that decide whether you reach the picture above are all about _where the new bottlenecks land_, and where you still need a human standing in the loop.

So here's my definition of being "AI Ready".

First: acknowledge this is a revolution, not an evolution. Small changes to existing processes will not cut it. Radical rethinking is necessary. _Give more examples_

Second: Understand the new bottlenecks - _insert ref to Phoenix Project_. Code, documentation, research, design, prototyping - the work that used to be costly and expensive is no longer. But you still need _humans in the loop_ at particular places - what are they?

Third: Change everything to optimise these bottlenecks.

<!--
  Flesh out more describing the new environment first and then the enablers that this requires.
  New positive feedback loop analogous to old SDLC cycle
-->

What does that mean?

- You need strong, directional, ideas for your product and solving your customer needs. These are not "feature lists" but strategic guidance that allows anyone in the team, including your Agents, to generate relevant and valuable backlog items that align with the business goals and customer needs.
- You need software engineers working only on the most novel and/or critical code. Even then, they are providing the high-level guidance to Agents, not hand-writing code.
- You need human code review for only novel or controversial changes, everything else should be automated.
- You need _reliable_ guardrails and **lots of them**. Accept that many of your software changes - certainly all of your bug fixes and maintenance tasks, but even many of your customer-facing features - will be delivered _without human intervention_. This means guardrails up and down your SDLC stack - from the backlog to the production gates.
- You test relentlessly. We're in a post-accepted-practice world. Is your code package "Agentic ready" - test it. Is your new feature usable by people with accessibility needs - test it. Is your system within latency goals - test it. Don't accept poor proxies, test the thing you actually want to observe.
- Automate the feedback loops. Push your test results, your customer tickets, your telemetry data back into the machine. Humans don't need to analyse this stuff, they provide the guidance and the Agents will work the rest out. Latency drops below the SLA? An Agent can identify, diagnose, fix, test, and deploy the fix without human intervention.
- AI Literacy - quote Steve Yegge.

_What else?_

## References

[^dora2026]: DORA, _The ROI of AI-assisted software development_ (2026). <https://cloud.google.com/resources/content/dora-roi-of-ai-assisted-software-development>
