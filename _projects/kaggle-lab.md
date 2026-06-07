---
layout: project
title: kaggle-lab — reproducible experiment tracking
summary: A small framework that turns each Kaggle submission into a tracked, falsifiable run — changelog-first notebooks, auto-submit, score polling, and an append-only run log.
date: 2026-06-07
tags: [MLOps, experiment tracking, Kaggle, reproducibility]
repo: https://github.com/rp-playground/kaggle-lab
writeup: /writing/kaggle-lab/
---

The framework behind the [reproducible-Kaggle write-up](/writing/kaggle-lab/). I
got tired of Kaggle work being a pile of undated notebooks I couldn't trust, so I
made every submission a tracked run: a *change* and a *hypothesis* written before I
see the score, the notebook executed with papermill, submitted to Kaggle, polled
for its result, and appended as a parent→child row in `runs.jsonl`. Records are
never mutated — corrections go in as new rows with `supersedes`.

I drove it through a real competition (Ames house prices): 37 runs, public RMSE
**16704 → 12438** (~26% lower), best leaderboard position **98**. The score is
incidental. What the framework actually bought me is in the [write-up](/writing/kaggle-lab/):
an honest log that kept all 15 regressions, so the experiment graph shows the
dead-ends, not just the clean climb. There's no live demo here — it's a CLI and a
log format, not a model.
