---
layout: paper
title: "A Baseline for Detecting Misclassified and Out-of-Distribution Examples in Neural Networks"
authors: "Hendrycks & Gimpel"
paper_year: 2017
link: https://arxiv.org/abs/1610.02136
date: 2026-06-05
tags: [OOD detection, calibration]
summary: "The MSP baseline: maximum softmax probability separates correct/in-distribution from wrong/OOD inputs surprisingly well."
---

The paper that established **maximum softmax probability (MSP)** as the baseline
for out-of-distribution detection. The core observation:

> the prediction probability of incorrect and out-of-distribution examples tends
> to be lower than the prediction probability for correct examples.

## Why it stuck with me

It is the reference point every later OOD method is measured against — including
the energy score I compared it to on my own
[bear detector](/writing/ood-detection/). On a tiny 3-class head the MSP is
squeezed into `[1/3, 1]`, yet it still held up better than energy on the
near-OOD case. A good reminder that a simple, well-understood baseline is hard
to beat when the model is small.
