---
layout: article
title: "Lemmas over Surfaces: Routing BM25 for Dante Verse Recall"
subtitle: "Lemma-normalized BM25 lifts Recall@10 from 0.61 to 0.67 on noisy Italian queries — then a query-type router beats it again, where naive fusion could not"
description: On the lexical track of a Dante verse-retrieval system, lemma-normalized BM25 beats surface BM25 on 290 real
  Italian queries. Fusing the two the naive way does not help; a per-query-type router does — and it recovers about a
  third of the oracle headroom, honestly, on held-out queries.
summary: Surface BM25 and lemma-normalized BM25 disagree on which Dante tercets they retrieve — surface wins near-literal
  fragments, lemma wins paraphrases. Lemma is the better single index. But fusing them (RRF, a combined field) does not
  beat lemma alone, because fusion averages instead of choosing. A router that picks surface-or-lemma per query type does
  beat it, recovers ~1/3 of the oracle gap, and — measured leave-one-out — generalizes rather than overfits. The lesson
  is that complementary retrievers want routing, not blending.
date: 2026-07-06
tags: [retrieval, evaluation, BM25, lemmatization, routing, RAG]
published: true
permalink: /writing/dante-lemma-bm25-routing/
---


This article is part of a larger project to build *DanteGPT*,
a semantic search system designed to retrieve specific passages from Dante’s Divine Comedy. 
The system is built to handle two primary query types: 
* verse recall (finding a precise tercet from a half-remembered fragment) 
* thematic search (surfacing passages based on concepts or modern feelings).  

The core investigation here focuses on the lexical retrieval and asks a fundamental question: when running a BM25 lexical index over the original 
Italian text, should the index use surface forms (the exact text) or lemmas (the base dictionary forms of the words)?


