---
layout: paper
title: "Papers to read"
pinned: true
collapsible: true
date: 2026-06-14
tags: [reading list]
summary: A running, opinionated reading list — interpretability, training, evaluation — with a one-line motivation per paper so I never open one without knowing why.
---

A running list of papers I want to read, each with a short note on **why** it
matters and what I expect to learn. Newest additions go on top.

## Calibration & uncertainty

### On Calibration of Modern Neural Networks

[arxiv.org/abs/1706.04599](https://arxiv.org/abs/1706.04599) · Guo, Pleiss, Sun &
Weinberger · 2017

The paper that put calibration back on the deep-learning agenda. It shows that
modern networks — unlike the shallower models of the 1990s — are systematically
**overconfident**: the probability a softmax reports is far higher than the
accuracy it actually delivers, and the gap widens with depth, width, and the
removal of regularization. The authors make the problem measurable with
**reliability diagrams** and **expected calibration error (ECE)**, then survey
post-hoc fixes and land on **temperature scaling** — dividing the logits by a
single learned scalar before the softmax — which recalibrates remarkably well
while leaving accuracy untouched.

*Why it matters:* if I want to treat a model's outputs as real probabilities —
for thresholds, abstention, selective prediction, or any downstream decision —
calibration is the property that makes that valid, and this is the canonical
reference for it. It defines the vocabulary everyone still uses (ECE, reliability
diagrams) and the cheap baseline (temperature scaling) every later method is
measured against. A natural pairing with my own
[MNIST calibration notes](/writing/mnist-calibration/).

## Interpretability

### Circuit Tracing: Revealing Computational Graphs in Language Models

[transformer-circuits.pub/2025/attribution-graphs/methods.html](https://transformer-circuits.pub/2025/attribution-graphs/methods.html)

The methods companion to Anthropic's *On the Biology of a Large Language Model*.
It introduces **attribution graphs** built on a cross-layer transcoder (a
replacement model made of interpretable features) and shows how to trace, step by
step, the computation a model actually performs on a given prompt — then validate
those circuits with intervention experiments.

*Why it matters:* it's the closest thing to a practical, reproducible recipe for
mechanistic interpretability at frontier scale — not just "features exist" but
"here is the wiring diagram for this behaviour, and here's how we checked it." If
I want to reason about *what a model is doing* rather than just *what it outputs*,
this is the methodological backbone.

**Companion paper — *On the Biology of a Large Language Model*** —
[transformer-circuits.pub/2025/attribution-graphs/biology.html](https://transformer-circuits.pub/2025/attribution-graphs/biology.html).
Where the methods paper builds the tools, this one applies them: a gallery of case
studies (multi-step reasoning, planning in poems, multilingual circuits, refusals,
hallucination) that show what the attribution graphs actually reveal about Claude's
internals. I've taken [notes on Josh Batson's talk on it](/talks/biology-of-an-llm/),
which is a good way in before the full read.
