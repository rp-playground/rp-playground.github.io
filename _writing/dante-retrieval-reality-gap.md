---
layout: article
title: "The Reality Gap: Evaluating Verse Retrieval on Dante"
subtitle: "More realistic benchmarks dropped Recall@1 from 0.92 to 0.42"
description: A retrieval system for finding verses of the Divine Comedy scored Recall@1 0.92 on the first canto. I evaluated the system on realistic cross-canto queries and the score dropped to 0.42. Further measurements showed the bottleneck is reranking, not initial recall.
summary: My Dante verse-retrieval system scored Recall@1 0.92 on the first canto. I built benchmarks using keywords, half-remembered episodes, and cross-canto searches, and the score fell to 0.42. I tested a stronger encoder, query-aware fusion, and larger rerankers to address the gap. I report the negative results and the diagnostic measurements that identify the next required step.
date: 2026-07-10
tags: [retrieval, evaluation, dense-retrieval, BM25, reranking, RAG, Divine Comedy]
published: true
permalink: /writing/dante-retrieval-reality-gap/
---

I built a semantic search system for Dante’s *Divine Comedy*. The system addresses two query types:

* Verse recall: A user provides a text fragment. It might be misspelled, partially remembered, or a loose translation. The system takes the text and returns the exact tercet. Example: "a metà della vita" → Inferno I:1–3. 
* Thematic search: A user queries a concept, and the system surfaces semantically relevant passages. Example: "I was 35 and felt lost" → Inferno I:1–3.

The architecture uses a two-stage pipeline. It runs BM25 over the original Italian and dense retrieval over translations, paraphrases, and the original Italian verses. It fuses the results with query-aware weighting and applies cross-encoder reranking. This article covers the verse-recall component and documents the evaluation process.

**Background**

I built a system to find the right *tercet* of Dante's *Divine Comedy* from a fuzzy query. The user provides a fragment or a paraphrase, and the system returns the exact three lines. The tercet is the system's semantic unit.

The retrieval stack uses BM25 over the original Italian and a dense bi-encoder (`multilingual-e5-large`, zero-shot). The dense index initially covers English translations and paraphrases. Section 2 shows that adding the original Italian verses provides the largest dense gain. I measure Recall@1, Recall@5, and MRR@10.

**The investigation**

On Inferno Canto 1, the dense retriever reached Recall@1 0.92. This score does not represent other cantos. Canto 1 contains heavily quoted lines, and a multilingual model trained on web data likely memorized them.

A realistic evaluation dataset drops this score significantly. I tried a stronger encoder, fusion, and a bigger reranker to recover the performance, but they plateaued. Targeted fine-tuning is the next required step.

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## 1. Two retrievers, two axes

Verse-recall presents lexical and semantic difficulties. A lexical query reuses words from the original verse ("nel mezzo del cammin"). A semantic or cross-lingual query uses a paraphrase or English ("the lovers who read Lancelot"). I run two retrievers and measure where each fails:

- **BM25** over the original Italian (`t.dante`), with word-unigram and character-5-gram tokenization. It performs well on lexical queries but misses semantic ones.
- **Dense** e5-large, zero-shot, cosine over normalized embeddings, max-pooled per tercet. It handles semantics but struggles with archaic Italian.

By running both I can tell whether the problem is lexical or semantic before I apply a fix.

## 2. Indexing the original Italian

A query matching the original verse exactly, `"Poi ch'èi posato un poco il corpo lasso"`, failed on the dense retriever. The gold tercet (Inferno 1:28) fell outside the top-10. BM25 returned it at rank 1. The dense index only held English translations and paraphrases.

I applied two changes to the dense index:

1. Adding **Italian paraphrases** to the index improved Recall@1 from 0.79 to 0.87.
2. Indexing the original `t.dante` as a dense passage improved it from 0.87 to 0.92.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_improvements_canto1.png" alt="Bar chart titled 'Representations that improve dense: Inferno canto 1 (R@1)'. X-axis labels centered under the bars: 'BM25 + e5-large' / '(EN trans. + paraphrases)', 'Italian paraphrases' / 'added to index', 'Original t.dante' / 'as dense passage'. Dense bars rise 0.79 → 0.87 → 0.92; grey BM25 bars flat ~0.73.">
  <figcaption>The dense retriever’s Recall@1 improves as we add more text it can match against (Italian paraphrases, then the original verses). BM25 (grey line) stays flat as a lexical baseline.</figcaption>
</figure>

Indexing `t.dante` alone reaches 0.92 from the 0.79 baseline. The original verse makes the Italian paraphrase redundant. This holds on other cantos.

## 3. The reality check

