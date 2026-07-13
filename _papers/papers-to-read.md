---
layout: paper
title: "Papers to read"
pinned: true
collapsible: true
# use_build_date makes the listed/displayed month+year track the site build
# time (see filter-aside.html, papers.html, paper.html) so this running list
# always shows the current month. `date` stays as a static fallback.
use_build_date: true
date: 2026-06-14
tags: [reading list]
summary: A running, opinionated reading list, interpretability, training, evaluation, with a one-line motivation per paper so I never open one without knowing why.
---

A running list of papers I want to read, each with a short note on **why** it
matters and what I expect to learn. Newest additions go on top.

## Calibration & uncertainty

### On Calibration of Modern Neural Networks

[arxiv.org/abs/1706.04599](https://arxiv.org/abs/1706.04599) · Guo, Pleiss, Sun &
Weinberger · 2017

The paper that put calibration back on the deep-learning agenda. It shows that
modern networks, unlike the shallower models of the 1990s, are systematically
**overconfident**: the probability a softmax reports is far higher than the
accuracy it actually delivers, and the gap widens with depth, width, and the
removal of regularization. The authors make the problem measurable with
**reliability diagrams** and **expected calibration error (ECE)**, then survey
post-hoc fixes and land on **temperature scaling** (dividing the logits by a
single learned scalar before the softmax), which recalibrates remarkably well
while leaving accuracy untouched.

*Why it matters:* if I want to treat a model's outputs as real probabilities -
for thresholds, abstention, selective prediction, or any downstream decision -
calibration is the property that makes that valid, and this is the canonical
reference for it. It defines the vocabulary everyone still uses (ECE, reliability
diagrams) and the cheap baseline (temperature scaling) every later method is
measured against. A natural pairing with my own
[MNIST calibration notes](/writing/mnist-calibration/).

## Interpretability

### Interpreting Key Mechanisms of Factual Recall in Transformer-Based Language Models

[arxiv.org/abs/2403.19521](https://arxiv.org/abs/2403.19521) · Lv, Chen, Zhang,
Wang, Liu, Wen, Xie & Yan · 2024

A circuit-level account of how transformers retrieve facts. It identifies the
attention head **L9H8** in GPT-2 Small as an "Argument Passer" that maps a
subject (a country) to its attribute (its capital), and documents a universal
**anti-overconfidence mechanism** in the final MLP layers that prefers "safe"
generic predictions over specific facts.

*Why it matters:* it names the exact components I bumped into independently in my
[Structure vs. Recall findings](/writing/structure-vs-recall-findings/) (the
L9H8 writer head and the late-layer MLP suppressors), so it's the benchmark I
need to read closely to turn my informal observations into a proper, formal
comparison.

### Beyond Importance: Interchange-Sobol Sensitivity Reveals Task-Specific Content Channels in Transformer Components

[arxiv.org/abs/2606.20678](https://arxiv.org/abs/2606.20678) · Guo, Du & Chen ·
2026

Introduces an interchange-Sobol sensitivity method to find **task-specific
content channels** inside transformer components. It reports an early-versus-late
routing split: early channels transport relation-frame content while late
attention transports subject-retrieval content, refining at head granularity
down to the known **L9H8** head.

*Why it matters:* it corroborates the early-vs-late routing dynamic I saw in my
[Structure vs. Recall findings](/writing/structure-vs-recall-findings/) and adds
a sensitivity-based methodology I don't yet use. Reading it should give me a more
principled tool than direct logit attribution alone for attributing behaviour to
specific channels.

### Circuit Tracing: Revealing Computational Graphs in Language Models

[transformer-circuits.pub/2025/attribution-graphs/methods.html](https://transformer-circuits.pub/2025/attribution-graphs/methods.html)

The methods companion to Anthropic's *On the Biology of a Large Language Model*.
It introduces **attribution graphs** built on a cross-layer transcoder (a
replacement model made of interpretable features) and shows how to trace, step by
step, the computation a model actually performs on a given prompt, then validate
those circuits with intervention experiments.

*Why it matters:* it's the closest thing to a practical, reproducible recipe for
mechanistic interpretability at frontier scale. It goes beyond identifying
features to producing the wiring diagram for a specific behaviour, with
intervention experiments to check it. If
I want to reason about *what a model is doing* rather than just *what it outputs*,
this is the methodological backbone.

**Companion paper: *On the Biology of a Large Language Model*** -
[transformer-circuits.pub/2025/attribution-graphs/biology.html](https://transformer-circuits.pub/2025/attribution-graphs/biology.html).
Where the methods paper builds the tools, this one applies them: a gallery of case
studies (multi-step reasoning, planning in poems, multilingual circuits, refusals,
hallucination) that show what the attribution graphs actually reveal about Claude's
internals. I've taken [notes on Josh Batson's talk on it](/talks/biology-of-an-llm/),
which is a good way in before the full read.

## Getting started

### How To Become A Mechanistic Interpretability Researcher

[alignmentforum.org/posts/jP9KDyMkchuv6tHwm](https://www.alignmentforum.org/posts/jP9KDyMkchuv6tHwm/how-to-become-a-mechanistic-interpretability-researcher#Machine_Learning___Transformer_Basics)
· Neel Nanda · 2025

Not a paper but an opinionated roadmap into the field. Nanda's thesis is to
**learn the minimal basics as fast as possible, then learn by doing**: a
three-stage progression from *learning the ropes* (≤1 month) through 1–5 day
*mini-projects* to ambitious 1–2 week *full projects*. The *Machine Learning /
Transformer Basics* section is the concrete starting checklist: linear algebra
(3Blue1Brown), PyTorch fluency by coding a transformer from scratch, cloud GPU
setup, and using an LLM tutor to check understanding as you go.

*Why it matters:* it's the map for turning the methods above into actual
practice: what to learn, in what order, and when to stop reading and start
running experiments. A useful frame to keep alongside the
[Circuit Tracing](#circuit-tracing-revealing-computational-graphs-in-language-models)
methods so I don't mistake understanding the technique for being able to use it.
