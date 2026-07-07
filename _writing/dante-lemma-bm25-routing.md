---
layout: article
title: "Lemmas over Surfaces: Routing BM25 for Dante Verse Recall"
subtitle: "Lemma-normalized BM25 lifts Recall@10 from 0.61 to 0.67 on noisy Italian queries; a query-type router provides further improvements where standard fusion methods do not"
description: In the lexical retrieval component of a Dante verse-search system, 
  lemma-normalized BM25 outperforms surface-level BM25 across 290 Italian queries. Standard score fusion methods do not improve results, whereas a per-query-type router increases performance, 
  achieving approximately one-third of the theoretical oracle upper bound on held-out data.
summary: Surface BM25 and lemma-normalized BM25 retrieve different sets of Dante tercets. 
  Surface indexing is more effective for near-literal fragments, while lemma indexing performs 
  better for paraphrased queries. Standard fusion (e.g., RRF, combined fields) fails, a router 
  that selects between the surface or lemma index based on query type outperforms. 
  The most important take-away is (again) to never fall in love with an easy narrative.
date: 2026-07-06
tags: [retrieval, evaluation, BM25, lemmatization, routing, RAG, Divine Comedy]
published: true
permalink: /writing/dante-lemma-bm25-routing/
---

This article is part of a larger project to build *DanteGPT*, a semantic search system designed to retrieve specific passages from Dante’s *Divine Comedy*. The system is built to handle two primary query types: 
* verse recall (finding a precise tercet from a half-remembered fragment) 
* thematic search (surfacing passages based on concepts or modern feelings).  

**The investigation**

The core investigation here focuses on the lexical retrieval component, asking a fundamental architectural question: when running a BM25 lexical index over the original Italian text, should the index use surface forms (the exact text) or lemmas (the base dictionary forms of the words)?

At first glance, the data provides a highly satisfying answer. It suggests that lemmatization is the clear winner because it elegantly translates Dante's complex, archaic verb conjugations into terms a modern user might type. 
However, a fundamental principle of applied ML and of life in general is to **never fall in love with an easy narrative**. 

**The Reality**

