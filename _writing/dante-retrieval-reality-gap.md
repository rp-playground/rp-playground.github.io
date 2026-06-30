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

This article is the first part of a larger project to build *DanteGPT*, a semantic 
search system for Dante’s *Divine Comedy*. The system will address two classes of query:

* Verse recall — a user provides a text fragment, perhaps obtained reaching back 
into distant school memories, perhaps misspelled or only half-remembered,
in any language or loose paraphrase, and wants to know exactly 
which canto and which tercet it belongs to. The system takes the text 
and returns the precise matching tercet with high precision. Example: "a metà della vita" → Inferno I:1–3. 

* Thematic search — a user expresses a modern feeling or concept, and the system surfaces 
semantically relevant passages regardless of surface form. Example: "I was 35 and felt lost" → Inferno I:1–3.

The architecture uses a two-stage pipeline — BM25 over the original Italian combined
with dense retrieval over translations and paraphrases (initial data configuration, subject to refinement), 
fused with query-aware weighting and followed 
by cross-encoder reranking. The work described here belongs to the verse-recall component and documents
the evaluation and diagnostic process that shaped its development.

**Background**

I wanted a system that finds the right *tercet* of Dante's *Divine Comedy* from a fuzzy query — a half-remembered
fragment, a paraphrase, an English approximation, the name of a character. The user half-knows the text and the system
returns the exact three lines; three because the tercet is system's semantic unit.

The retrieval stack is conventional: **BM25** over the original Italian, plus a **dense** bi-encoder
(`multilingual-e5-large`, zero-shot) over English translations and paraphrases. Standard metrics: Recall@1, Recall@5,
MRR@10.

**The investigation**

On Inferno Canto 1 the dense retriever hit **Recall@1 0.92**. 
The score cannot be taken seriously as representative of other cantos: the canto contains 
some of the most famous lines in Western literature, and a multilingual model trained on web data 
has almost certainly memorized large parts of it.

What follows is mostly about how much a realistic evaluation dataset 
drops the score, and about the attempts — stronger encoder, fusion, bigger reranker — that 
were made to recover from that drop. They reached a plateau. 
Beyond it, the only move left is targeted fine-tuning.


