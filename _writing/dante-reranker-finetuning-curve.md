---
layout: article
title: "Fine-Tuning a Verse Reranker: A Scaling Curve With Two Answers"
subtitle: "In-style accuracy saturates at 1,200 queries; on a validated transfer set, more data buys ranking depth, not top-1"
description: I fine-tuned a cross-encoder reranker for Dante verse retrieval on a synthetic dataset and measured a data-scaling curve. On the in-style eval the curve saturates at 1,200 queries; on a human-validated ecological transfer set, fine-tuning beats the zero-shot reranker by +0.033 Recall@1, and more data improves Recall@5 and MRR even though top-1 ties.
summary: I fine-tuned a cross-encoder reranker on synthetic (query, gold tercet) pairs and measured how accuracy scales with the amount of training data. On the in-style evaluation set the curve peaks at 1,200 queries and then drifts down — more data of the same generated style overfits the style. On a human-validated ecological transfer set, fine-tuning beats the zero-shot reranker by +0.033 Recall@1; on top-1 the small and full models tie, but the full model wins Recall@5 and MRR — more data buys ranking depth, not top-1. Fine-tuning lifts accuracy but misses the pre-registered transfer gate, so the next levers are the negatives and the loss, not more data.
date: 2026-07-19
tags: [reranking, fine-tuning, cross-encoder, scaling, evaluation, Divine Comedy]
published: true
permalink: /writing/dante-reranker-finetuning-curve/
---

This article continues my work on *DanteGPT*, a semantic search system for Dante's
*Divine Comedy*. Two earlier pieces set it up: [the reality gap](/writing/dante-retrieval-reality-gap/)
identified reranking as the bottleneck, and [the synthetic data
pipeline](/writing/dante-reranker-finetuning-dataset/) produced the `(query, gold
tercet)` pairs. This one fine-tunes the reranker on those pairs and asks a single
question: **how much does accuracy improve as I add training data, and where does
it stop?**

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## The setup

The base model is `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`, the best zero-shot
reranker I measured (~33M params). I built a nested scaling curve: four training
instances at n ∈ {1,200, 2,400, 3,600, 4,549} queries, each a strict prefix of the
next, so the curve isolates *quantity* from sample composition. Every instance
starts from the same base checkpoint — never continued training — with identical
hyperparameters (lr 2e-5, 1 epoch, 10% warmup, batch 128). Only `n` varies.

Each fine-tuned model reranks the top-50 candidates from a query-aware RRF base,
exactly as the production pipeline does. I evaluate on two sets:

- **in-style** — `together_deepseek_250` (n=236), drawn from the same generator
  and query-type taxonomy the training pairs came from;
- **transfer** — a **human-validated** whole-Inferno, cross-canto, deliberately
  noisy set (n=427, every gold checked by a human annotator, 41 rows with
  multiple acceptable golds). No part of the training pipeline was tuned against
  it. This is the set that approximates real use, and the one the [reality
  gap](/writing/dante-retrieval-reality-gap/) article introduced.

The bar to beat is the zero-shot reranker: **0.708 R@1 in-style, 0.475 on
transfer.**

## The curve

<figure>
  <img src="/assets/dante-reranker-finetuning-curve/fig_scaling_curves.svg" alt="Line chart 'Transfer top-1 saturates; transfer ranking-depth keeps improving'. X-axis training queries n at 1200, 2400, 3600, 4549. Blue solid line 'in-style R@1' starts at 0.750 and drifts down to 0.742, above a dashed blue in-style zero-shot baseline at 0.708. Orange dashed line 'transfer R@1' is flat near 0.51 (0.508, 0.515, 0.511, 0.508) above a dashed orange transfer zero-shot baseline at 0.475. Orange dotted line 'transfer R@5' rises monotonically from 0.635 to 0.658.">
  <figcaption>In-style R@1 peaks at n=1,200 and drifts down; transfer R@1 is flat at ~0.51 across all four instances; transfer R@5 climbs monotonically with data. Dashed horizontal lines are the zero-shot baselines.</figcaption>
</figure>

| instance | in-style R@1 | transfer R@1 | transfer R@5 | transfer MRR@10 |
|---|---|---|---|---|
| zero-shot baseline | 0.708 | 0.475 | 0.609 | 0.531 |
| reranker-ft-n1200 | **0.750** | 0.508 | 0.635 | 0.566 |
| reranker-ft-n2400 | 0.746 | **0.515** | 0.635 | 0.570 |
| reranker-ft-n3600 | 0.733 | 0.511 | 0.646 | 0.568 |
| **reranker-ft-n4549 (full)** | 0.742 | 0.508 | **0.658** | **0.573** |

The two sets read differently, and that difference is the result:

- **In-style, the curve saturates at n=1,200** (0.750) and then drifts *down*.
  Adding more data of the same generated style overfits the style rather than the
  task.
- **On transfer, fine-tuning clears the zero-shot bar by +0.033 R@1** (0.475 →
  0.508) — but top-1 then *saturates immediately*. Recall@1 stays near 0.51 across
  all four instances (0.508, 0.515, 0.511, 0.508 — a ±3-query wobble on 427).
  What keeps improving is **ranking depth**: transfer Recall@5 climbs
  monotonically (0.635 → 0.658) and MRR@10 rises to 0.573. More data does not
  raise top-1 on the transfer set; it pulls more gold tercets into the top-5.

Reading only in-style R@1 would have concluded "1,200 queries are enough," and
transfer R@1 agrees — but transfer Recall@5 keeps rewarding data all the way to
full scale. I adopt the **full model (`n4549`)**: it ties on top-1 transfer, wins
Recall@5/MRR, and sits within 2 queries of the in-style peak. The training
dev-loss fell monotonically across the curve (0.132 → 0.114), consistent with —
but, on its own, blind to — this split between top-1 and ranking depth.

