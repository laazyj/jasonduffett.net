---
title: "Stop Forgetting How to Play Gloomhaven"
date: 2026-07-24
summary: "Free, printable cheat sheets for Gloomhaven: Jaws of the Lion — one per mercenary — covering the setup, round, and end-of-scenario rules groups keep forgetting between sessions. Download them, print them, and stop re-learning the game every time you play."
tags:
  - board-games
  - gloomhaven
  - side-projects
  - design
---

[Gloomhaven: Jaws of the Lion](https://cephalofair.com/products/gloomhaven-jaws-of-the-lion) is a wonderful game. It is also a game with a rulebook the approximate density of a neutron star, and, unless you're meeting weekly, it's almost impossible not to screw up at least the first game of each meet-up.

Every session opens with the same ritual. Which of these monsters were we supposed to place at the start, and which trickle in later? (We always set up all of them. The room fills with vermlings. Chaos.) Did anyone deal out the battle goals? (No.) Did we reset the elements at the top of the round? (No.) Did that curse card get reshuffled back in? (Absolutely not.) And then, at the end, the fiddly maths of gold and experience that nobody remembers the shape of.

We are, to be clear, not idiots. We are just experienced players with the retention of a goldfish and a four-month gap between sessions.

<figure class="post-figure">
  <img
    src="{{ '/assets/jotl-forgetful-mercenaries.webp' | rel }}"
    alt="Hand-drawn editorial cartoon: four friends in homemade fantasy-mercenary costumes crowd a candlelit dining table, mid-argument over a fat rulebook and a hex-tile board strewn with little red blob monsters and a horned demon. A hooded, pale-faced player jabs a finger at the rules; an armoured, red-caped player shouts; a leather-clad player throws both hands in the air; and a goggled tinkerer slumps back with a goblet. Bottles of mead and lanterns clutter the table."
    width="1376"
    height="768"
    decoding="async"
  />
  <figcaption>Four experienced players, four months of forgetting, and one rulebook nobody wants to open.</figcaption>
</figure>

## The obvious, sensible, proportionate response

Buy an index card. Write "DON'T SET UP ALL THE MONSTERS" on it in biro. Done.

Reader, I did not do that.

Instead I built (or, if I'm honest, I unleashed my indentured AI agents to build for me) [a repo](https://github.com/laazyj/jotl-cheat-sheets): **four A4 cheat sheets, one per mercenary**, each covering the bit of the game we reliably fluff. Hatchet takes _scenario setup_. Red Guard takes _the round_ — initiative, elements, conditions, monster focus, the end-of-round upkeep we always skip. Voidwarden gets _the scenario end_. And the Demolitionist, fittingly, handles _levelling up_.

I wanted them to feel like they belonged in the box, not like a printout stapled to the misery of a spreadsheet. So they're styled after the game's own cards: sepia parchment with that speckled grain, dark banner headers, the actual display typeface ([Pirata One](https://fonts.google.com/specimen/Pirata+One), paired with [Alegreya](https://fonts.google.com/specimen/Alegreya)), and dense two-column layouts because a cheat sheet with whitespace is a cheat sheet that's lying to you.

## Down the rabbit hole, as is tradition

Of course, "make four PDFs" is never four PDFs. I traced each mercenary's logo to SVG, self-hosted the fonts, laid the whole thing out in hand-written HTML and CSS, and rendered it to print-perfect A4 with headless Chrome. There's a `build.sh` so future-me — who will absolutely have forgotten how any of this works — can regenerate everything with one command. Three design variations, because I couldn't leave it alone, before settling on the one that looked most like a real card.

## Was it worth it?

Let's tally the honest maths. To avoid reading the rulebook, I read the rulebook _extremely_ closely, traced some vector art, wrangled a typesetting pipeline, verified two years of accumulated house-error, and published an open-source repository with a build script and a changelog.

Peak software engineer. I regret nothing.

The real test comes next time we sit down to play — but I'm quietly confident that the forgetting, when it comes, will at least be _fast_. And if your group is as gloriously forgetful as mine, the whole lot is [on GitHub](https://github.com/laazyj/jotl-cheat-sheets), released under CC BY-NC-SA. Print them at 100% (not "fit to page", I'm begging you), fork them for your own mercenaries, customise the content for the rules you forget the most, and may you never again fill the first room with every monster in the box.