While the aggregate metrics show a clear victory for the lemma index, a decomposition of the data reveals a different reality. The underlying mechanism driving this success is not the translation of poetic vocabulary, 
but rather the shallow, statistical matching of common grammatical function words. 
This evaluation demonstrates:
* why complementary models require explicit routing rather than naive fusion
* why trusting an intuitive story is dangerous.


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
real-world Italian queries. 
This evaluation set is a subset of a larger benchmark generated via prompts given to 
various LLM models—including Grok, Claude 4.8, and Claude Fable—which were 
then manually picked, reviewed, and validated in [Argilla](https://argilla.io),
an open-source data curation platform designed specifically for NLP and LLMs.
In a direct aggregate comparison, the lemma-normalized index outperforms 
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
as lemmatization realigns the user's modern inflections with the text's original forms — though *which* inflections 
do the work turns out to be mostly grammatical rather than lexical (see [Appendix B](#appendix-b-how-much-of-the-lemma-advantage-is-incidental)).  

* **Italian Semantic Paraphrase**: These queries are completely stripped of Dante's original lexicon, 
relying entirely on a conceptual or episodic match rather than a structural translation. 
This makes it an intrinsically harder query type that typically favors dense retrieval 
models (like e5 vectors) over purely lexical systems. 
While the lemma index improves overall recall for this category, 
its head-to-head win rate against the surface index is much more mixed (14 wins to 26 losses) 
because the specific vocabulary overlap is much lower.

## Naive Fusion fails

Because surface and lemma indexes fail on different types of queries, 
they are complementary. However, attempting to combine them hurts performance.  

* Two standard fusion methods were tested: a combined index (a bag-of-words using both form and lemma)
and Reciprocal Rank Fusion (RRF).

* Both methods performed worse than the single lemma index on Recall@10 and MRR@10 metrics.  

* The failure occurs because fusion methods average the two rankings. When one specific retriever is clearly 
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
| **router-qt-loo** | 0.459 | 0.614 | 0.672 | 0.526 |
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
improvement.

## Next Steps

Moving forward, the research points to several necessary upgrades to make the system viable for production:  

* Train a Real Classifier: The current router relies on offline labels provided by an LLM. 
The system needs a lightweight machine-learning model to predict the query type or the winning 
retriever on the fly, using cheap features like query length or literal overlap.

* Full Pipeline Integration: The router must be folded into the larger, overall system architecture to coordinate 
dynamically with the dense retrieval systems.

* Domain Expansion: Testing must be extended beyond the Inferno and outside of purely Italian queries.  

## Methodological Weaknesses

Here we list weaknesses that must be addressed before moving to production:  

* **The "Perfect Classifier" Illusion** The router's leave-one-out success relies on a flawless, 
offline classifier to determine the query type—a tool that does not actually exist at runtime. 
Once a real predictive model is deployed, its inevitable classification errors will directly degrade 
the router's overall performance.  

* **Extremely Small Sub-Samples** The entire evaluation rests on a dataset of just 290 queries. 
Consequently, highly specific categories like misspellings (n=5) or syntactic reordering (n=3) 
lack statistical significance.  

* **Inherent AI Labeling Bias** Because a single LLM categorized every query according to a set taxonomy, 
any subjective fuzziness in its definitions (e.g., distinguishing between a "modern" versus a "semantic" paraphrase)
is hardwired into the router's core logic.

* **Unfair Tokenization Penalties (hypothesis)** The underlying tokenizer automatically splits Italian contractions 
(e.g., *nel* becomes *in* + *il*). When a user searches for exactly "nel", 
the query tokenizer does not break it apart; it processes it as one token.
The surface index looks for an exact string match for "nel" in the text, 
but the text only contains "in" and "il". Because the exact string is missing, the surface index registers a failure.  
The *hypothesis* is that this asymmetry penalizes the surface index, making its baseline performance look slightly 
worse than it actually is, simply because the tokenizer dismantled the function words before the search could happen. 

**We tested this claim directly (see [Appendix A](#appendix-a-testing-the-tokenization-penalty-hypothesis)): the 
mechanism is real, but its impact insignificant. That's because the contraction pieces are the lowest-signal tokens 
in the corpus.**


* **Inflated Success Metrics** For queries with multiple valid target tercets, 
the system registers a complete success if any single target is retrieved. 
Statistically, hitting one target out of many is much easier than finding one singular required target. 
Because these "multi-gold" queries are heavily concentrated in specific categories 
(like entity searches and ambiguous fragments), and because those exact categories are
routed to the surface index, the surface index is essentially playing on an easier difficulty 
setting for those searches. This makes the surface index appear artificially stronger in those buckets 
than it might be if every search were held to the same strict, single-target standard

* **The Lemma Advantage Is Mostly Function-Word Normalization** The headline result — lemma beats surface — was 
measured without any stopword control. Lemmatization does not only collapse the inflections of *content* words (the 
advertised mechanism, *disse*/*dicea* → *dire*); it also collapses those of *function* words, above all the 
conjugations of the copula *essere* (*sono*/*era*/*fossimo* → *essere*). BM25 already down-weights these via IDF 
(*essere*'s is 0.73 precisely because it appears in ~48% of tercets), so their contribution is small and, by the 
model's own logic, legitimate — but it is *shallow*, and it turns out to carry most of the measured gap. When the 
same stopword filter is applied to **both** indexes, the Recall@10 gap collapses from +0.055 to +0.010 (the copula 
*essere* alone accounts for a quarter of it) and the win/loss flips 
from 45/29 to 18/48 (see [Appendix B](#appendix-b-how-much-of-the-lemma-advantage-is-incidental)). This does not mean 
the lemma advantage is fake. Modern paraphrases share copular structures with Dante's verses, meaning 
the normalization of function words provides a real, measurable boost. However, 

**it proves that the system's success 
relies predominantly on shallow grammatical matching rather than decoding complex content words (the easy narrative 
we were tempted to believe).**

## Appendix A: Testing the Tokenization-Penalty Hypothesis

We test here directly the **Unfair Tokenization Penalties (hypothesis)**, according to which
contraction splitting *"makes the surface baseline look slightly worse than it actually is"*. 
The short answer: removing it does not help the surface index.

### The mechanism is real

The surface index is not built from raw text; it is built from the `form` field of the lemmatized treebank, where 
the linguistic pipeline has *already* split articulated prepositions. So the whole-string contractions never enter 
the surface vocabulary in the first place:

| token | in surface vocabulary? |
|---|---|
| `nel`, `del`, `della`, `nella`, `col` | **no** (stored pre-split) |
| `in`, `il`, `di` | yes |

The asymmetry is between the two sides of the pipeline: documents are tokenized linguistically (contractions split), 
while queries are tokenized by a plain letter-run regex (contractions kept whole). On the opening verse:

```
text         : "Nel mezzo del cammin di nostra vita"
query tokens : ['nel', 'mezzo', 'del', 'cammin', 'di', 'nostra', 'vita']
surface doc  : ['in', 'il', 'mezzo', 'di', 'il', 'cammin', 'di', 'nostra', 'vita']
lost by surface (df = 0): ['nel', 'del']
```

Across the 290 Italian queries, **48 (17%)** contain at least one contraction that is dropped by the 
surface index this way (`del` ×13, `nella` ×10, `nel` ×6, `dal` ×5, `dell` ×4).

### The penalty is not real

If the hypothesis held, making the two sides *symmetric* — splitting contractions in the query too, so `nel` → 
`in` + `il` on both sides — should recover lost recall. It does not. It is neutral-to-slightly-negative, both on 
all queries and on the affected subset alone:

| scope | variant | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|
| all 290 it | surface (query kept whole) | 0.4276 | 0.6000 | 0.6138 | 0.4970 |
| all 290 it | surface + query split | 0.4241 | 0.5966 | 0.6138 | 0.4946 |
| all 290 it | **Δ** | **−0.0034** | −0.0034 | 0.0000 | **−0.0024** |
| 48 affected | surface (query kept whole) | 0.3542 | 0.5417 | 0.5833 | 0.4412 |
| 48 affected | surface + query split | 0.3333 | 0.5417 | 0.5833 | 0.4248 |
| 48 affected | **Δ** | **−0.0208** | 0.0000 | 0.0000 | **−0.0163** |

On the affected subset, restoring the split changes 27 rankings — but 17 get *worse* and only 10 get better.

### Why: contraction pieces carry almost no signal

BM25 already down-weights the pieces that contractions split into: they are among the most common function words in 
the corpus, so their IDF (Inverse Document Frequency) is low. Re-injecting them adds noise (they match almost every 
tercet) rather than discriminative signal.

| token | IDF | token | IDF |
|---|---|---|---|
| `a` | 0.82 | `da` | 1.92 |
| `il` | 0.91 | `con` | 1.78 |
| `la` | 0.95 | `su` | 3.15 |
| `di` | 0.97 | `cammin` (content word) | **5.87** |
| `in` | 1.47 | `selva` (content word) | **4.85** |

A content word carries 4–7× the weight of a contraction fragment. Losing the fragments costs approximately nothing.

### Takeaway

The tokenization asymmetry exists but it does **not** affect the surface baseline — the surface-vs-lemma gap reported 
in this article is not an artifact of contraction splitting. Where the lemma index *does* gain is inflection collapse: 
the query form and the text form are **both** in the corpus but differ as strings while sharing a lemma 
(`dicea` ↔ `disse` → `dire`) — and, as [Appendix B](#appendix-b-how-much-of-the-lemma-advantage-is-incidental) shows, 
most of that collapse is on grammatical function words rather than content words.

Reproduce with:

```
python scripts/tokenization_penalty.py               # all 290 Italian queries
python scripts/tokenization_penalty.py --subset-only  # only the 48 affected queries
```

## Appendix B: How Much of the Lemma Advantage Is Incidental?

The central results of the evaluation rely on a baseline that does not strip stopwords from the text. 
Because the verb *essere* appears in 48% of the corpus (768 out of 1,596 tercets), BM25 correctly 
assigns it a low Inverse Document Frequency (IDF) score of 0.73. That down-weighting is legitimate — the term is 
weak signal the model has already discounted, not noise it ignores — but in a close ranking race even a small, 
down-weighted grammatical match can dictate the winner.

### The impact of the verb "to be"

The single most improved query in the modern paraphrase bucket, *"il bosco dove i suicidi sono imprigionati come 
piante"*, jumps from rank 18 on the surface index to rank 1 on the lemma index. That leap is almost entirely driven 
by the modern word *sono* lemmatizing to *essere* and matching Dante's *era*: its only content match, *bosco*, 
already matches identically under both indexes, so the copula is the *only* thing lemmatization adds. Remove that 
single match and the lemma rank falls from 1 back to 4.

### The test: same stopword filter on both indexes

To measure the effect fairly, we identify stopwords by **lemma** (so *sono* and *era* — both *essere* — are removed 
together) and strip them from documents *and* queries, for surface and lemma alike, then rebuild the indexes and 
re-score all 290 queries. The lemma-minus-surface gap shrinks sharply as the stoplist grows:

| stoplist removed (from both indexes) | gap MRR@10 | gap Recall@10 |
|---|---|---|
| none — *the article's baseline* | +0.0196 | +0.0552 |
| `essere` only | +0.0166 | +0.0414 |
| auxiliaries/copulas (`essere, avere, stare, fare`) | +0.0205 | +0.0483 |
| **full function-word list** (articles, prepositions, pronouns, conjunctions, copulas) | **+0.0071** | **+0.0103** |

The single word *essere* accounts for about a **quarter** of the Recall@10 advantage; the full function-word filter 
erases **~81%** of it (and ~64% of the MRR gap). The four-system table below shows why: stopword removal *helps* the 
surface index and slightly *hurts* the lemma index, converging them.

The effect is not strictly monotonic across *partial* stoplists — removing the auxiliaries *avere*/*stare*/*fare* on 
top of *essere* nudges the gap back up (+0.0483), because those verbs interact differently with the two indexes. Only 
the full function-word filter gives the clean picture; the partial rows are included for transparency, not as a trend.

| system | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| surface (baseline) | 0.428 | 0.600 | 0.614 | 0.497 |
| lemma (baseline) | 0.445 | 0.607 | 0.669 | 0.517 |
| surface + stopword removal | 0.448 | 0.576 | 0.621 | 0.501 |
| lemma + stopword removal | 0.448 | 0.593 | 0.631 | 0.508 |

### The flip in lemma wins

Restricting to the 
`modern_italian_paraphrase` bucket — the 107 queries that should justify lemmatization — and counting:

| modern_italian_paraphrase | lemma wins | lemma losses |
|---|---|---|
| baseline (no stopword filter) | **45** | 29 |
| with stopword removal | **18** | 48 |

Without a stopword filter, the lemma index wins 45 of these queries and loses 29. Once the grammatical matches stop 
counting, that flips to 18 wins against 48 losses: in the very category built to favour it, lemmatization now loses 
more paraphrase queries than it wins. This is not in contradiction with the small *aggregate* edge in the table above — a 
count measures *direction* (how many queries each index ranks better), the aggregate measures *magnitude* 
across all 290 queries.

### Takeaways

* **The 80/20 reality.** This ablation shows that roughly 80% of the headline gap is driven by function-word 
normalization, while only ~20% comes from the content-word morphology (e.g., *disse* → *dire*) the article 
originally highlighted.

* **A surviving edge.** The lemma index does keep a small advantage on content words (MRR 0.508 vs 0.501) 
from successful dictionary collapses like *bianca* → *bianco* or *morde* → *mordere*.

* **A design choice, not a bug.** The shared grammatical structure is a real statistical regularity that BM25 handles 
correctly — removing it is *systematically* negative for the lemma index, not a wash, so it is genuine (if shallow) 
signal. The point is only that 
the narrative must honestly reflect that grammar, not deep vocabulary, is doing the heavy lifting.


Reproduce with:

```
python scripts/stopword_ablation.py
```

*This is a working draft from an ongoing project; the numbers and tables are reproducible from the versioned code
(`bm25.py`, `bm25_eval.py`, `scripts/analyse_bm25_eval_results.py`, `scripts/tokenization_penalty.py`, 
`scripts/stopword_ablation.py`) and the labeled eval slice.*
