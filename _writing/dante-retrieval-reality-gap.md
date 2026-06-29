---
layout: article
title: "The Reality Gap: Evaluating Verse Retrieval on Dante"
subtitle: "More realistic benchmarks dropped Recall@1 from 0.92 to 0.42 — and showed what actually moved the needle"
description: A retrieval system for finding verses of the Divine Comedy scored Recall@1 0.92 on the first canto. When I
  measured it on the queries people actually type, the number fell to 0.42, and a chain of measurements (not intuitions)
  showed that the bottleneck is reranking, not recall.
summary: My Dante verse-retrieval system scored Recall@1 0.92 on the first canto. Then I built benchmarks closer to how
  people actually search — keywords, half-remembered episodes, the wrong canto — and the number fell to 0.42. This is the
  story of that gap, the negative results along the way (a stronger encoder didn't help, naive fusion hurt, a bigger
  reranker didn't help), and a diagnostic that points at the right next step.
date: 2026-06-29
tags: [retrieval, evaluation, dense-retrieval, BM25, reranking, RAG]
published: false
permalink: /writing/dante-retrieval-reality-gap/
---

**Background**

I wanted a system that finds the right *tercet* of Dante's *Divine Comedy* from a fuzzy query — a half-remembered
fragment, a paraphrase, an English approximation, the name of a character. The user half-knows the text and the system
returns the exact three lines.

The retrieval stack is conventional: **BM25** over the original Italian, plus a **dense** bi-encoder
(`multilingual-e5-large`, zero-shot) over English translations and paraphrases. Standard metrics: Recall@1, Recall@5,
MRR@10.

**The investigation**

The first number looked strong: on Inferno Canto 1, the dense retriever hit **Recall@1 0.92**. I could have stopped
there. But the score covered one canto, and the most famous one in Western literature, so I went looking for what it
actually measured.

What follows is mostly about the benchmark rather than the model. Each step toward a more realistic evaluation lowered
the score, and that drop is what eventually pointed at the right thing to fix. The negative results did most of the work:
a stronger encoder didn't help, naive fusion hurt, a bigger reranker didn't help. Each one removed a wrong path and
sharpened the next question.

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## 1. Two retrievers, two axes

Verse-recall has two orthogonal difficulties. A query can be **lexical** — it reuses words from the original verse
("nel mezzo del cammin") — or **semantic / cross-lingual** — a paraphrase, or English ("the lovers who read Lancelot").
No single retriever is good at both for free, so I run two and measure where each fails:

- **BM25** over the original Italian (`t.dante`), with word-unigram and character-5-gram tokenization. Strong on the
  lexical axis, blind to the semantic one.
- **Dense** e5-large, zero-shot, cosine over normalized embeddings, max-pooled per tercet. Strong on semantics, weak on
  rare archaic Italian.

This dual-track baseline isn't the product. It's the instrument that tells me which axis is broken before I spend effort
on it.

## 2. Teaching the dense retriever Italian

The first real failure mode was sharp. A query that *is* the original verse —
`"Poi ch'èi posato un poco il corpo lasso"` — was a complete miss for the dense retriever (the gold tercet wasn't even in
the top-10), while BM25 returned it at rank 1.

The reason: the dense index held English translations and English paraphrases, but never the original Italian text. An
Italian query had nothing Italian to match against, so it matched cross-lingually against English and lost.

Two representation fixes followed, each touching only the dense side (BM25 already indexes the original):

1. **Italian paraphrases** added to the index → Recall@1 **0.79 → 0.87**.
2. **Indexing the original `t.dante`** as a dense passage → **0.87 → 0.92**.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_improvements_canto1.png" alt="Bar chart titled 'Representations that improve dense — Inferno canto 1 (R@1)'. Three dense bars rising left to right: baseline 0.79, +IT paraphrases 0.87, +original Dante 0.92. A flat grey BM25 reference around 0.73.">
  <figcaption>Each representation the dense retriever can match against lifts Recall@1; BM25 is the flat lexical reference.</figcaption>
</figure>

One detail that matters: these representations go only into the curated full-index evaluation flow, never into the
synthetic-with-holdout flow. Otherwise queries generated *from* the original verse would trivially match the indexed
original. Leakage controls like this recur throughout the project.

That gets dense to 0.92 on Canto 1. It's also where the story stops being useful, for a reason that has nothing to do
with the model.

## 3. The reality check

Canto 1 is the most quoted canto in the poem. A multilingual model trained on the web has seen "Nel mezzo del cammin"
thousands of times. So 0.92 might be the system, or it might be the fame of the text.

I built curated sets for other cantos to test generalization. The dense number on the famous-but-less-canonical cantos
(5, 26, 30) clustered around **~0.72**, with Canto 1 sitting well above as an outlier.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_generalization.png" alt="Bar chart 'Generalization: dense R@1 per canto (curated sets)'. Canto 1 dense 0.92 (outlier above a dashed mean line at ~0.73), cantos 4/5/26/30 between 0.69 and 0.77.">
  <figcaption>Canto 1 is a fame/memorization outlier; the curated number across other cantos is ~0.72.</figcaption>
</figure>

Even ~0.72 was optimistic, because all of these sets share a shortcut: they are single-canto. The evaluator knows the
canto, and the gold resolves among about 46 candidate tercets. Real users don't know the canto. They type a keyword
("lupa", "the gate of hell"), recall an episode ("the count who ate his children"), or misremember a line, across the
whole Inferno.

The last benchmark drops that shortcut. It has 210 queries built to match real use — keyword, episodic, cross-canto,
ambiguous — and it is scored over the entire Inferno (1,596 tercets, about 42k index documents). It was generated by a
Grok Build model and gated for de-contamination (the descriptor queries are checked not to be substrings of any indexed
text).

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_noisy_cross_canto_profile.png" alt="Profile of the cross-canto set: top panel shows gold tercets spread across 24 of 34 Inferno cantos; a query-mix stacked bar shows keyword 38%, semantic/episodic 30%, entity 21%, noisy fragment 6%, ambiguous 5%; difficulty 94 hard / 87 medium / 29 easy.">
  <figcaption>The cross-canto set: gold tercets across 24 of 34 cantos, and a query mix closer to what people actually type.</figcaption>
</figure>

On this set, dense Recall@1 is **0.42**.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_progression.png" alt="Three color-coded bars labelled with their purpose: canto 1 (single canto, development) 0.92, cantos 5/26/30 (single canto, generalization probes) 0.71, noisy cross-canto (whole Inferno, real-world) 0.42. Title: 'The reality gap'.">
  <figcaption>Same retriever, three benchmarks built for different purposes; the more realistic the benchmark, the lower the number.</figcaption>
</figure>

The progression is 0.92 → 0.72 → 0.42. The earlier sets weren't wrong; each had a job — developing the representations,
probing for overfitting. But the headline 0.92 didn't predict performance on the queries I actually care about.

## 4. What actually moved the real number

With a realistic benchmark, I could tell improvements apart from artifacts.

**Entity grounding.** The cross-canto set has many character queries. Indexing a short descriptive `context` per
character helps, but only after fixing a data bug: the contexts were attached to tercets where the character is
*involved*, not where it is *named* (Homer's bio sat on four peripheral tercets and missed the one that says "quelli è
Omero"). Attaching each entity to its canonical tercet — the one where its name appears — roughly doubled the gain.

**Fusion, the right way.** BM25 and dense are complementary per query type: BM25 wins Italian fragments and names, dense
wins English and semantics. Fusing them with Reciprocal Rank Fusion at equal weights made things worse, because dense is
the stronger track and blending in the weaker BM25 diluted it. The per-type view shows why a single static weight can't
win.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_fusion.png" alt="Grouped bars on Inferno canto 1: dense vs static RRF vs query-aware RRF across R@1, R@5, MRR@10. Static RRF collapses on R@1 (0.79); query-aware returns to dense and slightly exceeds it on R@5/MRR.">
  <figcaption>Static RRF collapses because it injects BM25 noise on English queries; query-aware RRF, which weights BM25 to zero on English queries, recovers it.</figcaption>
</figure>

The fix is query-aware fusion: detect the query language and set BM25's weight to zero on English queries, where its
Italian-only index is just noise, and high on Italian ones. On the cross-canto set this finally pays off, with fusion
beating dense on R@5 and MRR.

**Reranking** was the biggest single lever. A cross-encoder reads `(query, passage)` jointly and reorders the top-50
candidates. On the real set, Recall@1 went **0.42 → 0.51**; on Canto 1, 0.92 → 0.96. It is the first component to improve
over dense/RRF on both the easy and the hard benchmark.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_pipeline.png" alt="Grouped bars on the cross-canto set: R@1 and MRR@10 across four pipeline stages — BM25, dense, RRF query-aware, + reranker. R@1 climbs 0.24, 0.42, 0.42, 0.51.">
  <figcaption>The stack on real-world queries: lexical and semantic retrieval, then query-aware fusion, then cross-encoder reranking.</figcaption>
</figure>

## 5. Where the system is stuck, and where it isn't

0.51 is low. The obvious move is to blame the embeddings and get a stronger retriever, or fine-tune it. I checked, and the
data said otherwise.

A stronger zero-shot dense model (BGE-M3) gave the same final Recall@1 after reranking as e5-large. The embedding model
is not the limiter.

Then I measured the reranker's actual ceiling. The reranker reorders the top-50, so its ceiling is recall@50, which I had
been reading off the wrong number (R@5). On the cross-canto set, recall@50 is **0.74**. The gold is already in the
candidate pool for 74% of queries; the reranker ranks it #1 for only 51%.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_reranking_headroom.png" alt="Bar chart of candidate-set recall@k on the cross-canto set: @1 0.42, @5 0.60, @10 0.63, @20 0.69, @50 0.74. A dashed red line marks the best reranked R@1 at 0.51, well below the 0.74 ceiling.">
  <figcaption>The gold is in the top-50 for 74% of queries, but the best off-the-shelf reranker ranks it #1 only 51% of the time. The gap is reranking, not recall.</figcaption>
</figure>

So the limiter is the reranker, not recall. And a bigger generic reranker doesn't fix it: across three off-the-shelf
cross-encoders (120M to 568M), none beat the small `mmarco-mMiniLM`; all plateau around 0.47–0.51. Telling the gold tercet
apart from 49 thematically similar Dante tercets needs domain knowledge, not more parameters.

## Conclusion

The number for "find a Dante verse from a real, noisy, cross-canto query" is around **Recall@1 0.51**, not the 0.92 the
first benchmark reported. Most of that distance is the benchmark, not the model. Single-canto, famous-text, clean-query
evaluation flatters a system; realistic evaluation lowers the number and is far more useful.

The chain of measurements did more than any single result:

- More realistic benchmarks → 0.92 → 0.72 → 0.42.
- Representations, query-aware fusion, and reranking → 0.42 → 0.51.
- A stronger encoder → no change, so it isn't the encoder.
- recall@50 = 0.74 with reranked R@1 = 0.51 → the gold is there, and the reranker can't pick it.
- A bigger reranker → no change, so it isn't the size.

Each negative result narrowed the search. The error mode is now specific: picking the right tercet among thematically
similar candidates that are already retrieved.

## What's next

The lever with empirical support is domain-adaptive fine-tuning of the reranker — a small cross-encoder trained on Dante
`(query, tercet)` pairs, with hard negatives drawn from the actual retriever's confusions (the tercets it currently mixes
up), and strict leakage controls (the curated and cross-canto eval sets stay held out, with an overlap audit). Before
that, there is cheap lift to harvest: aligning the passage the reranker reads, and a late fusion of reranker and retrieval
scores instead of pure reordering.

The broader point is about method, not the next model. The benchmark decides what you're measuring, so build the
realistic one early, let it lower your numbers, and follow the measurements rather than the intuitions to the thing worth
fixing.

*This is a working draft from an ongoing project; numbers and figures are reproducible from the project's versioned ML
journal.*
