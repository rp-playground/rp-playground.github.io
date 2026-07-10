---
layout: talk
title: "World Models — Yann LeCun at ETH Zurich"
speaker: "Yann LeCun"
event: "ETH Zurich"
talk_date: 2026-05-29
date: 2026-05-29   # attended live — watched date coincides with the talk date
link: https://bit.ly/PAth2AMI
link_label: "A Path Towards Autonomous Machine Intelligence ↗"
tags: [world models, JEPA, self-supervised, energy-based models]
summary: "LeCun's case against LLMs as a path to human-level AI, and for objective-driven world models trained with non-generative self-supervised learning (JEPA)."
---

Notes from Yann LeCun's **World Models** talk at ETH Zurich. The through-line is
blunt: current LLMs are a dead end for human-level AI. What's needed instead are
**objective-driven systems built around world models** that predict the
consequences of actions in an *abstract representation space*, trained by
**non-generative self-supervised learning** — his **JEPA** family, grounded in
energy-based models. The work sits under his new venture, **AMI Labs** (Advanced
Machine Intelligence).

## What intelligence actually is

LeCun opens with Piaget:

> Intelligence is not what you know, it's what you do when you don't know.

Intelligence is **not** an accumulation of declarative knowledge, and **not** a
collection of skills. It's *the ability to handle new situations with little or
no prior training* — and it should be measured by **speed of learning**, not by
performance on any single benchmark.

### Text is not enough

The data-volume argument that frames the whole talk:

- An LLM trains on ~$3\times10^{13}$ tokens (~$0.9\times10^{14}$ bytes). A human
  reading 9 hours a day would take **400,000 years** to get through it.
- A four-year-old child, through ~16,000 waking hours and ~2 million optic-nerve
  fibres at ~1 byte/sec, has absorbed ~$1.1\times10^{14}$ bytes.

> A four-year-old child has seen more data than an LLM.

Sensory data dwarfs text, so language alone cannot ground intelligence.

## Reactive agents vs. planning agents

Two ways to build an agentic system:

- **System 1 — action prediction.** State → action, directly. No reasoning, no
  way to imagine the effect of an action. *"This is how LLM-based agentic systems
  (VLA) work — or don't."*
- **System 2 — planning.** Use a **world model** to predict the consequences of
  candidate actions, and **search** for the actions that achieve the goal. This
  is the AMI Labs approach.

## Objective-driven AI

The proposed architecture for inference:

- **Perception** builds an initial world-state representation (plus a **memory**
  module).
- A **world model**, conditioned on a candidate **action sequence**, predicts the
  outcome.
- The predicted state feeds a **task objective** and a **guardrail objective**
  (safety constraints).
- Actions are **optimized** to minimize the task cost — applied
  auto-regressively *in representation space*, explicitly **akin to Model
  Predictive Control (MPC)**.

**Hierarchical planning** does this at multiple levels of abstraction and time
scales: each level produces **subgoals** for the level below.

## Why generative prediction fails

Self-supervised learning by generative prediction works for **discrete symbol
sequences** (text) but breaks down on high-dimensional, continuous, noisy data
(images, video, sensors). Predicting raw pixels gives **blurry, averaged**
results because the future isn't deterministic and MSE averages over the
possibilities.

The JEPA alternative:

- **JEPAs learn abstract representations** and predict *within* that latent
  space, so they can **ignore irrelevant, unpredictable detail** (noise).
- Generative architectures (VAE, MAE, diffusion, LLMs) must predict **every
  detail**.

> Token-based generative models simply do not work with high-dimensional,
> continuous, noisy data.

### The collapse problem

Joint-embedding networks can cheat by collapsing every input to a constant
embedding. Training must actively prevent this. Two families do so:

- **Distillation** — DINO, I-JEPA, V-JEPA.
- **Information maximization** — VICReg, Barlow Twins, and the newest, **SIGReg**.

The objective: maximize the information content of the embeddings while
minimizing prediction error. (A Google Scholar search for "JEPA" now returns
**1700+ papers**.)

## Energy-based models

LeCun frames EBMs as *"the only way to formalize and understand all model
types."* An EBM assigns **low energy** to compatible $(x, y)$ pairs and higher
energy to incompatible ones; inference is energy minimization,
$\hat{y} = \arg\min_y F(x, y)$.

Three regimes for shaping the energy surface:

1. **Collapse** — a flat surface (useless).
2. **Contrastive methods** — push energy down on data, up on contrastive points.
3. **Regularized methods** — limit the *volume* of low-energy space. LeCun's
   preferred route.

## LeJEPA / SIGReg

The talk's newest technical contribution (Balestriero & LeCun):

- **SIGReg — Sketched Isotropic Gaussian Regularization** — forces the embedding
  distribution toward an **isotropic Gaussian** via normality tests along many
  random 1-D projections.
- It captures degenerate subspaces and reshapes data to isotropic Gaussian even
  in high dimension with few samples.
- **LeWorldModel** combines an encoder/predictor trained with MSE + SIGReg;
  open-loop rollouts show the imagined future tracking reality on a robot-arm
  manipulation task.
- A follow-up result: under Gaussianity, **LeJEPA recovers the independent latent
  factors** of the data-generating process.

## What a world model should be

> A causal model that, given an observation of a system and an intervention on it,
> predicts the outcome of the intervention.

It should **not** be a world simulator, a digital twin, a generative model, or a
video generator. It **should** be an **action-conditioned predictor in abstract
representation space** — ideally differentiable — operating over a **hierarchy of
abstractions**: lower levels for short-range, detailed prediction; higher levels
for long-range, coarse prediction.

> Science and modeling are all about finding the right representation at the right
> level of abstraction.

## The results backing it up

- **I-JEPA** (CVPR 2023) — more compute-efficient than MAE/iBOT on
  semi-supervised ImageNet.
- **DINOv3** — *"the best generic image representation system in the world,
  entirely self-supervised"*; large gains on depth (+33%), tracking (+34%),
  segmentation (+22%) over weakly-supervised baselines.
- **V-JEPA 2** — *"the best video representation system in the world"*, trained
  on ~1M hours of unlabeled video; wins across EK100, SSv2, Diving48, video QA.
- **V-JEPA & intuitive physics** — common-sense physics emerges from
  self-supervised video pretraining, measurable via a violation-of-expectation
  "surprise" signal.

## What LeCun advocates

His closing recommendations to fellow AI scientists:

- Abandon **generative models** → use **joint-embedding architectures**.
- Abandon **probabilistic models** → use **energy-based models**.
- Abandon **contrastive methods** → use **regularized methods**.
- Abandon **reinforcement learning** as the core paradigm → use **model-predictive
  control**, falling back to RL only when planning fails.

And the line he leaves on screen:

> If you are interested in human-level AI, don't work on LLMs.

AMI Labs aims to build hierarchical JEPA world models that produce causal,
predictive models of complex systems directly from data — from biomedical and
physical sciences to aerospace (an Airbus A380 carries ~25,000 sensors sampled
~5000 times a second).
