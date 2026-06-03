---
layout: project
title: Bear detector
summary: A 3-class bear classifier (black / grizzly / teddy) with a live out-of-distribution panel.
date: 2026-06-01
tags: [PyTorch, OOD detection, calibration]
demo: https://rfflpllcn-bear-detector.hf.space
repo: https://github.com/rp-playground/play-pytorch/tree/main/course.fast.ai/lesson2
writeup: /writing/ood-detection/
---

A ResNet-18 transfer-learned onto a 3-class head, built in pure PyTorch from
[fast.ai lesson 2](https://course.fast.ai/Lessons/lesson2.html). Upload a bear
and it returns per-class probabilities — plus a **live OOD panel**: the energy
score, an honest in-distribution / out-of-distribution verdict, and a TPR slider
that moves the decision threshold so you can watch the trade-off in real time.

It is **closed-set**: feed it a non-bear and softmax still confidently picks a
bear. Rather than hand-wave that failure, I measured it — the
[write-up](/writing/ood-detection/) compares MSP and energy as post-hoc OOD
signals on real data, with an honest negative result on the near-OOD case.
