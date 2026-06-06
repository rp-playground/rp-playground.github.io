---
layout: project
title: MNIST classifier — versioned serving
summary: The MLflow champion MNIST model, served by version from the Hugging Face Hub — a live, registry-backed demo with a system panel.
date: 2026-06-06
tags: [MLflow, Optuna, MLOps, Hugging Face]
demo: https://rfflpllcn-mnist-mlflow.hf.space
repo: https://github.com/rp-playground/play-mlflow/tree/main/mnist
writeup: /writing/mnist-mlflow/
---

The deployable companion to the [MLflow + Optuna write-up](/writing/mnist-mlflow/).
A trivial `conv_net` is the **champion** chosen by an Optuna search and registered
in MLflow; this Space loads it **by revision** from the Hugging Face Model Hub —
never from a checked-in weights file — so promoting a new champion is a tag move,
not a redeploy.

Draw or upload a digit for a prediction; the **system panel** surfaces the served
revision, the champion's metrics, and the failure-analysis artifacts it was chosen
by. The model is incidental on purpose — the point is the versioned serving path.