{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## 1. Two retrievers, two axes

Verse-recall has two orthogonal difficulties. A query can be **lexical** — it reuses words from the original verse
("nel mezzo del cammin") — or **semantic / cross-lingual** — a paraphrase, or English ("the lovers who read Lancelot").
No single retriever is good at both for free, so I followed the 
conventional practice and run two, measuring where each fails:

- **BM25** over the original Italian (`t.dante`), with word-unigram and character-5-gram tokenization. Strong on the
  lexical axis, blind to the semantic one.
- **Dense** e5-large, zero-shot, cosine over normalized embeddings, max-pooled per tercet. Strong on semantics, weak on
  rare archaic Italian.

By running both I can tell whether the problem is lexical or semantic before I spend effort on the wrong fix.

## 2. Indexing the original Italian

The first failure appeared immediately: a query that *is* the original verse —
`"Poi ch'èi posato un poco il corpo lasso"` — was a complete miss for the dense 
retriever (the gold tercet, Inferno 1:28, wasn't even in
the top-10), while BM25 returned it at rank 1. 
This happened because the dense index held only English translations and paraphrases.

Two representation fixes followed, each touching only the dense side (BM25 already indexes the original):

1. **Italian paraphrases** added to the index → Recall@1 **0.79 → 0.87**.
2. **Indexing the original `t.dante`** as a dense passage → **0.87 → 0.92**.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_improvements_canto1.png" alt="Bar chart titled 'Representations that improve dense — Inferno canto 1 (R@1)'. X-axis labels centered under the bars: 'BM25 + e5-large' / '(EN trans. + paraphrases)', 'Italian paraphrases' / 'added to index', 'Original t.dante' / 'as dense passage'. Dense bars rise 0.79 → 0.87 → 0.92; grey BM25 bars flat ~0.73.">
  <figcaption>The dense retriever’s Recall@1 improves as we add more text it can match against (Italian paraphrases, then the original verses). BM25 (grey line) stays flat as a lexical baseline.</figcaption>
</figure>

These two fixes are shown as a sequence, but they do not stack: indexing `t.dante` alone reaches 0.92 from the 0.79
baseline, so once the original verse is present the Italian-paraphrase gain is largely subsumed. The reality check below
shows this redundancy holds on the other cantos too.


## 3. The reality check

Canto 1 is the most quoted canto in the poem. A multilingual model trained on the web has seen "Nel mezzo del cammin"
thousands of times. 

To check whether 0.92 was specific to this famous canto, 
I run the system on additional curated sets for cantos 4, 5,
26 and 30. These sets were generated via agent prompt + gating primarily 
as validation probes on the codebase, and now used to test the
system on less famous material and see what typical performance looked like once the canto-1 outlier was removed. Each
canto is scored with the **same dense configuration** (the original `t.dante` plus the English representations, no entity
or paraphrase extras) and evaluated **single-canto**. On those, dense Recall@1 clustered around **~0.71**.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_generalization.png" alt="Bar chart 'Generalization: dense R@1 per canto (single-canto eval)'. Same dense config per canto. Canto 1 dense 0.92 (outlier above a dashed mean line at 0.71), cantos 4/5/26/30 dense between 0.67 and 0.75; grey BM25 bars 0.36–0.73.">
  <figcaption>Same dense config and single-canto eval for every canto: canto 1 is a fame/memorization outlier; the others sit at ~0.71.</figcaption>
</figure>

In §2, once the original verse `t.dante` was indexed, the Italian paraphrases stopped adding anything on canto 1 — the
paraphrase became a redundant representation. But canto 1 is the memorized case. Would the Italian paraphrases still be
redundant on the less-famous cantos, or would they actually help there, where the model cannot lean on memorization and a
same-language reformulation might catch Italian queries the original misses? I checked directly — generating Italian
paraphrases for cantos 4, 5, 26 and 30 and measuring the dense retriever with and without them, everything else held
fixed.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_it_paraphrase_effect.png" alt="Grouped bars 'Isolated effect of Italian paraphrases — dense R@1 per canto'. For cantos 4/5/26/30, a light-blue 't.dante only' bar next to a darker-blue '+ Italian paraphrases' bar (both dense): 0.70/0.68, 0.67/0.67, 0.75/0.77, 0.72/0.74. Subtitle: negligible/mixed once t.dante is indexed (mean 0.71 → 0.72).">
  <figcaption>Adding Italian paraphrases on top of the original verse moves dense R@1 by +0.006 on average — negligible and mixed.</figcaption>
</figure>

The effect is negligible and mixed: mean Recall@1 **0.71 → 0.72** (−0.02 on canto 4, 0 on canto 5, +0.02 on cantos 26 and
30), and it slightly *hurts* Recall@5 on two cantos, where near-duplicate Italian sentences crowd the top results. Once
the original verse `t.dante` is indexed, the Italian paraphrase is a largely redundant representation for verse recall —
on the less-famous cantos as much as on canto 1. 

Those sets were still single-canto: the evaluator benefits from knowing which canto the passage is in, so the gold
only has to be distinguished among ~46 candidate tercets.

The noisy cross-canto set removes that limitation. It was built from the start around attempted simulation of actual user behavior (short
keywords, episode recall, misremembered or blended details, cross-canto references) and is scored over the entire
Inferno (1,596 tercets, ~42k index documents). It was generated by a Grok Build model and passed the decontamination
gates (the audit verifies that every gold is resolvable over the full Inferno and that no query is an exact match or
substring of its indexed target).

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_noisy_cross_canto_profile.png" alt="Profile of the cross-canto set: top panel shows gold tercets spread across 24 of 34 Inferno cantos; a query-mix stacked bar shows keyword 38%, semantic/episodic 30%, entity 21%, noisy fragment 6%, ambiguous 5%; difficulty 94 hard / 87 medium / 29 easy.">
  <figcaption>The cross-canto set: gold tercets across 24 of 34 cantos.</figcaption>
</figure>

On this set, dense Recall@1 is **0.42**.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_progression.png" alt="Three color-coded bars labelled with their purpose: canto 1 (single canto, development) 0.92, cantos 5/26/30 (single canto, generalization probes) 0.71, noisy cross-canto (whole Inferno, real-world) 0.42. Title: 'The reality gap'.">
  <figcaption>Same retriever, three benchmarks built for different purposes.</figcaption>
</figure>

The earlier sets served their purposes: canto 1 as the high-fidelity development and productive within-canto reference, and the sets for 5/26/30 as generalization probes to test the system and de-risk the fame effect. The noisy cross-canto set is the one whose design priority was real-world conditions — how the retriever behaves when a user does not know the canto and is searching from partial, noisy memory. That is the number that dropped to 0.42.

## 4. What actually moved the real number

The realistic benchmark showed what actually worked.

**Entity grounding.** Adding a short descriptive context for each character (sourced from Wikipedia — see the note at the
end) helped on the cross-canto set’s many
name queries. The gain was much larger, however, after fixing a data bug: the contexts were attached to tercets where
the character merely appeared, not where its name is mentioned. (Homer’s bio sat on four peripheral tercets instead of
the line that says 'quelli è Omero'.) Moving each to its canonical tercet roughly doubled the improvement.

**Fusion, the right way.** BM25 and dense are complementary per query type: BM25 wins Italian fragments and names, dense
wins English and semantics. Fusing them with Reciprocal Rank Fusion at equal weights made things worse, because dense is
the stronger track and blending in the weaker BM25 diluted it. The per-type view shows why a single static weight can't
win.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_fusion.png" alt="Grouped bars on Inferno canto 1: dense vs static RRF vs query-aware RRF across R@1, R@5, MRR@10. Static RRF collapses on R@1 (0.79); query-aware returns to dense and slightly exceeds it on R@5/MRR.">
  <figcaption>Static RRF collapses because it injects BM25 noise on English queries; query-aware RRF, which weights BM25 to zero on English queries, recovers it.</figcaption>
</figure>

The fix is query-aware fusion: detect the query language and set BM25's weight to zero on English queries, where its
Italian-only index is just noise, and high on Italian ones. On the cross-canto set fusion
beats dense on R@5 and MRR.

**Reranking**. A cross-encoder reads `(query, passage)` jointly and reorders the top-50
candidates. On the real set, Recall@1 went **0.42 → 0.51**; on Canto 1, 0.92 → 0.96. It is the first component to improve
over dense/RRF on both the easy and the hard benchmark.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_pipeline.png" alt="Grouped bars on the cross-canto set: R@1 and MRR@10 across four pipeline stages — BM25, dense, RRF query-aware, + reranker. R@1 climbs 0.24, 0.42, 0.42, 0.51.">
  <figcaption>The stack on real-world queries: lexical and semantic retrieval, then query-aware fusion, then cross-encoder reranking.</figcaption>
</figure>

## 5. Reranking is the bottleneck

0.51 is low. The obvious move is to blame the embeddings and get a stronger retriever, or fine-tune it. I checked: 
a stronger zero-shot dense model (BGE-M3) gave the same final Recall@1 after reranking as e5-large. The embedding model
is not the limiter.

Then I measured the reranker's actual ceiling. The reranker reorders the top-50, so its ceiling is recall@50. 
On the cross-canto set, recall@50 is **0.74**. The gold is already in the
candidate pool for 74% of queries; the reranker ranks it #1 for only 51%.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_reranking_headroom.png" alt="Bar chart of candidate-set recall @k on the noisy cross-canto set. Red dashed line at 0.51 shows final reranked R@1, vs. 0.74 at @50.">
  <figcaption>The gold is in the top-50 for 74% of queries, but the best off-the-shelf reranker ranks it #1 only 51% of the time. The gap is reranking, not recall.</figcaption>
</figure>

Recall@50 is 0.74, but the reranker only surfaces the gold at rank 1 for 51% of queries. 
And a bigger generic reranker doesn't fix it: across three off-the-shelf
cross-encoders (120M to 568M), none beat the small `mmarco-mMiniLM`; all plateau around 0.47–0.51. Telling the gold tercet
apart from 49 thematically similar Dante tercets needs domain knowledge, not more parameters.

## Conclusion

The number for "find a Dante verse from a real, noisy, cross-canto query" is around **Recall@1 0.51**, not the 0.92 the
first benchmark reported. The drop comes mainly from using a more realistic test set. 
Single-canto tests on well-known passages give more flattering results than queries over the full poem.

Looking at the sequence of results:

- Generalization probes on other cantos + the real-world cross-canto set → 0.92 → 0.71 → 0.42.
- Representations, query-aware fusion, and reranking → 0.42 → 0.51.
- A stronger encoder produced no improvement.
- recall@50 = 0.74 with reranked R@1 = 0.51 → the gold is there, and the reranker can't pick it.
- Larger rerankers (up to 568M parameters) did not beat the smaller one.

The remaining problem is now sharply defined: the initial retrieval usually brings the correct tercet into the top-50 candidates, but the reranker still cannot reliably select it among the many thematically similar alternatives.

## The main lesson

A realistic benchmark should be built early. It will usually give lower numbers, but those numbers better indicate what is actually worth changing.

## What's next

The results point most clearly to domain-adaptive fine-tuning of the reranker:

- A small cross-encoder trained on Dante `(query, tercet)` pairs
- Hard negatives drawn from the actual retriever’s confusions
- Strict leakage controls (curated and cross-canto eval sets held out, with an overlap audit)

Before that, two inexpensive improvements are still available:

- Align the text passed to the reranker with the representation that actually matched in the first stage (or add entity context for character queries)
- Late fusion: combine the reranker score with the original retrieval scores instead of pure reordering


## Methodological Weaknesses

Before closing, several methodological weaknesses and inconsistencies in the current evaluation framework should be acknowledged, as they will need to be addressed in subsequent work:

- **Small Evaluation Dataset**: The "ecological" real-world dataset (noisy cross-canto) relies on a very small sample size of only 210 queries (n=210). While curated, this is a remarkably small number of queries to validate a production-level retrieval system.

- **Language Detection Assumption**: The "query-aware fusion" relies on detecting the query language to set BM25's weight to zero for English queries. However, the system does not address how language detection performs accurately on short, heavily misspelled, or noisy queries (e.g., a blended Anglo-Italian keyword search).

- **Reliance on Synthetic Data**: The evaluation sets were generated using LLMs ("agent prompt + gating" and a "Grok Build model"). While a decontamination audit is mentioned, relying on synthetic queries risks introducing LLM biases that may not perfectly reflect true human idiosyncrasies.

- **Handling of Thematic Ambiguity**: The system categorizes only 10 out of 210 queries as "ambiguous (multi-gold)". Given the nature of thematic searches (e.g., "I felt lost"), there are likely many more valid matching tercets across the poem than a single designated gold standard, potentially making the Recall@1 metric an overly harsh penalty for semantic searches.

- **Unproven Memorization Claim**: The 0.92 score on Canto 1 is attributed to the multilingual-e5-large model having memorized the famous text. While highly probable, this is presented without an ablation study (e.g., testing the model on obscured or fake text of similar structure) to confirm it.

**Inconsistencies**

- **Contradictory Architecture Descriptions**: The introduction defines the dense retrieval index as running specifically "over translations and paraphrases". However, Section 2 notes that one of the representation fixes was "Indexing the original `t.dante` as a dense passage". The introductory summary does not accurately reflect the updated architecture used for the final benchmarks.

**Note — entity contexts.** The per-character descriptive contexts were not hand-written. They were extracted by parsing
the English Wikipedia [List of cultural references in the Divine Comedy](https://en.wikipedia.org/wiki/List_of_cultural_references_in_the_Divine_Comedy),
then mapping each name to its Italian form via the Italian Wikipedia character categories — e.g.
[Personaggi citati nella Divina Commedia (Inferno)](https://it.wikipedia.org/wiki/Categoria:Personaggi_citati_nella_Divina_Commedia_%28Inferno%29).

*This is a working draft from an ongoing project; numbers and figures are reproducible from the project's versioned ML
journal.*
