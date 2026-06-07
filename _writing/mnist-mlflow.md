---
layout: article
title: MNIST × MLflow + Optuna
description: A deliberately trivial MNIST model wrapped in real MLOps — experiment tracking, hyperparameter search with pruning, and a model registry you serve by version.
summary: A deliberately trivial MNIST model wrapped in real MLOps — experiment tracking, hyperparameter search with pruning, and a model registry you serve by version.
date: 2026-06-06
tags: [MLflow, Optuna, MLOps, experiment tracking]
---

*Code: [play-mlflow/mnist on GitHub](https://github.com/rp-playground/play-mlflow/tree/main/mnist).*

I pick MNIST and look at it from three angles. MNIST itself is just the excuse — a
dataset I already understand, so nothing about the data distracts from the part I'm
actually trying to learn. The real goal is the **frameworks, tools and techniques**,
and the *reasoning* around deliberately trivial models rather than chasing accuracy.

The three angles:

## 1. System design — MLflow + Optuna

*Goal: learn the experiment-tracking / model-registry / serving loop, and add
hyperparameter search on top of it.*

## 2. Exploratory data analysis

*Goal: actually look at the data before/around modelling.*

## 3. Confidence calibration

*Goal: go past "99% accuracy" and learn where and how confidently the model is wrong.*

This write-up is the first angle: **system design with MLflow + Optuna** —
tracking, hyperparameter search, the model registry, and the artifacts each run
leaves behind. Angles 2 and 3 are separate pieces.

## The complexity ladder

I train three models of increasing sophistication so there's something worth
comparing:

| Model | What it is | ~Test acc |
|-------|-----------|-----------|
| `logistic` | a single `Linear(784, 10)` | ~92% |
| `mlp_relu` | `Linear → ReLU → Linear` | ~98% |
| `conv_net` | 2× (conv → ReLU → pool) → classifier | ~99% |

The `ReLU` is the rung that matters: without it, any number of stacked linear
layers collapses back into one, and you're stuck at the ~92% ceiling.

## Experiment tracking with MLflow

Every training is an MLflow **run**. The whole job is one parent run, and under it
each model gets a *search* phase and a *final* phase:

```
compare
├── logistic-search ── logistic-trial-0 … logistic-trial-9
├── logistic            (final — retrained on the best trial)
├── mlp_relu-search ── mlp_relu-trial-0 …
├── mlp_relu            (final)
├── conv_net-search ── conv_net-trial-0 …
└── conv_net            (final)
```

Each run logs its params (learning rate, parameter count, the tuned
hyperparameters), per-epoch `train_loss` / `val_accuracy`, and final test metrics
(`test_accuracy`, `test_macro_recall`, `test_ece`, `per-class accuracy`). The payoff
comes once every run is logged: the MLflow UI turns "which run won, and why" into
something you answer by sorting a table.

## Hyperparameter search with Optuna

I let **Optuna** do the searching. Each model gets its own study and its own small
search space — every model tunes the learning rate, then adds:

- `logistic` → `weight_decay`
- `mlp_relu` → `hidden_dim` (64 / 128 / 256 / 512)
- `conv_net` → `conv_channels` (16 / 32 / 64) and `dropout`

For that to work the models have to be **parametric**: `build_model(name,
hidden_dim=…, conv_channels=…, dropout=…)` builds whatever architecture Optuna asks
for.

Optuna then hands you a few plots for free. For the `conv_net` study:

<figure>
  <img src="/assets/mnist/optuna_history_conv_net.png" alt="Optuna optimization history for conv_net">
  <figcaption>Optimization history — each dot is a completed trial; the line is the best value so far. Only 4 dots show because the other 6 trials were pruned (see below).</figcaption>
</figure>

<figure class="narrow">
  <img src="/assets/mnist/optuna_param_importances_conv_net.png" alt="Optuna hyperparameter importances for conv_net">
  <figcaption>Optuna's fANOVA importance — but with only 4 completed trials it's noisy: here <code>dropout</code> and <code>conv_channels</code> tie (~0.36) and <code>lr</code> trails (0.28), and the ranking wobbles if you rerun it.</figcaption>
</figure>

<figure>
  <img src="/assets/mnist/optuna_parallel_coordinate_conv_net.png" alt="Optuna parallel coordinate plot for conv_net">
  <figcaption>Parallel coordinates — a custom version of Optuna's plot (its default colours every line in near-identical shades of blue, so when all trials score ~0.98 you can't tell them apart). Here line colour is val accuracy (viridis) and the best trial is the bold red line. The winner runs <code>conv_channels=16</code> with low dropout and a mid learning rate; the same <code>conv_channels=16</code> with too small a learning rate is the dark line that bottoms out at ~0.975.</figcaption>
