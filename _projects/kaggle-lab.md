---
layout: project
title: kaggle-lab — reproducible experiment tracking
summary: A small framework that turns each Kaggle submission into a tracked, falsifiable run — changelog-first notebooks, auto-submit, score polling, and an append-only run log.
date: 2026-06-07
tags: [MLOps, experiment tracking, Kaggle, reproducibility]
repo: https://github.com/rp-playground/kaggle-lab
writeup: /writing/kaggle-lab/
---

The framework behind the [write-up](/writing/kaggle-lab/). On Kaggle I could see the
scores, but I couldn't reconstruct which change produced which number, or whether an
idea I'd "tried" had been submitted or just thought about. So I made every submission
a run: a *change* and a *hypothesis* written **before** I see the score, which makes
each run a claim to be proved correct. The notebook
runs with papermill, gets submitted and polled, and lands as a parent→child row in
`runs.jsonl`. I never edit a record — corrections go in as new rows with `supersedes`.

<figure>
  <img src="/assets/kaggle-lab/tree.png" alt="kaggle-lab tree output for the Ames run: one parent with six child attempts, only one improving the score; deltas coloured red for regressions and green for improvements" style="width:100%;border-radius:8px;">
  <figcaption style="color:#8b949e;font-size:0.9rem;margin-top:0.5rem;"><code>kaggle-lab tree</code> on the Ames run — one parent, six attempts, one winner, and even the winner has a regressing child. Red is a regression versus the parent run, green an improvement.</figcaption>
</figure>

I used it on the Ames house prices competition: 37 runs, public RMSE
**16704 → 12438** (~26% lower), best leaderboard position **98**. The score is
irrelevant here; what matters is the log. 15 of those 37 runs made things
worse and they're all still in it. The full story is in the [write-up](/writing/kaggle-lab/).

I know MLflow and W&B exist. I started with a flat `runs.jsonl` on purpose: it's
greppable, diffable, and needs no server, and it was the smallest thing that made
every run reproducible. Mapping it onto MLflow for a UI and a model registry is a
deliberate next step.
