---
title: "Introducing NAOMI, a maturity model for AI Native engineering"
date: 2026-08-30
ogImage: "/assets/og-human-out-of-the-loop.jpg"
summary: "Evolving the classic Agile Maturity Model for an AI Native organisation. NAOMI, the Native AI Operational Maturity Index, helps your team identify and control what holds when nobody is watching. When production is cheap, the scarce resource is assurance. This is the thinking behind the pillars and the levels, and a first draft of the cells."
tags:
  - ai-native
  - naomi
  - maturity-model
  - continuous-delivery
  - coding-agents
  - agentic-coding
  - engineering-leadership
---

<style>
  /* NAOMI matrix tables. The site has had no need of tables until now, so
     these styles are local to this article. If tables turn up in a second
     article they should move to styles.css. */

  #post table {
    width: 100%;
    margin: 1.75rem 0;
    border-collapse: collapse;
    font-family: var(--ui);
    font-size: 0.78rem;
    line-height: 1.55;
    text-align: left;
  }

  /* The tables carry more per row than the 38rem measure comfortably holds, so
     above the wide breakpoint they break out of the column and centre on the
     wrapper instead. `calc(100vw - 5rem)` matches .wrap's padding at that
     width, so the table lands flush with the page gutters and never wider. */
  @media (width >= 900px) {
    #post table {
      position: relative;
      left: 50%;
      width: min(55rem, calc(100vw - 5rem));
      transform: translateX(-50%);
    }
  }

  #post th {
    padding: 0.5rem 0.85rem;
    border-bottom: 2px solid var(--accent);
    color: var(--paper);
    font-weight: 600;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    vertical-align: bottom;
  }

  #post td {
    padding: 0.7rem 0.85rem;
    border-bottom: 1px solid var(--rule);
    color: var(--paper-dim);
    vertical-align: top;
  }

  /* Level names sit in the first column of every table and want to read as a
     label rather than as prose. */
  #post td:first-child {
    width: 9.5rem;
    color: var(--paper);
    font-family: var(--mono);
    font-size: 0.74rem;
    white-space: nowrap;
  }

  #post td strong {
    font-weight: 500;
  }

  /* Below the wide breakpoint the whole page is one narrow column, so a
     two-column table stops working. Stack each row into a small card with the
     level as its heading. */
  @media (width <= 560px) {
    #post table,
    #post tbody,
    #post tr,
    #post td {
      display: block;
    }

    #post thead {
      display: none;
    }

    #post tr {
      margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--rule);
    }

    #post td {
      border: 0;
      padding: 0 0 0.4rem;
    }

    #post td:first-child {
      width: auto;
      padding-bottom: 0.5rem;
      color: var(--accent);
    }
  }
</style>

