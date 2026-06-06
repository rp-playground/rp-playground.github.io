---
layout: article
title: MNIST × MLflow + Optuna
description: A deliberately trivial MNIST model wrapped in real MLOps — experiment tracking, hyperparameter search with pruning, and a model registry you serve by version.
summary: A deliberately trivial MNIST model wrapped in real MLOps — experiment tracking, hyperparameter search with pruning, and a model registry you serve by version.
date: 2026-06-06
tags: [MLflow, Optuna, MLOps, experiment tracking]
---

*Code: [play-mlflow/mnist on GitHub](https://github.com/rp-playground/play-mlflow/tree/main/mnist).*

I pick MNIST and look at it from three different angles. MNIST itself is just the excuse — a dataset I
already understand. The real goal is to **learn new frameworks, tools and techniques**, and build/document the *reasoning*
around deliberately trivial models rather than chasing accuracy.

The three perspectives are:

## 1. System design — MLflow + Optuna

*Goal: learn the experiment-tracking / model-registry / serving loop, and add
hyperparameter search on top of it.*

## 2. Exploratory data analysis

*Goal: actually look at the data before/around modelling.*

## 3. Confidence calibration

*Goal: go past "99% accuracy" and learn where and how confidently the model is wrong.*

For the present write-up I pick: **system design with MLflow + Optuna**
(tracking, hyperparameter search, the model registry, and the artifacts each run
leaves behind). Perspectives 2. and 3. are separate stories.

## The complexity ladder

I train three models of increasing sophistication so there's something worth
comparing:

| Model | What it is | ~Test acc |
|-------|-----------|-----------|
| `logistic` | a single `Linear(784, 10)` | ~92% |
| `mlp_relu` | `Linear → ReLU → Linear` | ~98% |
| `conv_net` | 2× (conv → ReLU → pool) → classifier | ~99% |

Without the `ReLU`, any number of stacked linear layers collapses into one — it's ReLU that breaks the ~92% accuracy.

## Experiment tracking with MLflow

Every training is an MLflow **run**. The whole job is one parent
run, and under it each model gets a *search* phase and a *final* phase:

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
(`test_accuracy`, `test_macro_recall`, `test_ece`, `per-class accuracy`). The nicest
thing: once every run is logged, the MLflow UI makes it incredibly easy to explore the winner run and understand why (easy like sorting a table).

## Hyperparameter search with Optuna

I let **Optuna** search. Each model has
its own study and its own little search space — every model tunes the learning
rate, then adds:

- `logistic` → `weight_decay`
- `mlp_relu` → `hidden_dim` (64 / 128 / 256 / 512)
- `conv_net` → `conv_channels` (16 / 32 / 64) and `dropout`

To make that possible I had to make the models **parametric**, so `build_model(name, hidden_dim=…,
conv_channels=…, dropout=…)` builds the architecture Optuna needs. 

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
  <figcaption>Parallel coordinates — line colour is val accuracy (viridis), and the best trial is the bold red line. The winner runs <code>conv_channels=16</code> with low dropout and a mid learning rate; the same <code>conv_channels=16</code> with too small a learning rate is the dark line that bottoms out at ~0.975.</figcaption>
</figure>

The parallel-coordinate plot is the one I actually trust here: the two
`conv_channels=16` trials differ mostly in learning rate and span 0.975 → 0.989,
so width and learning rate clearly swing the result. The fANOVA importance plot
is shakier — with only four completed trials its ranking wobbles between runs,
a good reminder that importances need many more trials to mean much. (I also
swapped in my own parallel-coordinate plot: Optuna's default colours every line
in near-identical shades of blue, so when all trials score ~0.98 you can't tell
them apart.)

### Pruning

A naïve search trains every trial to the end, even the obviously bad ones. Optuna's
**MedianPruner** fixes that: each trial reports its validation accuracy after every
epoch, and if it's trailing the median of past trials at the same epoch, the trial
is stopped early. In the run above, **6 of 10 trials were pruned** — well over half
the search budget saved.

In MLflow a pruned trial ends as a `KILLED` run tagged `pruned=true` (not `FAILED`).

## The model registry

After the ladder finishes, the best model by test accuracy — the `conv_net`, at
**~98.7%** with an ECE of **0.0023** — is registered as `mnist-classifier` and
given the alias `@champion`.

**Serving loads the model by alias/version
from the registry, never from a checked-in weights file.** `predict.py` asks for
`models:/mnist-classifier@champion` and gets whatever the current champion is. So
a rollback is a one-line alias change, not a redeploy. 

## Every run carries its own evidence

Each final run logs failure-analysis figures as artifacts. The champion's
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

- **Once everything is a run, comparison is free.** The task of investigating "which
  model is better" becomes a sorting problem.
- **How critical Search is.** The importance plot tells far more about a model than its accuracy.
- **Pruning is cheap and resources saving**.
- **"Load by version" is cool**.

The champion is deployed as a registry-backed
[live demo](/projects/mnist-mlflow/) — loaded by revision from the Hugging Face
Hub, with a system panel showing exactly which version is being served.