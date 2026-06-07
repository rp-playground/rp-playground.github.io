---
layout: article
title: "A reproducible Kaggle log, regressions included"
description: A small experiment-tracking framework for Kaggle — changelog-first runs, auto-submit, score polling, and an append-only log. The useful part wasn't the leaderboard climb; it was the 15 regressions it made me keep.
summary: I built a tiny framework so every Kaggle submission was a falsifiable run. The leaderboard went 16704 → 12438, but the thing I actually got from it was an honest log of the 15 ideas that made the score worse.
date: 2026-06-07
tags: [MLOps, experiment tracking, Kaggle, reproducibility]
---

*Code: [kaggle-lab on GitHub](https://github.com/rp-playground/kaggle-lab).*

On Kaggle I could see the scores on the leaderboard, but I couldn't reconstruct which change produced which number, 
or whether an idea I'd 'tried' had actually been submitted or just thought about.
So before going further I stopped and built a small framework, 
kaggle-lab. The rule is that every submission is a run, and every run states what changed and 
why before I see its score.

The hypothesis-first ordering is the part that matters to me. If I write the hypothesis after the score comes
back, I'll always have a story for why the number went the way it did. Writing it
first makes each run a claim that can be wrong.

## The loop

A run is a notebook with a mandatory changelog cell at the top:

```
## Changelog
- parent: 20260509_185237_7b512dcb
- change: apply np.log1p to LotArea and LotFrontage
- hypothesis: both are heavily right-skewed; log-space should help the linear branch
```

`kaggle-lab run notebook.ipynb` then executes it with papermill, checks the git tree
is clean (so the code state is pinned by SHA), submits the output CSV to Kaggle,
polls the submissions endpoint until the score lands, and appends one JSON line to
`runs.jsonl`. Each line carries the run id, the parent it was derived from, the
git SHA, a SHA1 of the submission file (so I can't silently re-submit the same CSV),
the changelog, and the Kaggle score.

The `parent` field is what turns the log from a list into a tree. I can ask for the
graph with `kaggle-lab tree` and read the actual shape of the search — where I
branched, backed out, and branched again.

## The log is append-only

I never edit a row. When a record is wrong, I append a new one that supersedes it,
and the tooling collapses the log to the latest version per run when it displays.

The first time it mattered was when I looked closely at my best run. Its
changelog said `dropped additional outliers`, and the score, 12438.54, was my lowest
RMSE. But the notebook it pointed at actually did something else: it applied
`log1p` to `LotArea` and `LotFrontage`. The extra outlier rules in the changelog
were from an *earlier* version of the same notebook that had regressed by +123 and
been rolled back. My headline result had the wrong explanation attached to it.

I fixed it the way the framework is supposed to be fixed — a new row, `supersedes`
pointing at the original, with the correct change and hypothesis. The raw log still
shows the wrong line; the canonical state — what the tooling shows after collapsing to the latest record 
per run — shows the correction. This is what an append-only log is for: 
I relabelled my best result, and both the wrong line and the correction stay visible.

## The climb wasn't a climb

The leaderboard hides this part. The public score went from a 16704.57
baseline to 12438.54, about 26% lower, over 37 submissions. As a list of new bests
it looks like a tidy staircase. It wasn't. 15 of those 37 runs made the score
**worse** than their parent, and they're all still in the log.

The worst ones, by margin:

| Idea | Public RMSE | Δ vs parent |
|---|---|---|
| Keep only the top-20 mutual-information features | 17088.61 | +2368.82 |
| Target-encode `MSSubClass` | 16406.12 | +770.51 |
| Halve learning rate, double estimators | 16223.41 | +587.80 |
| Tighten the outlier rule to `TotalSF > 4000` | 12935.14 | +430.85 |
| Two extra outlier rules on `OverallCond` / `GrLivArea` | 12578.33 | +123.41 |
| Drop the single `MiscVal = 15500` row | 12576.17 | +121.24 |
| Drop 8 low-mutual-information features | 12531.23 | +92.69 |

The top row is my favourite mistake. Cutting to the 20 highest mutual-information
features felt like principled feature selection; it cost me 2369 RMSE points and was
the worst submission of the whole run. The lesson held later, too: a much gentler
version of the same idea near the end of the project (dropping 8 low-MI features)
also regressed, by +93. Mutual-information selection just doesn't help on this
dataset, at any scale, and I have two dated submissions that say so.

The tree makes the branching legible:

```
└── …_8ba3b592             add a fixed 20% holdout split          12504.287
    ├── …_c0eafc00         tighten outlier rule TotalSF>4000      12935.137  (+430.850)
    └── …_7b512dcb         Condition1/Condition2 → nearness       12454.923  (-49.364)
        ├── …_2eac7881     drop the MiscVal=15500 row             12576.166  (+121.243)
        ├── …_d4ef4058     LivLotRatio + Spaciousness ratios      12503.301  (+48.378)
        ├── …_8dae47d7     extra outlier rules                    12578.333  (+123.410)
        └── …_a1fc65f7     log1p(LotArea)+log1p(LotFrontage)      12438.541  (-16.383)
```

That last node is the best run; the siblings above it are regressions I tried from
the same parent before it (the full tree has a couple more). If I'd pruned the
failures I'd have a cleaner story and a less useful one. The notebooks for the
regressions ship in the repo alongside the winners, so each dead-end is
reproducible.

## What I'd keep

A few things generalised past this one competition:

- **Hypothesis-first changes the work.** Once the claim is written before the score,
  a regression is information instead of something to delete.
- **Stacking beat blending, measurably.** A `Ridge(alpha=1, positive=True)`
  meta-learner over out-of-fold predictions beat the equal-weight average of the
  same base models by about 88 RMSE points. With the log I could attribute that to
  the one change instead of guessing.
- **The CV–LB gap is real on small tabular data.** With 1455 rows over 5 folds, 
  each validation fold is small enough that the CV score is noisy — it shifts with how the rows land in folds,
  not just with the model — and local CV disagreed with the leaderboard more than once. 
  That's why I added a fixed 20% holdout as a third, untouched check.

## Where I'd take it next

Two directions interest me. Neither is built yet.

**Let an agent drive the loop.** The log is already machine-readable. Each run
states a change and a hypothesis, carries its parent, and records the score that
change produced — most of what an agent would need to run the search itself: read
the tree, propose the next change with a written hypothesis, submit it through the
same `run` path, read the new score, repeat. Karpathy's framing of an autonomous research
loop is the obvious reference here.

**Put it on MLflow.** `runs.jsonl` is greppable and needs no server, which is why I
started there. MLflow maps onto it cleanly: a kaggle-lab run becomes an MLflow run,
the changelog becomes params and tags, the public score a metric, the notebook and
submission CSV artifacts, and `parent_run_id` a nested run. In return I'd get a UI to
sort and compare runs and a model registry to serve a chosen submission by version —
the loop I built separately on an [MNIST project](/writing/mnist-mlflow/).

## What it isn't

It isn't a way to win Kaggle. The artifact I care about is the log: 37 runs, 15 of them failures,
each one a claim I can check against a SHA and a date.