## Where the fine-tuning actually acts

The flat in-style aggregate hides a slice-level redistribution. Breaking Recall@1
down by query type shows the aggregate is a sum of movements in different
directions, not a uniform lift.

<figure>
  <img src="/assets/dante-reranker-finetuning-curve/fig_slice_redistribution.svg" alt="Grouped bar chart 'Where fine-tuning acts: slice-level redistribution (in-style R@1)'. Five query-type slices, each with three bars: grey baseline, blue n1200, aqua n4549 full. scene_recall_it (n=35): 0.80 / 0.83 / 0.77 — peaks at n1200 then falls. knowledge_required_it (n=33): 0.55 / 0.58 / 0.64 — climbs with data. entity_it_descriptor (n=12): 0.33 / 0.33 / 0.50 — climbs to full. entity_en_name (n=11): 0.27 / 0.46 / 0.36 — peaks at n1200. entity_it_name (n=12): 0.33 / 0.33 / 0.33 — flat at every scale.">
  <figcaption>Recall@1 per query type: zero-shot baseline vs n1200 vs full. Large in-style slices (scene_recall) peak early and fall; knowledge/periphrasis slices climb to full scale.</figcaption>
</figure>

- **Large in-style slices peak early.** `scene_recall_it` (n=35) rises to 0.829 at
  n1200 then falls to 0.771 at full — these are the slices that make the in-style
  aggregate flat.
- **Knowledge and periphrasis slices climb to full.** `knowledge_required_it`
  (0.545 → 0.636) and `entity_it_descriptor` (0.333 → 0.500) keep improving — and
  these are the same slices that drive the transfer gain.
- **Proper-name lookup does not move.** `entity_it_name` sits at 0.333 at *every*
  scale. Fine-tuning the reranker cannot fix it because the bottleneck is upstream:
  the correct tercet is often not in the candidate set to begin with. This is an
  *ambiguity* problem, addressable by a query-rewriting / disambiguation step —
  reduce the query's ambiguity, ask the user to clarify, or expand it with the
  entity's canonical name — not by more reranker training.

A caveat on reading this chart, which the significance tests below make precise:
these slices have n = 8–35, and *none* of the per-slice movements are
statistically significant — every paired test is one or two flipped queries. Read
the bars as direction, not evidence; the real signal is in the aggregate transfer
numbers.

## The gate I set, and missed

Before training I pre-registered a go/no-go criterion so I couldn't rationalize a
weak result after the fact: **transfer R@1 ≥ 0.60 at full scale.** The full model
reached **0.508**. It misses.

That is an honest negative on the headline goal, with a *statistically real* gain
underneath it. Paired McNemar tests on the validated transfer set (n=427) put the
positive verdict on solid ground — and locate it in the aggregate:

| comparison | Δ | McNemar p | verdict |
|---|---|---|---|
| transfer R@1, baseline → full | +0.042 | **0.006** | significant |
| transfer R@5, baseline → full | +0.052 | **0.0001** | strongly significant |
| transfer R@5, n1200 → full | +0.024 | **0.021** | more data ⇒ more depth |
| transfer R@1, n1200 → full | +0.009 | 0.52 | top-1 saturated |

The per-slice movements, by contrast, are all within noise — every paired test is
one or two flipped queries, with hugely overlapping Wilson intervals even on the
largest slice:

| slice (in-style R@1) | n | n1200 → full | McNemar p |
|---|---|---|---|
| `scene_recall_it` | 35 | 0.829 → 0.771 | 0.50 — *not a real regression* |
| `knowledge_required_it` | 33 | 0.576 → 0.636 | 0.50 |
| `entity_it_descriptor` | 12 | 0.333 → 0.500 | 0.50 |
| `entity_en_name` | 11 | 0.545 → 0.455 | 1.00 |

So the apparent `scene_recall_it` regression at full scale is not real, and the
slice chart above should be read as *direction*, not evidence — the signal lives
in the aggregate. But the recall@50 ceiling of this pipeline is 0.743, and the
fine-tuned reranker recovers only part of the gap between 0.475 and that ceiling.
**Fine-tuning the reranker helps — significantly — but it does not close the
reality gap on its own.**

## Next steps

The scaling curve rules out the simplest lever and points at three others.

1. **Not "more data of the same style."** The in-style curve is saturated at
   n=1,200; generating more DeepSeek-style queries would add in-style pairs that
   the model already ignores. Data *quantity* is not the constraint.
2. **Better negatives.** The training negatives are mined with the dense encoder
   (e5) alone. RRF-faithful negatives — the union with the top-k BM25 confusions
   the production fusion actually surfaces — would teach the reranker to fix the
   mistakes it will really see, not just the dense encoder's.
3. **A ranking loss.** The current recipe is per-pair binary cross-entropy, which
   scores each `(query, passage)` in isolation. A listwise / margin ranking loss
   optimizes the *order* within a candidate set — which is what Recall@1 and MRR
   actually measure.
4. **A disambiguation step for entity queries.** `entity_it_name` and
   `entity_en_name` are flat because the gold tercet is often absent from the
   top-50 — an ambiguity problem, not a reranker problem. The lever here is a
   **query rewriter** that reduces ambiguity before retrieval: expand a bare name
   to its canonical form, or ask the user a clarifying question when the query is
   under-specified. No amount of reranker fine-tuning reaches this.

The encouraging part is that transfer Recall@5 and MRR keep improving at full
scale: the data *is* teaching the model something that generalizes, even where
top-1 has plateaued. The next iteration changes what the model learns from — the
negatives and the loss — rather than how much.
