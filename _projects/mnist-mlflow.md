---
layout: project
title: MNIST × MLflow + Optuna
summary: A deliberately trivial MNIST model wrapped in real MLOps — experiment tracking, hyperparameter search with pruning, and a model registry you serve by version.
date: 2026-06-06
tags: [MLflow, Optuna, MLOps, experiment tracking]
repo: https://github.com/rp-playground/play-mlflow/tree/main/mnist
---

This is the **systems** half of my learning portfolio. Where the
[bear detector](/projects/bear-detector/) says *"I evaluate honestly and
understand failure modes,"* this one is me learning to say *"I track, search,
version, and serve."* The model is trivial on purpose — MNIST is just an excuse I
already understand, so the dataset never gets in the way of learning the tools.

I picked one lens for this write-up: **system design with MLflow + Optuna**
(tracking, hyperparameter search, the model registry, and the artifacts each run
leaves behind). The same project also has an EDA lens and a calibration lens, but
those are separate stories.

> The point is the comparison and the engineering, not the accuracy. A 99% CNN on
> MNIST signals *"finished a tutorial"* — so I tried to make the interesting part
> everything *around* the model.

## The complexity ladder (the thing being tracked)

I train three models of increasing sophistication so there's something worth
comparing:

| Model | What it is | ~Test acc |
|-------|-----------|-----------|
| `logistic` | a single `Linear(784, 10)` | ~92% |
| `mlp_relu` | `Linear → ReLU → Linear` | ~98% |
| `conv_net` | 2× (conv → ReLU → pool) → classifier | ~99% |

The pedagogical nugget: without the `ReLU`, stacked linear layers collapse into a
single linear map — that one nonlinearity is what breaks the ~92% ceiling.

## Experiment tracking with MLflow

Every training is an MLflow **run**, and runs nest. The whole job is one parent
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
(`test_accuracy`, `test_macro_recall`, `test_ece`, per-class accuracy). The nice
thing I didn't expect: once everything is a logged run, the MLflow UI turns
"which model won and why" into a sortable table instead of a folder of notebooks.

## Hyperparameter search with Optuna

Instead of hand-picking learning rates, I let **Optuna** search. Each model has
its own study and its own little search space — every model tunes the learning
rate, then adds the knobs that actually apply to it:

- `logistic` → also `weight_decay`
- `mlp_relu` → also `hidden_dim` (64 / 128 / 256 / 512)
- `conv_net` → also `conv_channels` (16 / 32 / 64) and `dropout`

To make that possible I had to make the models **parametric** — Optuna needs a
seam to push hyperparameters through, so `build_model(name, hidden_dim=…,
conv_channels=…, dropout=…)` builds the architecture the trial asks for. **Each
trial is its own nested MLflow run**, so the search is fully visible afterwards.

Optuna then hands you a few plots for free. For the `conv_net` study:

<figure>
  <img src="/assets/mnist/optuna_history_conv_net.png" alt="Optuna optimization history for conv_net">
  <figcaption>Optimization history — each dot is a completed trial; the line is the best value so far. Only 5 dots show because the other 5 trials were pruned (see below).</figcaption>
</figure>

<figure class="narrow">
  <img src="/assets/mnist/optuna_param_importances_conv_net.png" alt="Optuna hyperparameter importances for conv_net">
  <figcaption>Which hyperparameter mattered most. For my conv net, <code>dropout</code> dominated (0.50), then <code>conv_channels</code> (0.29), then <code>lr</code> (0.21).</figcaption>
</figure>

<figure>
  <img src="/assets/mnist/optuna_parallel_coordinate_conv_net.png" alt="Optuna parallel coordinate plot for conv_net">
  <figcaption>Parallel coordinates — darker lines are better trials. The good ones run through wider conv channels (64) and lower dropout; <code>conv_channels=16</code> is the line that bottoms out at ~0.97.</figcaption>
</figure>

The importance plot was the moment it clicked for me: I'd assumed learning rate
would dominate, but for this tiny conv net the regularization knobs mattered more.
That's the kind of thing you only see if you actually log the search.

### Pruning: don't waste epochs on dead ends

A naïve search trains every trial to the end, even the obviously bad ones. Optuna's
**MedianPruner** fixes that: each trial reports its validation accuracy after every
epoch, and if it's trailing the median of past trials at the same epoch, the trial
is stopped early. In the run above, **5 of 10 trials were pruned** — roughly half
the search budget saved.

I wired this so a pruned trial ends as a `KILLED` run tagged `pruned=true` in
MLflow (not `FAILED`), because a pruned trial isn't a bug — it's the system
working. Small detail, but it keeps the run history honest.

## The model registry (the one senior-level decision)

After the ladder finishes, the best model by test accuracy — the `conv_net`, at
**~98.7%** with an ECE of **0.0023** — is registered as `mnist-classifier` and
given the alias `@champion`.

The decision I actually care about: **serving loads the model by alias/version
from the registry, never from a checked-in weights file.** `predict.py` asks for
`models:/mnist-classifier@champion` and gets whatever the current champion is. So
a rollback is a one-line alias change, not a redeploy. That indirection is the
spine of the whole design.

## Every run carries its own evidence

Because each final run logs failure-analysis figures as artifacts, the "how good
is it, really?" answer travels *with* the model version. The champion's
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

- **Once everything is a run, comparison is free.** The hardest part of "which
  model is better" turned out to be a sorting problem, not a bookkeeping one.
- **Search teaches you about your model.** The importance plot told me more about
  this conv net than its accuracy did.
- **Pruning is cheap leverage** — half the compute back for a few lines of code.
- **"Load by version" is the idea that scales** beyond MNIST: it's the same move
  whether the model is a 200k-param CNN or something serious.

**Next step:** package the champion behind a small demo on Hugging Face Spaces,
the same way the [bear detector](/projects/bear-detector/) is deployed — so this
page can embed a live, registry-backed prediction the way that one embeds its OOD
panel.