Canto 1 is the most quoted canto. A multilingual model has seen "Nel mezzo del cammin" thousands of times. 

I tested the system on curated sets for cantos 4, 5, 26, and 30 to see if the 0.92 score was specific to Canto 1. I evaluated each canto individually using the same dense configuration (original `t.dante` and English representations). Dense Recall@1 on these cantos averaged 0.71.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_generalization.png" alt="Bar chart 'Generalization: dense R@1 per canto (single-canto eval)'. Same dense config per canto. Canto 1 dense 0.92 (outlier above a dashed mean line at 0.71), cantos 4/5/26/30 dense between 0.67 and 0.75; grey BM25 bars 0.36–0.73.">
  <figcaption>Same dense config and single-canto eval for every canto: canto 1 is a fame/memorization outlier; the others sit at ~0.71.</figcaption>
</figure>

On Canto 1, Italian paraphrases added no value once the original verse was indexed. I tested whether paraphrases help on less-famous cantos by generating them for cantos 4, 5, 26, and 30. I measured the dense retriever with and without them.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_it_paraphrase_effect.png" alt="Grouped bars 'Isolated effect of Italian paraphrases: dense R@1 per canto'. For cantos 4/5/26/30, a light-blue 't.dante only' bar next to a darker-blue '+ Italian paraphrases' bar (both dense): 0.70/0.68, 0.67/0.67, 0.75/0.77, 0.72/0.74. Subtitle: negligible/mixed once t.dante is indexed (mean 0.71 → 0.72).">
  <figcaption>Adding Italian paraphrases on top of the original verse moves dense R@1 by +0.006 on average: negligible and mixed.</figcaption>
</figure>

The effect was small and inconsistent. Mean Recall@1 went from 0.71 to 0.72 (−0.02 on Canto 4, 0 on Canto 5, +0.02 on Cantos 26 and 30). It decreased Recall@5 on two cantos because near-duplicate sentences crowded the top results. The Italian paraphrase remains redundant across cantos once the original verse is indexed.

### The memorization effect

Canto 1 scores higher and is frequently quoted, suggesting memorization. But Canto 1 might just have easier vocabulary or better translations. I ran an ablation contrasting Canto 1 with the other cantos under three index conditions. First, I tested whether indexing the original verse outperforms an Italian paraphrase on the famous canto. Second, I tested whether the famous canto is still recalled better when the index contains only English text.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_memorization_ablation.png" alt="Grouped bar chart 'Memorization ablation, dense R@1 by index condition'. Two groups, 'canto 1 (famous, n=52)' and 'cantos 4/5/26/30 (non-famous, n=196)', each with three blue bars for the index condition: EN-only, + Italian paraphrase, + original verse. Canto 1 climbs steeply 0.79 → 0.86 → 0.92; the pooled non-famous cantos stay flat 0.67 → 0.70 → 0.71. Subtitle: exact-verse premium +0.058 (canto 1) vs +0.005 pooled; EN-only fame gap 0.79 vs 0.67, both signals are canto-1-specific.">
  <figcaption>Both memorization signatures are canto-1-specific: the original verse buys canto 1 a jump a meaning-equivalent paraphrase does not, and even English-only the famous canto is recalled better.</figcaption>
</figure>

Both effects occur only on Canto 1. Indexing the original string over an Italian paraphrase yields a +0.058 gain on Canto 1, compared to +0.005 pooled across the non-famous cantos. With only English representations in the index, Canto 1 reaches 0.79, while the non-famous cantos reach 0.67. The original verse improves Canto 1 in a way a paraphrase does not.

| index condition | canto 1 (famous, n=52) | cantos 4/5/26/30 (pooled, n=196) |
|---|---|---|
| EN-only (no Italian in index) | 0.79 | 0.67 |
| + Italian paraphrase | 0.86 | 0.70 |
| + original verse (`t.dante`) | 0.92 | 0.71 |
| **exact-verse premium** | **+0.058** | **+0.005** |

The Canto 1 premium's confidence interval touches zero (n≈52), so the argument relies on both signals combined. I tested this on real text rather than synthetic archaic Italian to avoid confounding memorization with model fluency. The ablation confirms the memorization effect.

The previous sets evaluated single cantos. The gold tercet only competed against about 46 candidates.

The noisy cross-canto set evaluates across the entire Inferno (1,596 tercets, ~42k index documents). It simulates user behavior with short keywords, episode recall, and misremembered details. A Grok Build model generated the queries, and an audit verified that no query is an exact match or substring of its target.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_noisy_cross_canto_profile.png" alt="Profile of the cross-canto set: top panel shows gold tercets spread across 24 of 34 Inferno cantos; a query-mix stacked bar shows keyword 38%, semantic/episodic 30%, entity 21%, noisy fragment 6%, ambiguous 5%; difficulty 94 hard / 87 medium / 29 easy.">
  <figcaption>The cross-canto set: gold tercets across 24 of 34 cantos.</figcaption>