</figure>

The parallel-coordinate plot is the one I trust here: the two `conv_channels=16`
trials differ mostly in learning rate and span 0.975 → 0.989, so width and learning
rate clearly swing the result. The fANOVA importance plot is shakier — with only
four completed trials its ranking wobbles between runs, which is a good reminder
that importances need many more trials before they mean much.

### Pruning

A naïve search trains every trial to the end, even the obviously bad ones. Optuna's
**MedianPruner** stops them early: each trial reports its validation accuracy after
every epoch, and if it falls below the median of past trials at the same epoch, the
trial is killed on the spot. In the run above, **6 of 10 trials were pruned** — more
than half the search budget saved for no loss in result.

In MLflow a pruned trial ends as a `KILLED` run tagged `pruned=true` (not `FAILED`),
so you can tell "we stopped this on purpose" apart from "this crashed."

## The model registry

After the ladder finishes, the best model by test accuracy — the `conv_net`, at
**~98.9%** with an ECE of **0.0023** — is registered as `mnist-classifier` and
given the alias `@champion`.

The part I actually wanted to learn is here: **serving loads the model by
alias/version from the registry, never from a checked-in weights file.**
`predict.py` asks for `models:/mnist-classifier@champion` and gets whatever the
current champion is. A rollback is a one-line alias change, not a redeploy.

## Every run carries its own evidence

Each final run logs its failure-analysis figures as artifacts, so the evidence
travels with the model instead of living in a notebook somewhere. The champion's
calibration, for example:

<figure class="narrow">
  <img src="/assets/mnist/reliability_diagram_conv_net.png" alt="Reliability diagram for the champion conv_net">
  <figcaption>Reliability diagram with a count histogram. The model sits almost on the diagonal (ECE ≈ 0.002), and the histogram shows why: nearly all predictions land in the high-confidence bin, and there they're right.</figcaption>
</figure>

<figure class="narrow">
  <img src="/assets/mnist/confusion_matrix_conv_net.png" alt="Confusion matrix for the champion conv_net">
  <figcaption>Confusion matrix for the champion — the few mistakes that remain are the intuitive ones (4↔9, 3↔5).</figcaption>
</figure>

## What I took away

- **Once everything is a run, comparison is free.** "Which model is better"
  becomes a sorting problem.
- **Search matters** — but importances need many trials before you can trust them.
- **Pruning is cheap** and saves a real chunk of the compute budget.
- **Loading by version** is the piece I'll reuse everywhere: serve by alias,
  roll back with a tag.

The champion is deployed as a registry-backed
[live demo](/projects/mnist-mlflow/) — loaded by revision from the Hugging Face
Hub, with a system panel showing exactly which version is being served.

## Knowing when it's not a digit

The deployed demo is **closed-set**, exactly like my
[bear detector](/projects/bear-detector/): softmax always picks one of the ten
classes, so it will happily call a drawing of a flower a "9" with 53% confidence.
The Space adds the same fix I used there — an **energy score** (`-logsumexp` of the
logits; Liu et al., 2020) compared against a threshold calibrated on real MNIST
digits (in-distribution) versus FashionMNIST (near-OOD). Low energy means
"digit-like"; high energy flags out-of-distribution.

At a TPR of 0.95 the threshold keeps 95% of real digits while letting only ~4% of
FashionMNIST leak through as "digit", and a slider moves that operating point live.
It's the same trade-off as the [bear detector's OOD study](/writing/ood-detection/):
thin `1`s land near the boundary and get rejected as "not a digit" at a strict TPR.
But the model can finally say *that isn't a digit* instead of confidently guessing.
</content>