{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## Morphological Richness

The Divine Comedy is morphologically very rich. 
For example in its first Cantica, the Inferno, the verb *dire* (to say) appears 304 times in 33 distinct inflected forms, 
such as *disse*, *dir*, and *dicea*.

* A user trying to remember a verse might query the imperfect form *dicea*, 
while Dante's original text uses the simple past form *disse*.  

* Standard surface BM25 matches exact strings, meaning *dicea* will completely fail to match *disse*.  

* Lemmatization resolves this by collapsing all inflections into their base dictionary form (dire), 
bridging the gap between the user's memory and the text.

**Note on the UD_Italian-Old Treebank**

The lemmatization used throughout this evaluation is made possible by the
[Italian-Old Universal Dependencies treebank](https://github.com/UniversalDependencies/UD_Italian-Old). 
This open-source repository is a joint collaboration among various Italian universities and contains 
Dante Alighieri's complete Divine Comedy paired with its full lemmatization. 
Because the corpus already carries this gold-standard morphological annotation, 
it provides the exact mapping necessary to translate Dante's complex surface inflections 
into base lemmas for the index natively and for free.

## Overall Performance: Lemma Beats Surface

Testing was conducted over the Inferno (a corpus of 1,596 tercets) using an evaluation set of 290 noisy, 
real-world Italian queries. In a direct aggregate comparison, the lemma-normalized index outperforms 
the surface index across all metrics:  

* Recall@10: Increased from 0.614 (surface) to 0.669 (lemma).
* MRR@10: Increased from 0.497 (surface) to 0.517 (lemma).

Here the complete table of the results:

| index | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| surface | 0.428 | 0.600 | 0.614 | 0.497 |
| **lemma-full** | **0.445** | **0.607** | **0.669** | **0.517** |


## Wins by Query Type

While lemma indexing wins overall, separating the 290 queries by type reveals that its success is highly conditional:  

* Paraphrases (Lemma Wins): The overall success of the lemma index comes almost exclusively 
from modern Italian paraphrases (107 queries). For these searches, lemmatization effectively 
bridges the gap between the modern word forms a user types and the historical inflections Dante wrote.

* Near-Literal Fragments (Surface Wins): For exact or near-exact quotes, the surface index already achieves a 97–100% 
Recall@10. In these cases, lemmatization only introduces unnecessary noise.  

* Misspellings and Entities (Surface Wins): Using the lemma index actually hurts performance when users misspell 
words or search for specific names. Misspellings bypass the lemmatizer while surrounding words are 
altered and consequently user queries ruined by broadening the results to unrelated text.



| query_type | n | ΔMRR (lemma − surface) | R@10 surface → lemma | lemma win / loss |
|---|---|---|---|---|
| modern_italian_paraphrase | 107 | **+0.068** | 48.6% → 59.8% | 45 / 29 |
| italian_semantic_paraphrase | 73 | +0.023 | 46.6% → 54.8% | 14 / 26 |
| italian_fragment | 49 | −0.022 | 100% → 98.0% | 1 / 2 |
| entity_level | 31 | −0.032 | 54.8% → 54.8% | 2 / 3 |
| ambiguous_fragment | 8 | −0.085 | 100% → 100% | 0 / 3 |
| italian_misspelled | 5 | −0.198 | 100% → 80.0% | 0 / 1 |
| others (typo, reorder, …) | ≤5 each | ~0 | ~100% | — |

**Note on Paraphrase Query Types**

The evaluation set relies heavily on two major paraphrase categories: modern_italian_paraphrase (107 queries) 
and italian_semantic_paraphrase (73 queries). Here is how their underlying prompts and generation logic differ:  

* **Modern Italian Paraphrase**: These are queries where a user restates a scene in their own words, 
but the prompt maintains the general content and structure of the original verse. 
Because it stays structurally close to the source, this type inherently advantages lexical matching 
(like BM25) and is generally easier for the system to resolve. 
This specific bucket drives the entire aggregate win for the lemma index, 
as lemmatization perfectly realigns the user's modern inflections with the text's original forms.  

* **Italian Semantic Paraphrase**: These queries are completely stripped of Dante's original lexicon, 
relying entirely on a conceptual or episodic match rather than a structural translation. 
This makes it an intrinsically harder query type that typically favors dense retrieval 
models (like e5 vectors) over purely lexical systems. 
While the lemma index improves overall recall for this category, 
its head-to-head win rate against the surface index is much more mixed (14 wins to 26 losses) 
because the specific vocabulary overlap is much lower.

The Categorization Caveat:
These two types sit on a "fuzzy stylistic boundary". 
All query types were assigned by a single offline LLM following a fixed taxonomy. Consequently, 
the exact separation between a "modern" restatement and a "semantic" one is defined by that LLM's internal 
logic. As a result, any flaws or biases in how the AI sorted these queries naturally 
skew both our final performance scores and the rules the router learned.

## Naive Fusion fails

Because surface and lemma indexes fail on different types of queries, 
they are complementary. However, attempting to combine them to get the best of both worlds actively hurts performance.  

* Two standard fusion methods were tested: a combined index (a bag-of-words using both form and lemma)
and Reciprocal Rank Fusion (RRF).

* Both methods performed worse than the single lemma index on Recall@10 and MRR@10 metrics.  

* The fundamental failure occurs because fusion methods average the two rankings. When one specific retriever is clearly 
correct for a given query, averaging simply dilutes the accurate result rather than highlighting it.  

| index | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| lemma-full (best single) | 0.445 | 0.607 | 0.669 | 0.517 |
| combined | 0.441 | 0.614 | 0.652 | 0.512 |
| rrf | 0.421 | **0.624** | 0.641 | 0.500 |

## The Solution: A Query-Type Router

The optimal approach is to evaluate the query and explicitly route it to either the surface 
or lemma index based on its underlying type.  

* The Routing Policy: Literal fragments, entity searches, ambiguous words, and misspellings 
are routed to the surface index; modern and semantic paraphrases are routed to the lemma index.  

* The Results: Using a leave-one-out evaluation, this router achieved an MRR of 0.526 and a Recall@1 of 0.459.

* The Impact: Instead of blending the models, routing between them successfully recovers roughly a third of 
the theoretical maximum MRR headroom compared to an impossible, "perfect oracle" system


| index | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| lemma-full (best single) | 0.445 | 0.607 | 0.669 | 0.517 |
| rrf (best fusion) | 0.421 | 0.624 | 0.641 | 0.500 |
| **router-qt** (in-sample) | 0.462 | 0.617 | 0.676 | 0.530 |
| **router-qt-loo** (honest) | 0.459 | 0.614 | 0.672 | 0.526 |
| oracle(s+l) | 0.476 | 0.648 | 0.679 | 0.547 |


**Note on the leave-one-out evaluation**

In a leave-one-out evaluation, the system dictates the routing rule for a specific query using only the other queries 
within that same category, completely isolating the query currently being tested. 
This removes a query's "self-vote", quite dangerous in a study like this where several query buckets are extremely small, 
such as the "misspelled" category which only has 5 queries.

**Note on the Oracle Metric**

In the evaluation tables above, oracle(s+l) does not represent a deployable system; 
rather, it is a theoretical upper bound used to measure the absolute ceiling of performance.  

It is calculated by "peeking" at the gold standard and automatically selecting whichever index (surface or lemma) 
scored higher for each individual query.

* If a query fails on the surface index but succeeds on the lemma index, the oracle takes the lemma score.

* If a query succeeds on surface but fails on lemma, the oracle takes the surface score.

* If both fail, the oracle takes the failure.

Averaging these perfect, hindsight-driven choices gives us an MRR ceiling of 0.547. By comparing our baseline lemma 
index (0.517) to this oracle ceiling (0.547), we can clearly see a maximum "headroom" of 0.030. We use this theoretical 
yardstick to prove that our deployable router (0.526) successfully recovers about a third of the total possible
improvement without cheating.

## Next Steps

Moving forward, the research points to several necessary upgrades to make the system viable for production:  

* Train a Real Classifier: The current router relies on offline labels provided by an LLM. 
The system needs a lightweight machine-learning model to predict the query type or the winning 
retriever on the fly, using cheap features like query length or literal overlap.

* Full Pipeline Integration: The router must be folded into the larger, overall system architecture to coordinate 
dynamically with the dense retrieval systems.

* Domain Expansion: Testing must be extended beyond the Inferno and outside of purely Italian queries.  

## Methodological Weaknesses

The document concludes raising points that must be addressed before moving to production:  

* **The "Perfect Classifier" Illusion** The router's leave-one-out success relies on a flawless, 
offline classifier to determine the query type—a tool that does not actually exist at runtime. 
Once a real predictive model is deployed, its inevitable classification errors will directly degrade 
the router's overall performance.  

* **Extremely Small Sub-Samples** The entire evaluation rests on a dataset of just 290 queries. 
Consequently, highly specific categories like misspellings (n=5) or syntactic reordering (n=3) 
lack statistical significance; their recorded metrics indicate a general trend rather than a reliable magnitude of impact.  

* **Inherent AI Labeling Bias** Because a single LLM categorized every query according to a set taxonomy, 
any subjective fuzziness in its definitions (e.g., distinguishing between a "modern" versus a "semantic" paraphrase)
is hardwired into the router's core logic.

* **Unfair Tokenization Penalties** The underlying tokenizer automatically splits Italian contractions 
(e.g., *nel* becomes *in* + *il*). When a user searches for exactly "nel", 
the query tokenizer does not break it apart; it processes it as one whole, intact token.
The surface index looks for an exact string match for "nel" in the text, 
but the text only contains "in" and "il". Because the exact string is missing, the surface index registers a failure.  
This effectively penalizes the surface index, making its baseline performance look slightly worse than it actually is, 
simply because the tokenizer dismantled the function words before the search could happen.


* **Inflated Success Metrics** For queries with multiple valid target tercets, 
the system registers a complete success if any single target is retrieved. 
Statistically, hitting one target out of many is much easier than finding one singular required target. 
Because these "multi-gold" queries are heavily concentrated in specific categories 
(like entity searches and ambiguous fragments), and because those exact categories are
routed to the surface index, the surface index is essentially playing on an easier difficulty 
setting for those searches. This makes the surface index appear artificially stronger in those buckets 
than it might be if every search were held to the same strict, single-target standard

*This is a working draft from an ongoing project; the numbers and tables are reproducible from the versioned code
(`bm25.py`, `bm25_eval.py`, `scripts/analyse_bm25_eval_results.py`) and the labeled eval slice.*