I remember, circa 2010, reading [Continuous Delivery](https://www.amazon.co.uk/dp/0321601912) by Jez Humble and David Farley. One of the most useful takeaways for my team at the time, and the idea that has stuck with me over the years, was [The Agile Maturity Model Applied to Building and Releasing Software](https://info.thoughtworks.com/rs/thoughtworks2/images/agile_maturity_model.pdf). A simple grid. Five practice areas along the top, five levels down the side, and a short description in every cell.

I printed it out and stuck it on a concrete pillar that was in the centre of the office — an old warehouse at Chelsea Wharf. This was our _North Star_. It set the direction we were steering by, and named the rungs of the ladder we were climbing. Every few weeks we'd stare at it, stare at our backlog (a brick wall covered in sticky notes), and argue about the value of the recommendations in the next rung: how they applied to our system, and whether it was the right time to bring them into the backlog.

This approach truly helped us accelerate the customer value we were delivering: our builds became more reliable, our deployments more frequent, and our time-to-market shrank dramatically. I continue to believe that shape is a practical and meaningful way to convey a big idea. It allows teams to come at it from different levels of experience and maturity without being overwhelmed by the gap between where they are today and where they are headed.

In this article, I'll introduce NAOMI — an updated maturity model for software organisations that are trying to reach that vague goal of becoming "AI Native".

## What a maturity model is for

To [quote Martin Fowler](https://martinfowler.com/bliki/MaturityModel.html):

> **The true outcome of a maturity model assessment isn't what level you are but the list of things you need to work on to improve.**

A maturity model is a prompt for a conversation. Its value is that it locates the team's current situation in a cell and the cell above that describes concrete steps for improvement. So "we should get better at testing" becomes "we should make a red build block the merge". That is the entire mechanism.

It is not a score. Fowler again, in the same piece: using a maturity model to say one group is better than another is "a classic example of ruining an informational metric by incentivizing it." Using the model as a way of scoring teams against each other removes nuance and destroys the accountability a team has for understanding their particular situation and product. Teams will optimise for the text and miss the value, destroying trust in the mechanism along the way.

So: informational, self-assessed, used to produce a list. Not a benchmark, not a target, not an input to anyone's performance review. A North Star is a direction you steer by rather than a place you arrive at, and that is the only sense in which I mean it. Every model is a simplification — wrong, but hopefully useful. Please hold what follows the same way.

## What I mean by "AI Native"

Back in the late 2000s, Continuous Integration was moving to Continuous Delivery; automated testing and virtualisation were letting the teams that adopted them move faster and safer than ever before. Much of that is now a solved problem and the older models are less applicable. In order to define a new model, we need to define a new _North Star_ to guide it.

The phrase that is hot at the moment, at least where I am working, is **"AI Native"**. But what does that mean?

Here is the definition I am working from:

> In an **AI Native software organisation, agentic delegation is the default mode of production**, not an accelerator applied to a human-authored baseline.

The distinction describes the key transformation software organisations must make. A step change is not possible by using AI to accelerate what we're already doing; we need to re-think our whole development lifecycle.

Three observable markers identify an AI Native organisation:

1. **Most changes are drafted by machines.** The scarce human resource is intent and verification, not typing.
2. **The engineering system is deliberately built as a harness for agents** — tests, CI signals, docs, instruction files, permissions — and not merely as an aid to humans.
3. **Friction that used to be structural is now elective.** When the production cost of building anything falls to near zero, the cost-driven filters that quietly governed what got built stop working, and have to be deliberately replaced.

That third marker is the one that changed the shape of the model, and I come back to it when I get to the pillars.

One thing this definition deliberately does not say: nothing here is about whether the product contains AI. An AI Native organisation building a basic CRUD app and an AI Native organisation building a model-serving platform are measured identically. The definition is about how the organisation produces software, not what the software does.

## The pillars

The 2009 model had five practice areas: build management and continuous integration, environments, release management and compliance, testing, and data management. That list is a good record of what was hard in 2009. Three of the five were the deployment problem, split three ways, because it really was three separate hard problems then.

Most of that is now the baseline. So the five areas do not survive as-is, but they do not vanish either. All five map forward, though they collapse into only three of the pillars below; the other two have no ancestor in the 2009 model at all.

**Flow & Recoverability** — _a change reaches production, and can be undone, quickly and safely._

Build, environments and release collapse into one. They were separate because each was independently difficult; today they are largely one property of the platform you deliver on, and largely something you buy. So the emphasis moves. The interesting question is no longer how efficiently a change reaches production, it is how cheaply you can be wrong. When producing a change is nearly free, the cost of recovery is what governs how much you can safely attempt.

**Verification** — _a change is known to be correct by someone who didn't write it._

The old testing pillar, widened. I think this is the bottleneck for most organisations right now: the constraint on an AI Native team is verification capacity, not production capacity. You can produce far more change than you can convincingly verify. So this pillar covers review as a first-class practice rather than a formality, mutation testing to show the suite can detect anything at all, feedback signals shaped for agents to iterate against unattended, and evals where the behaviour is not deterministic enough to assert.

**Context** — _the system is understandable to whoever, or whatever, works on it next._

The old data management pillar, widened a long way — from test data to the whole substrate that both agents and humans read from. Instructions, documentation, internal data accessibility, architectural coherence. The failure mode it exists to catch is cognitive debt: the gap between what has been built and what anyone still understands. Agents are very good at widening that gap quickly, and the gap is invisible until someone needs to change something.

**Product Integrity** — _what ships is deliberate, wanted, and coherent with what is already there._

This one has no ancestor in the 2009 model because it didn't need one. The cost of building was a governor on scope. Weak ideas died of attrition, in the gap between proposing them and finding the engineering time to deliver them. By removing this friction we lose the filter — so now we have to build it intentionally. Validated demand before build, outcomes measured rather than output counted, a subtraction path that actually works so features can be retired, and coherence held by someone with the authority to say no.

**Control & Accountability** — _every change has a named human owner and a bounded blast radius._

Wholly new surface. Agent permissions and sandboxing, governance of data access and mutation, provenance of agent-authored change, and the named human accountability that cannot be mechanised. Inference cost sits here too: an unbounded agent loop is a financial incident with the same shape as a security one. Blast radius is the right frame for both.

## The levels

I kept the level names. All five of them, unchanged: **−1 Regressive, 0 Repeatable, 1 Consistent, 2 Quantitatively Managed, 3 Optimizing**. They are good names, they are familiar to anyone who has met the older models, and there is no value in inventing new words for the same five ideas.

What I did change is the spine — the thing that actually increases as you go up. The 2009 spine was _manual → automated_. That has very little left to say when automation is the starting condition rather than the goal.

### Specifically rejected: the autonomy ladder

The obvious replacement is autonomy: _human-in-the-loop → human-on-the-loop → human-out-of-the-loop_, each rung increasing what an agent may do without a person. I tried to build the model on this and it fell over.

It fails because it misreads what the human in the loop was supplying. They were never only approving. They were also supplying:

- **accountability** — someone answers when it breaks;
- **visibility** — someone saw what changed;
- **knowledge** — someone understands the system afterwards;
- **intent** — someone can say why it is like that.

Three of those four can be mechanised. Visibility becomes provenance and an audit trail. Knowledge becomes legible architecture and maintained context. Intent becomes recorded rationale. **Accountability cannot.** A mechanism can be responsible; only a person can be accountable. Accountability can be reassigned, never removed.

Which makes autonomy the wrong spine, for four reasons:

1. It measures what was given up, not what replaced it.
2. Its top rung is a value claim, not a maturity claim. Out-of-the-loop is cheaper, not better. Gamed upward — and every model gets gamed upward — it rewards under-supervising the riskiest work.
3. It is contextual and non-monotonic. It moves several times a day depending on the change in hand. It is a dial, not a ladder.
4. Its top rung abandons the one thing that cannot be mechanised.

<figure class="post-figure">
  <img
    src="{{ '/assets/human-out-of-the-loop.webp' | rel }}"
    alt="Hand-drawn editorial cartoon: a cheerful robot perched near the top of a ladder is sawing straight through the rung it is standing on, whistling to itself, while below a man steadies the ladder with one hand and reads a book titled Delegation, not looking up. Two already-severed rungs lie on the ground."
    width="1376"
    height="768"
    decoding="async"
  />
  <figcaption>Human out of the loop.</figcaption>
</figure>

Autonomy is still a useful instrument, just for a different job: deciding how much rope to give a specific agent on a specific change. So we'll keep it, in that role. Each level states the autonomy it **entitles** you to, rather than scoring the autonomy you have taken.

### The proposed spine: assurance

What actually increases, rung by rung, is how independent the outcome is from any individual's attention. Or, less formally: **what stays true when nobody is watching.**

That runs: nothing holds it → a person holds it → the system holds it → the system knows whether it is holding → the system improves its own hold.

| Level  | Assurance       | What it means                                                                       | What it entitles you to                                                                                                       |
| ------ | --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **−1** | Unowned         | **Nothing holds the promise.** Unowned and reactive.                                | Delegate nothing. Agents amplify the mess.                                                                                    |
| **0**  | Owned           | **A person holds it.** Individual diligence, applied reliably.                      | Agents draft, humans approve everything. Attention is the throughput ceiling.                                                 |
| **1**  | Constrained     | **The system holds it.** Constrained mechanically, whether anyone remembers or not. | Agents work against machine-checkable constraints; humans review intent and sample the rest. Volume decouples from attention. |
| **2**  | Instrumented    | **The system knows whether it's holding.** The constraint is instrumented.          | Delegation calibrated per class of change, from known failure rates.                                                          |
| **3**  | Self-correcting | **The system improves its own hold.** Evidence routinely changes the constraints.   | The safe-delegation boundary moves itself as evidence accumulates.                                                            |

The entitlement column is a useful addition to previous models. It turns the model from a description into an argument: if you want to hand agents more rope, this is the assurance you need first. And it cuts the other way too — at level −1 the answer is not "adopt agents carefully", it is "don't". _Agents are an amplifier, and there is nothing there worth amplifying._

## The cells

**Version 0.1.** I am reasonably confident about the pillars and the levels; they ring true with what I have observed across multiple teams in 2026.

The cells are a different matter. They are a first draft. This is where the model stops being a nice piece of structure and starts making falsifiable claims about what a real team does. I expect a good proportion of these to be wrong — too strict in places, too vague in others, and missing whatever the obvious thing is that I cannot see from where I am standing. They need to be used in anger before I would defend any individual line.

Each cell is one to three terse declarative fragments describing an **observable practice state**. Not an intent, not an aspiration. If you cannot walk over to the team and check it, it does not belong in a cell.

### Flow & Recoverability

> _A change reaches production, and can be undone, quickly and safely._

| Level                 | Behaviours                                                                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **−1 Unowned**        | • Deployment is a scheduled event, performed by hand, by whoever is available.<br>• Rollback is a rebuild and redeploy of unknown duration; it has not been exercised this quarter.<br>• Environments differ from production in ways nobody can enumerate.                                                                              |
| **0 Owned**           | • Deployment is automated and any engineer on the team can run it unaided.<br>• Rollback is a documented procedure with a named owner, deliberately exercised at least once.<br>• Everything needed to rebuild the system is in version control, and environments are provisioned from it.                                              |
| **1 Constrained**     | • The automated path is the only path to production; there is no manual route around it.<br>• Changes ship decoupled from release — dark, behind flags, or progressively rolled out — so a bad change reaches a fraction of traffic before it is stopped.<br>• Rollback is triggered by health signals rather than by a human noticing. |
| **2 Instrumented**    | • Time to restore is measured per class of change, not as a team-wide average.<br>• The rollback mechanism is exercised on a schedule and its success rate is known.<br>• The fraction of traffic exposed before a bad change is stopped is measured rather than assumed.                                                               |
| **3 Self-correcting** | • Canary thresholds and rollout speed adjust from the observed failure rate for that class of change.<br>• Fault injection runs continuously; a regression in restore time raises work before an incident does.<br>• The path to production tightens or widens per change class without anyone running a project to do it.              |

### Verification

> _A change is known to be correct by someone who didn't write it._

| Level                 | Behaviours                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **−1 Unowned**        | • Failing tests are muted, skipped, or re-run until green.<br>• Approvals arrive faster than the diff could plausibly have been read.<br>• Nobody can say what the suite proves; coverage is quoted instead.                                                                                                                                                                                                     |
| **0 Owned**           | • Every change is reviewed by a named engineer who is accountable for it having merged.<br>• The suite runs on every change and a red build blocks the merge.<br>• Agent-authored changes are held to the same review standard as human-authored ones.                                                                                                                                                           |
| **1 Constrained**     | • Machine-checkable constraints — types, contracts, lint, security scans, performance budgets — run before a human sees the change, and agents iterate against them unattended.<br>• The suite's detection power is evidenced by mutation score or deliberate fault injection, not inferred from coverage.<br>• Behaviour that cannot be asserted deterministically is gated by evals with agreed thresholds.    |
| **2 Instrumented**    | • Every escaped defect is traced to the specific check that should have caught it, and the gap is recorded.<br>• Detection power is tracked over time, and the suite's false-positive rate is measured and budgeted — flakiness has a number and an owner.<br>• First-pass acceptance of agent-authored changes is measured, and falling acceptance is treated as a signal about the constraints, not the agent. |
| **3 Self-correcting** | • An escaped defect closes with the missing check added; the gate that failed is tightened as part of the fix rather than as follow-up work.<br>• Flaky tests are quarantined and repaired automatically, so signal quality does not depend on human triage.<br>• Check strictness and eval thresholds move with the measured risk of each change class.                                                         |

### Context

> _The system is understandable to whoever — or whatever — works on it next._

| Level                 | Behaviours                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **−1 Unowned**        | • Documentation exists and is known to be wrong; people ask a specific individual instead.<br>• Agent instruction files have accumulated contradictory rules that nobody has pruned.<br>• Changes are made by pattern-matching nearby code; no one can explain why the system is shaped as it is.                                                                                                |
| **0 Owned**           | • Every component has a named owner and current documentation of its purpose and how to run it.<br>• Agent instructions are maintained deliberately and reviewed like code.<br>• Architectural decisions are recorded with the rationale that applied at the time.                                                                                                                               |
| **1 Constrained**     | • Documentation and instruction files are validated by the pipeline: stale commands, broken references and contradictory rules fail the build.<br>• The context agents need is retrievable through a defined interface rather than scattered across tools.<br>• Changes that duplicate existing code or widen coupling beyond a threshold are stopped by the system, not by a reviewer's memory. |
| **2 Instrumented**    | • The gap between system and documentation is measured — staleness, and time-to-first-useful-change for a newcomer or a fresh agent session.<br>• Agent failures attributable to missing or wrong context are counted and traced to the specific document.<br>• Duplication and coupling are trended; cognitive debt has a number that someone reviews.                                          |
| **3 Self-correcting** | • Context is regenerated from the system as it changes; documents failing their checks are corrected and re-proposed automatically.<br>• Repeated agent failure in the same area raises a context fix rather than a retry.<br>• Instructions are pruned on evidence of being unread, unused or contradictory, so the corpus doesn't bloat.                                                       |

### Product Integrity

> _What ships is deliberate, wanted, and coherent with what is already there._

| Level                 | Behaviours                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **−1 Unowned**        | • Features ship with no stated purpose and no nameable owner.<br>• Nothing has ever been retired; the product surface grows monotonically.<br>• Requests become work items without anyone testing whether they are wanted.                                                                                                                             |
| **0 Owned**           | • Every item of work has a named owner and a stated intended outcome, agreed before build starts.<br>• Someone holds the authority to decline work, and exercises it.<br>• The team can say what it declined last quarter, and why.                                                                                                                    |
| **1 Constrained**     | • Work cannot enter the backlog without a stated hypothesis and a named owner; the system will not accept it otherwise.<br>• Every launch carries a review date, and the outcome is recorded whether or not it flatters the decision.<br>• Retirement is a funded routine with an owner; feature flags carry expiry dates and are removed on schedule. |
| **2 Instrumented**    | • The proportion of shipped work that met its stated hypothesis is known, and quoted.<br>• Every feature's usage is measured against its cost to keep.<br>• The size of the product surface is a tracked number with a direction of travel.                                                                                                            |
| **3 Self-correcting** | • Work that fails its hypothesis enters the retirement path on a timer unless someone argues to keep it — the default is removal, not survival.<br>• The bar for entering the backlog moves with the measured hit rate.<br>• Adding to the surface forces an explicit decision about what leaves.                                                      |

### Control & Accountability

> _Every change has a named human owner and a bounded blast radius._

| Level                 | Behaviours                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **−1 Unowned**        | • Agents run with the permissions of whoever launched them; nobody can enumerate what they can reach.<br>• Agent-authored changes are indistinguishable from human ones after the fact.<br>• Nobody knows what is being spent on inference, or by whom.                                                                                                                  |
| **0 Owned**           | • Every change has a named human accountable for it, whether or not they wrote it.<br>• Agents run under scoped credentials, with a documented list of what they may reach.<br>• Agent authorship is attributed in the history; inference spend is attributed to teams and reviewed.                                                                                     |
| **1 Constrained**     | • Agents are sandboxed by default; access to data, tools and networks is granted per task and expires.<br>• Provenance — model, instruction version, accountable human — is recorded automatically and cannot be omitted.<br>• Irreversible operations require a human decision by construction, and spend limits halt a runaway loop rather than surfacing on the bill. |
| **2 Instrumented**    | • Permission grants are measured against use: what agents actually reached versus what they were permitted to.<br>• Provenance completeness is measured, and unattributed changes are counted and chased.<br>• Inference spend is measured per unit of delivered work, and blast radius is quantified per change class.                                                  |
| **3 Self-correcting** | • Permissions narrow themselves to observed need; unused grants expire without anyone revoking them.<br>• Sandbox boundaries and approval thresholds adjust to each agent's demonstrated failure rate on that class of work.<br>• Spend limits recalibrate against delivered value rather than being reset by argument.                                                  |

## Where this goes next

That grid is NAOMI: the **Native AI Operational Maturity Index**. Five pillars, five levels, twenty-five cells, and a working assumption that a fair number of those cells are currently wrong but will improve over time.

The article is a snapshot; the model is not. The current version, the reasoning behind it, and a PDF you can print and argue over lives at **[naomi.jasonduffett.net](https://naomi.jasonduffett.net)**. It's that version that I will keep updated as the cell content evolves. If the two ever disagree, the site is right and this page is history.

What I would most like is what I got in that room in 2010: someone sitting down with it, disagreeing with a cell, and being specific about why. Especially at level 2 and above, where I am describing practices that I have not seen working together (yet!). If you try it and a row turns out to be unusable, I would genuinely like to know which one.

And if you do use it — the level is not the point. The list is.
