---
layout: talk
title: "How You Can Start Designing AI with Purpose"
speaker: "Josh Lovejoy"
event: "MLOps World"
talk_date: 2021-06-04
date: 2026-07-19   # watched the recording in July 2026
link: https://www.youtube.com/watch?v=sJ7ekd1nUdU
link_label: "Recording (MLOps World) ↗"
tags: [AI product design, trust, automation bias, search UX, human-centered AI, DanteGPT]
summary: "Lovejoy's case for assistance over automation: automation bias, the trust-rebuild curve, levels of automation, and an image search that asks users for intent instead of guessing it. Plus my plan to port the focus-areas pattern into DanteGPT's semantic search."
---

Notes from Josh Lovejoy's **How You Can Start Designing AI with Purpose** at MLOps
World. Lovejoy led UX for Google's PAIR initiative and headed design for
Microsoft's Ethics & Society team, and the talk closely tracks his essay
[When are we going to start designing AI with purpose?](https://uxdesign.cc/when-are-we-going-to-start-designing-ai-with-purpose-e196f986974b)
My notes lean on the slides and that essay, because the argument and the figures
are the same in both.

The core claim: most AI features fail not because the model is weak but because
nobody decided what the human is supposed to be doing while the AI works.
Purposeful design means picking a level of assistance deliberately and making
the system's interpretation of the user visible and correctable.

## Automation bias and the automation conundrum

Two definitions from the slides, verbatim:

> **Automation bias.** An unconscious preference for the outputs of automated
> systems over human judgment.

> **Automation conundrum.** As more autonomy is added to a system, and its
> reliability and robustness increase, the lower the situation awareness of
> human operators and the less likely that they will be able to take over
> manual control when needed.

<figure>
  <img src="/assets/designing-ai-with-purpose/automation-bias-conundrum.png" alt="Slide with the definitions of automation bias and the automation conundrum">
  <figcaption>The two failure modes bracketing AI product design: people over-trust the machine at first, and the better the machine gets, the worse they become at catching its mistakes.</figcaption>
</figure>

The pairing is what matters. People arrive over-trusting the machine, and the
more reliable you make it, the less prepared they are for the day it fails. So
"just improve the model" makes the second problem worse while the first one
hides it. The conundrum is a known result in human-factors research (Endsley's
work on situation awareness), not something Lovejoy invented for the talk.

## Trust is built in layers, and AI starts from a false peak

Lovejoy borrows the structure of interpersonal trust from psychology. Between
humans, trust grows through repeated interactions in three layers:
**predictability** first (I can anticipate what you'll do), then
**dependability** (I can rely on you across situations), and only late
**faith** (I trust you in situations neither of us has seen).

<figure>
  <img src="/assets/designing-ai-with-purpose/trust-human-human.png" alt="Chart of human-to-human contributors to trust: predictability, then dependability, then faith, growing over interactions">
  <figcaption>Human:Human trust. Predictability is the base layer; faith only shows up after a long history of interactions.</figcaption>
</figure>

The Human:AI version of the chart is the best slide of the talk. Trust doesn't
start at zero. It starts high, inflated by automation bias, then collapses at
the **realization of AI fallibility**, and only after that crash does the real
curve begin, built from the same three layers in the same order.

<figure>
  <img src="/assets/designing-ai-with-purpose/trust-human-ai.png" alt="Chart of human-to-AI trust: automation bias inflates initial trust, which crashes at the realization of AI fallibility, then rebuilds through predictability, dependability, faith">
  <figcaption>Human:AI trust. The pink region is unearned trust from automation bias; the crash is the first bad answer the user actually catches.</figcaption>
</figure>

Two consequences he draws from this:

- **The crash is coming no matter what.** The design question is whether the
  user lands on a floor (a mental model of what the system is good at) or falls
  straight to disuse.
- Without the chance to build that mental model, users end up in **misuse**
  (relying on the AI for things it can't do) or **disuse** (abandoning it
  because performance didn't match what they assumed). Both are design
  failures, not model failures.

Predictability being the base layer inverts the usual instinct. A slightly
worse model that behaves legibly and consistently earns trust faster than a
stronger model that surprises people.

## Levels of automation: a menu, not a dial

The talk walks through the classic human-factors scale of automation levels
(Parasuraman, Sheridan and Wickens), from "offers no assistance, nothing is
automated" up to "decides everything, acts autonomously, ignoring the human".
The interesting part is the columns: the scale applies separately to
**information acquisition**, **information analysis**, **decision selection**
and **action implementation**.

<figure>
  <img src="/assets/designing-ai-with-purpose/levels-of-automation.png" alt="Table of ten levels of automation across four stages: information acquisition, information analysis, decision selection, action implementation">
  <figcaption>Ten levels, four stages. A system can automate analysis aggressively while keeping decision selection at "offers a narrowed set of options for the human to approve".</figcaption>
</figure>

So "how autonomous should this feature be" is the wrong question. You pick a
level per stage. A search engine can be fully automated at information
acquisition and analysis while staying at "offers a narrowed set of
possible decisions for the human to approve" at decision selection. That
middle level, narrow the options and let the human choose, is where most
assistance should live.

## The image search example: ask for intent, don't guess it

The part I came for. Lovejoy shows a theoretical image search app handling the
query **"Lotus"**, which is genuinely ambiguous: car, flower, tattoo, drawing,
meditation.

<figure>
  <img src="/assets/designing-ai-with-purpose/image-search-lotus.png" alt="Mockup of an image search for 'Lotus' showing suggested focus areas (Car, Flower, Tattoo, Drawing, Meditation) and query refinements (arrangement, harvesting, garden, seeds)">
  <figcaption>The Lotus mockup: suggested focus areas above, query refinements below, and a "Personalize your focus areas" control in the header.</figcaption>
</figure>

The conventional fix is silent personalization: infer from browsing history
that this user probably means the flower, and quietly rerank. Lovejoy's design
does the opposite, and every piece of it maps to the frameworks above:

- **Suggested focus areas** (Car, Flower, Tattoo, Drawing, Meditation): the
  system shows the interpretations it's considering and lets the user pick one.
  The ambiguity resolution becomes a visible, one-tap decision instead of a
  hidden guess. This is decision selection held at "narrowed set of options for
  the human to approve".
- **Personalize your focus areas**: personalization is an object the user can
  see and edit, not an inference buried in a ranking function. If the system
  has a model of me, I should be able to open it.
- **Query refinements** (Lotus arrangement, harvesting, garden, seeds): the
  system exposes the neighborhood around the query, so even after choosing an
  interpretation the user can steer. In the essay he makes the general point
  that surfacing predictions close-to-but-not-quite what the AI matched is
  useful anywhere you show recommendations or sorted results.

The payoff in trust terms: every guess the system makes silently is a future
withdrawal from the trust account when it guesses wrong. Every guess it
surfaces as an option is predictability training, the user learns what the
system considered and why, one query at a time.

## Porting this to DanteGPT

My semantic search on the *Divine Comedy* has exactly the Lotus problem, and
I've been solving it the silent way. The system serves two query types: **verse
recall** ("a metà della vita" should return Inferno I:1–3) and **thematic
search** ("I was 35 and felt lost" should surface the same tercet for a
different reason). Right now a query-aware weighted fusion decides behind the
scenes whether the query looks lexical or semantic, Italian or English, and
blends BM25 and dense retrieval accordingly. When the classifier guesses wrong,
the user just sees bad results with no explanation and no handle to correct
them. That is precisely the silent personalization Lovejoy argues against.

What the Lotus pattern translates to, concretely:

- **Focus areas become query-intent chips.** After a query, show the
  interpretation the router chose ("looks like a half-remembered verse") and
  the alternative ("search by theme instead"), one tap apart. The fusion
  weights already encode this decision; the change is surfacing it. A wrong
  guess turns from an invisible failure into a correctable one.
- **Refinements come from the embedding neighborhood.** For "I was 35 and felt
  lost", the dense index around the query has natural refinement chips:
  *smarrimento*, the dark wood, midlife. I already max-pool per tercet, so
  the near-miss tercets are computed anyway; today I throw them away instead
  of showing them.
- **Personalized focus areas become remembered defaults.** Someone hunting
  exact quotes wants the original Italian and BM25 weighted up; a student
  wants translations and paraphrases. Store it as a visible, editable
  preference rather than inferring it per session.
- **The trust curve says: show five, not one.** My realistic benchmarks put
  Recall@1 at 0.42 while Recall@5 stays much higher, and the bottleneck is
  reranking. An interface that presents one autonomous answer is a level-of-
  automation choice my measured accuracy can't back. Presenting five candidate
  tercets with provenance (which representation matched: original verse,
  translation, or paraphrase) is the "narrowed set for the human to approve"
  level, and it happens to be the level my numbers support.
- **Plan for the fallibility crash.** Users will hit a wrong tercet early,
  probably on their first thematic query. The mental-model floor I can give
  them is provenance plus visible intent: if the interface shows *why* a
  result came back, a miss reads as "it took my query literally" instead of
  "this thing is broken".

The one-line version I'm keeping: my retrieval pipeline guesses so the user
doesn't have to, and Lovejoy convinced me that's backwards. The guessing
should stay, but as suggestions the user can see and correct until the trust
is earned.