</figure>

On this set, dense Recall@1 is 0.42.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_progression.png" alt="Three color-coded bars labelled with their purpose: canto 1 (single canto, development) 0.92, cantos 4/5/26/30 (single canto, generalization probes) 0.71, noisy cross-canto (whole Inferno, real-world) 0.42. Title: 'The reality gap'.">
  <figcaption>Same retriever, three benchmarks built for different purposes.</figcaption>
</figure>

Canto 1 served as a development reference. Cantos 4, 5, 26, and 30 tested generalization. The noisy cross-canto set tests how the retriever behaves on partial, noisy memory across the poem. On this realistic set, Recall@1 dropped to 0.42.

## 4. What actually improved results

The cross-canto benchmark identified which changes improved the full pipeline.

**Entity contexts.** I added descriptive contexts for each character from Wikipedia. I also fixed an attachment error. The contexts previously linked to tercets where a character was implied, rather than explicitly named. This fix improved BM25 on name queries. Recall@1 rose from 0.05 to 0.26 on this slice. The dense retriever did not benefit from the English contexts. The end-to-end pipeline showed no change because query-aware fusion reduces BM25's weight on English queries, and the reranker reorders the final candidates. Reranked Recall@1 was 0.514 without the contexts and 0.510 with them.

**Query-aware fusion.** BM25 and dense retrieval are complementary. BM25 performs better on Italian fragments, while the dense index handles English and semantic queries. Fusing them with Reciprocal Rank Fusion at equal weights decreased performance because BM25 diluted the stronger dense track. 

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_fusion.png" alt="Grouped bars on Inferno canto 1: dense vs static RRF vs query-aware RRF across R@1, R@5, MRR@10. Static RRF collapses on R@1 (0.79); query-aware returns to dense and slightly exceeds it on R@5/MRR.">
  <figcaption>Static RRF collapses because it injects BM25 noise on English queries; query-aware RRF, which weights BM25 to zero on English queries, recovers it.</figcaption>
</figure>

I used query-aware fusion to detect the query language. It sets BM25's weight to zero on English queries and high on Italian ones. On the cross-canto set, fusion beats the dense retriever on Recall@5 and MRR@10. (See Methodological Weaknesses for language detection details).

**Reranking.** A cross-encoder evaluates `(query, passage)` pairs and reorders the top-50 candidates. Recall@1 increased from 0.42 to 0.51 on the cross-canto set, and from 0.92 to 0.96 on Canto 1. This component improved over dense and fusion baselines on both benchmarks.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_pipeline.png" alt="Grouped bars on the cross-canto set: R@1 and MRR@10 across four pipeline stages: BM25, dense, RRF query-aware, + reranker. R@1 climbs 0.24, 0.42, 0.42, 0.51.">
  <figcaption>The stack on real-world queries: lexical and semantic retrieval, then query-aware fusion, then cross-encoder reranking.</figcaption>
</figure>

## 5. Reranking is the bottleneck

A Recall@1 of 0.51 is low. I tested a stronger zero-shot dense model (BGE-M3) and observed the same final Recall@1 as e5-large. The embedding model does not limit performance.

The reranker reorders the top-50 candidates, setting its maximum possible Recall@1 to the initial retrieval's Recall@50. On the cross-canto set, Recall@50 is 0.74. The gold tercet is in the candidate pool for 74% of queries, but the reranker only places it at rank 1 for 51% of them.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_reranking_headroom.png" alt="Bar chart of candidate-set recall @k on the noisy cross-canto set. Red dashed line at 0.51 shows final reranked R@1, vs. 0.74 at @50.">
  <figcaption>The gold is in the top-50 for 74% of queries, but the best off-the-shelf reranker ranks it #1 only 51% of the time. The gap is reranking, not recall.</figcaption>
</figure>

Larger generic rerankers did not improve the result. I tested three off-the-shelf cross-encoders ranging from 120M to 568M parameters. None outperformed the small `mmarco-mMiniLM`; they all plateaued between 0.47 and 0.51. Distinguishing the gold tercet from 49 thematically similar candidates requires domain knowledge.

Improving the upstream candidate pool did not increase the final score. I indexed English character names into BM25 and relaxed the fusion rule that zeros BM25 on English queries. Reranked Recall@1 remained at 0.51, and the name-query performance did not change. Relaxing the fusion rule actually degraded the pre-rerank candidate set (English-paraphrase Recall@1 dropped from 0.42 to 0.35). The reranker evaluates `(query, original verse + translations)` and lacks the entity context needed to differentiate characters. Upstream improvements fail when the final ranking component cannot observe the signal that identifies the correct verse.

## Conclusion

The system achieves a Recall@1 of 0.51 on realistic, cross-canto queries. Evaluating single cantos containing famous passages produces artificially high scores.

Looking at the sequence of results:

- Testing on other cantos and cross-canto queries dropped Recall@1 from 0.92 to 0.42.
- Query-aware fusion and reranking increased Recall@1 to 0.51.
- A stronger encoder did not improve the score.
- Recall@50 is 0.74, while reranked Recall@1 is 0.51. The reranker fails to select the gold candidate.
- Larger rerankers performed no better than a small one.

The initial retrieval places the correct tercet in the top-50 candidates for 74% of queries, but the reranker cannot reliably select it from thematically similar alternatives.

## The main lesson

A realistic benchmark built early yields lower numbers but identifies which components require modification.

## What's next

I will fine-tune the reranker on the domain data:

- Train a small cross-encoder on Dante `(query, tercet)` pairs.
- Draw hard negatives from the retriever's confusions.
- Maintain strict leakage controls with held-out evaluation sets.

I plan several smaller changes before fine-tuning:

- Provide the reranker with the entity context for character queries.
- Combine the reranker score with the original retrieval scores instead of pure reordering.
- Replace the language heuristic with a robust language detector to improve query-aware fusion on mixed-language queries.

## Methodological Weaknesses

This evaluation framework contains methodological weaknesses:

- **The primary benchmark is small (n=210)**: The cross-canto set contains only 210 queries. The per-type subgroups hold even fewer queries. Sampling variance can move the headline metric by several points. I do not report confidence intervals or significance tests.
- **Language Detection**: The query-aware fusion relies on a basic heuristic (`fusion.py:detect_language`). It checks function words and accents. It branches incorrectly or defaults to 'undetermined' on short or misspelled queries. It classifies language correctly for only 68% of the queries.
- **Synthetic queries**: Every evaluation query was machine-generated and decontaminated. LLM-written queries are cleaner than actual user queries. I have not validated this distribution against real user logs.
- **Thematic Ambiguity**: The system labels only 10 of 210 queries as ambiguous. Semantic searches likely match multiple valid tercets across the poem, making Recall@1 a harsh metric.
- **No error analysis**: I do not provide qualitative failure examples, such as specific reranker confusions or BM25 overrides.
- **Inferno only**: The benchmarks evaluate only *Inferno*. *Purgatorio* and *Paradiso* differ in vocabulary and fame distribution.
- **Lack of significance testing**: I read small differences directionally without statistical tests.
- **Under-specified reranker comparison**: I do not list the exact models or configurations for the larger rerankers.
- **`t.dante` provenance**: The specific text edition and normalization for the original Italian (`t.dante`) are not stated.
- **Initial retrieval ceiling**: Reranking is the immediate bottleneck, but initial retrieval fails to place the gold in the top-50 for 26% of queries. Fine-tuning the reranker will not resolve this separate ceiling.
- **Memorization mechanism**: The Canto 1 ablation provides two signals for memorization, but the English-only gap could also stem from better translation quality.
- **Entity context tension**: Adding entity context to the index provided no benefit. Providing it to the reranker remains a planned improvement.
- **Italian-paraphrase crowding**: I did not measure whether near-duplicate Italian paraphrases push correct candidates out of the top-50 pool before reranking.
- **Conflated effects**: The drop from 0.92 to 0.42 combines three factors: moving away from the famous Canto 1, expanding the search space to the whole Inferno, and using noisier queries. I did not isolate the effect of query realism.
- **Circularity in labels**: The LLM that generated the queries likely classified their difficulty, introducing bias.
- **Encoder limit claim**: The conclusion that the encoder is not the limiter relies only on the post-rerank score.

**Note, entity contexts.** The per-character descriptive contexts were extracted by parsing the English Wikipedia [List of cultural references in the Divine Comedy](https://en.wikipedia.org/wiki/List_of_cultural_references_in_the_Divine_Comedy), then mapping each name to its Italian form via the Italian Wikipedia character categories, e.g. [Personaggi citati nella Divina Commedia (Inferno)](https://it.wikipedia.org/wiki/Categoria:Personaggi_citati_nella_Divina_Commedia_%28Inferno%29).

*This is a working draft from an ongoing project; numbers and figures are reproducible from the project's versioned ML journal.*
