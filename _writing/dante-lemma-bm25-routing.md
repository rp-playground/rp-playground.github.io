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
published: false
permalink: /writing/dante-lemma-bm25-routing/
---

This article belongs to the same *DanteGPT* project as [The Reality Gap](/writing/dante-retrieval-reality-gap/): a
search system that, given a fuzzy query, returns the exact *tercet* of the *Divine Comedy* it belongs to. That piece
looked at the whole two-stage pipeline (BM25 + dense + fusion + reranking) and concluded that on realistic queries the
lexical and dense tracks are *complementary but hard to combine* — naive fusion of the two hurt. This one zooms into the
**lexical track alone** and asks a narrower question that the pipeline view skipped over: when we run BM25 over the
original Italian, should the index be over **surface forms** or over **lemmas**?

**Background**

Italian is morphologically rich. The same verb shows up as *dico, dissi, disse, dicea, detto*; a reader half-remembering
a verse will often reach for a different inflection than the one Dante wrote. Surface BM25 matches strings, so *dicea* in
the query never touches *disse* in the text. Lemma normalization collapses both to the lemma *dire* — in principle
exactly the fix for paraphrase-style queries. In principle. Whether it *actually* helps, and by how much, and where it
backfires, is a measurement question, and the corpus already carries gold morphological annotation (a Universal
Dependencies treebank of the *Comedy*), so the lemmas are free.

**The investigation**

The arc below is three measurements. First, lemma vs surface head-to-head — lemma wins overall, but only in some places.
Second, an attempt to get the best of both by **fusing** them — which fails, the same way fusion failed in the pipeline
piece. Third, a **router** that picks one or the other per query type — which works, is honest under leave-one-out, and
recovers about a third of the gap to a per-query oracle. The through-line is a small general lesson about complementary
retrievers: *choose, don't average.*

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## 1. Setup: corpus, queries, and what "lemma index" means

The corpus is the **Inferno**: 1,596 tercets (~41k tokens), the tercet being the retrieval unit. Documents are the
tercets; a query is scored against all 1,596 and we ask at what rank the gold tercet appears.

The evaluation set is a submitted-and-verified slice of a noisy cross-canto benchmark, restricted here to its **290
Italian queries** (`language == "it"`). The 137 English queries are dropped on purpose: the index is Italian, so both
retrievers would fail them for reasons that have nothing to do with lemmatization, and averaging them in would only add
noise to the comparison. Each query carries one or more `accepted_tercet_ids`; a query is a hit@k if *any* accepted
tercet is in the top-k, and MRR uses the best rank among the accepted.

The one subtlety is what "the lemma index" is built from. The project already ships a `concepts.jsonl` vocabulary, and it
would be the obvious source — but it is **lossy** by construction. It keeps only content words (NOUN/PROPN/VERB/ADJ),
drops six light verbs (*essere, avere, potere, dovere, volere, fare*), keeps only lemmas with corpus frequency ≥ 2, and
deduplicates the tercet list per lemma so term frequency is **binary**. That is a fine vocabulary for an autocomplete
embedding matrix, but as a BM25 index it changes four things at once relative to surface, and none of them is
lemmatization. To make *form vs lemma* the only variable, I build both indexes from the **token table** (`tokens.jsonl`),
which has every token's surface `form` and its gold `lemma` with position. Each tercet becomes two token lists over the
**same tokens** — the forms, and the lemmas — with real term frequencies. The lossy `concepts.jsonl` index is kept only
as a third point, to show what its filters cost.

The last piece is the query side. There is no lemmatizer in the stack that reproduces the treebank's Old-Italian lemma
scheme, so instead of bolting on a modern Italian lemmatizer (whose lemmas would not match the gold scheme) I learn a
**form → lemma map from the corpus itself**: for each surface form, its most frequent lemma across the Inferno. Query
terms are lemmatized through that map (falling back to the raw word when unseen), which keeps queries in exactly the
index's lemma space with zero new dependencies. BM25 is textbook Okapi (k1=1.5, b=0.75), implemented in ~40 lines so the
comparison has no library-specific behavior hiding in it.

## 2. Lemma beats surface — overall

Head-to-head over the 290 Italian queries:

| index | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| surface | 0.428 | 0.600 | 0.614 | 0.497 |
| **lemma-full** | **0.445** | **0.607** | **0.669** | **0.517** |
| lemma-concepts | 0.407 | 0.548 | 0.590 | 0.469 |

Lemma normalization wins on every metric, and the largest gap is at **Recall@10 (0.614 → 0.669, +5.5 points)** — the
morphological collapse pulls the gold into the top-10 for queries where the surface string never lined up. Two things are
worth flagging before reading too much into it.

First, **`lemma-concepts` is worse than surface**, not better. Same lemmatization idea, but through the filtered
vocabulary — and the filters (content-only, freq ≥ 2, binary tf) strip more signal than the normalization adds back.
This is the concrete reason the primary lemma index is built from `tokens.jsonl` and not from the convenient
pre-existing vocabulary: the "lemma index" you happen to have lying around is not the "lemma index" that answers the
question.

Second, +5.5 points at R@10 is a real but modest aggregate, and aggregates hide structure. The next section is where the
comparison actually earns its keep.

## 3. Where each one wins

The 290 queries were labeled with a `query_type` — literal fragment, modern paraphrase, semantic paraphrase, misspelled,
entity reference, ambiguous single word, and so on — by an LLM following a fixed taxonomy (see *Methodological
Weaknesses* for the sizeable caveats this carries). Splitting the surface → lemma comparison by type turns the flat +5.5
into a shape:

| query_type | n | ΔMRR (lemma − surface) | R@10 surface → lemma | lemma win / loss |
|---|---|---|---|---|
| modern_italian_paraphrase | 107 | **+0.068** | 48.6% → 59.8% | 45 / 29 |
| italian_semantic_paraphrase | 73 | +0.023 | 46.6% → 54.8% | 14 / 26 |
| italian_fragment | 49 | −0.022 | 100% → 98.0% | 1 / 2 |
| entity_level | 31 | −0.032 | 54.8% → 54.8% | 2 / 3 |
| ambiguous_fragment | 8 | −0.085 | 100% → 100% | 0 / 3 |
| italian_misspelled | 5 | −0.198 | 100% → 80.0% | 0 / 1 |
| others (typo, reorder, …) | ≤5 each | ~0 | ~100% | — |

The entire aggregate win comes from **one bucket**: modern Italian paraphrases, the largest group (107 of 290), where
the user restates a scene in their own words and lemma normalization realigns the inflections (+6.8 MRR, R@10
48.6% → 59.8%, 45 wins against 29 losses). The semantic-paraphrase bucket helps on recall but is mixed on per-query wins.

Everywhere else lemma is **neutral or actively harmful**:

- On **near-literal fragments** surface is already at 97–100% R@10 — the query *is* the verse, there is nothing to
  normalize, and lemmatizing can only over-merge distinct words and add noise.
- On **misspelled** queries lemma is worst (−0.198 MRR): a misspelled form is not in the corpus `form → lemma` map, so
  it falls through un-normalized *and* the surrounding correctly-spelled words get collapsed toward common lemmas that
  match the wrong tercets. (This bucket is n=5, so read the *direction*, not the magnitude.)
- On **single-word / entity** queries lemma widens the match set toward thematically related but wrong tercets.

So lemma is not uniformly better; it is better *conditional on query type*, and the condition is legible.

## 4. The complementarity is real — and fusion wastes it

If surface and lemma fail on different queries, the obvious move is to combine them. Counting per-query outcomes, they
are genuinely complementary: **surface strictly beats lemma on 66 queries, lemma strictly beats surface on 63, and they
tie on 161.** That 66-vs-63 split is the opportunity. I tried two standard, parameter-light ways to cash it in, plus an
oracle to measure the ceiling:

- **combined** — a single BM25 index whose documents are the `form + lemma` bag per tercet, queried with raw + lemmatized
  terms (exact matches hit twice).
- **rrf** — Reciprocal Rank Fusion of the surface and lemma rankings (k=60), which needs no score calibration.
- **oracle(s+l)** — the best of surface/lemma per query. Not deployable (it peeks at the gold); it measures how much a
  *perfect* choice would be worth.

| index | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| lemma-full (best single) | 0.445 | 0.607 | 0.669 | 0.517 |
| combined | 0.441 | 0.614 | 0.652 | 0.512 |
| rrf | 0.421 | **0.624** | 0.641 | 0.500 |
| oracle(s+l) | **0.476** | **0.648** | **0.679** | **0.547** |

**Neither fusion beats lemma-full.** They nudge R@5 up but lose R@10 and MRR, and head-to-head against lemma-full both
are net negative — combined at 44 wins / 67 losses (−23), rrf at 51 / 65 (−14). This is the same shape the pipeline
article hit when it fused BM25 with dense at a static weight, one level down: the fusion **averages** two rankings even
when one of them is clearly the right one to trust for this query, so the weaker track dilutes the stronger. The oracle
says the opportunity is real — a perfect chooser reaches MRR 0.547 against lemma's 0.517, and R@1 0.476 against 0.445 —
but RRF and combined leave almost all of it on the table.

The problem was never "combine the scores." It was "decide which retriever to believe."

## 5. A router that chooses

Deciding is exactly what the `query_type` split from §3 lets us do. Route each query to whichever of surface / lemma-full
has the better mean reciprocal rank *on that query type*, and switch between them per type instead of blending. Two
versions, because the honest and the optimistic estimate differ:

- **router-qt** — the routing policy is fit on the whole set (in-sample; an upper bound on a query-type router).
- **router-qt-loo** — leave-one-out: each query's decision is made from the *other* queries of its type only, singletons
  falling back to the global default (lemma-full). This is the honest generalization estimate — no query helps decide
  its own routing.

| index | R@1 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|
| lemma-full (best single) | 0.445 | 0.607 | 0.669 | 0.517 |
| rrf (best fusion) | 0.421 | 0.624 | 0.641 | 0.500 |
| **router-qt** (in-sample) | 0.462 | 0.617 | 0.676 | 0.530 |
| **router-qt-loo** (honest) | 0.459 | 0.614 | 0.672 | 0.526 |
| oracle(s+l) | 0.476 | 0.648 | 0.679 | 0.547 |

**The router beats lemma-full; fusion did not.** The honest leave-one-out version reaches MRR 0.526 and R@1 0.459,
recovering about **a third of the oracle's MRR headroom** (0.517 → 0.526 of an available 0.517 → 0.547) and **~45% of the
R@1 headroom** — and it does so using nothing from the gold, only the query type. Just as important, `router-qt-loo` sits
almost on top of the in-sample `router-qt`: the policy **generalizes**, it is not an artifact of letting tiny query-type
groups vote on themselves.

The learned policy is not a black box; it is the §3 reading, made into a rule:

| routed to `surface` | routed to `lemma-full` |
|---|---|
| italian_fragment, entity_level, ambiguous_fragment, italian_misspelled | modern / italian_semantic_paraphrase, typo, syntactic_reorder, fragment_approx, … |

Literal fragments, entities, ambiguous single words, and misspellings go to surface; paraphrases go to lemma. It is the
kind of rule you could have guessed from §3 — which is the point: the split *predicted* a working router, and the router
*confirmed* the split.

## Conclusion

For lexical verse recall on realistic Italian queries, **lemma-normalized BM25 is the better single index** (Recall@10
0.61 → 0.67), and the gain is concentrated almost entirely in modern-Italian paraphrases. But the ceiling is not a better
single index. Surface and lemma are complementary on roughly a quarter of queries each, and the way to spend that
complementarity is a **per-query-type router** (honest MRR 0.517 → 0.526, R@1 0.445 → 0.459), not fusion, which — RRF and
a combined field alike — came in *below* lemma alone.

## The main lesson

When two retrievers are complementary, the instinct is to fuse their scores. But fusion *averages*, and averaging is the
wrong operation when one retriever is reliably right for a recognizable slice of queries. There, the winning move is to
**route, not blend** — and a cheap, legible signal (here, query type) is often enough to route on. This is the same
lesson the full-pipeline article reached from the other direction: its static BM25+dense fusion also lost, and its fix
was *query-aware* weighting — which is routing wearing a fusion coat.

## What's next

The router's one unpaid bill is the `query_type` label: here it comes from an offline LLM, so the honest 0.526 assumes a
perfect type classifier at inference. The obvious next step is to remove that assumption:

- Train a **lightweight surface-vs-lemma router** directly on the queries — either predicting the query type, or better,
  predicting *which retriever will win* from cheap features (query length, literal overlap with any tercet, presence of
  out-of-vocabulary / misspelled tokens, function-word ratio). The label is free: run both retrievers offline and take
  the winner.
- Fold the router into the **full pipeline** as a third axis alongside the BM25/dense query-aware weighting, so surface
  vs lemma is chosen with the same machinery that already chooses lexical vs dense.
- Extend beyond the Inferno and beyond Italian-only, where the whole comparison currently lives.

## Methodological Weaknesses

The usual honest ledger of what would have to be firmed up before any of these numbers travel:

- **Tiny per-type cells drive the most eye-catching claims.** Several `query_type` buckets have n ≤ 5
  (`italian_misspelled` n=5, `italian_typo` n=4, `syntactic_reorder` n=3, and singletons). The dramatic "lemma is worst
  on misspelled, ΔMRR −0.198" is one or two queries flipping. Those cells should be read as *direction only*; they carry
  no reliable magnitude, and no confidence intervals or bootstrap are reported anywhere here.
- **The whole study is n=290, Italian-only, Inferno-only.** No significance testing accompanies the headline deltas
  (surface→lemma +5.5 R@10; router −lemma +0.9 MRR). At this size, sampling variance alone could move any of them by a
  few points, so "beats", "does not beat", and "recovers a third" are read from point estimates, not tested.
- **The router assumes a perfect query-type classifier it does not have.** `router-qt-loo` is honest about *policy*
  overfitting (leave-one-out on the decision) but still consumes the *true* `query_type` at inference. A real system must
  predict the type, and that classifier's errors will eat into the 0.526 — how much is unmeasured. The deployable number
  is therefore an upper bound on a router that must first guess the type.
- **The `query_type` labels are LLM-generated, and the split is not independent of them.** A single model assigned all
  290 types following a taxonomy, and by its own account the largest two buckets — `modern_italian_paraphrase` (107) vs
  `italian_semantic_paraphrase` (73) — sit on a fuzzy stylistic boundary. Since those labels define both the §3 story and
  the §5 router's strata, any labeling bias is baked into both; the router's success partly reflects how well the labeler
  carved the space, not only how separable the queries are.
- **The routing criterion and the reporting metric are not the same statistic.** The router picks per type by *uncapped*
  mean reciprocal rank, while the headline is MRR@10 (capped at rank 10). They usually agree on which system is better,
  but a type whose advantage lives entirely below rank 10 could be routed on a signal the headline metric cannot see.
- **In-sample vs leave-one-out is the only generalization check.** LOO removes a query's self-vote but the type
  *inventory* and the global default (lemma-full) are still chosen with full-set knowledge. A true held-out split (fit
  the policy on one half of the queries, evaluate on the other) is not run; the ~0.003 gap between `router-qt` and
  `router-qt-loo` is suggestive of stability, not proof of it.
- **The oracle and the router only arbitrate two systems.** `oracle(s+l)` and both routers choose between surface and
  lemma-full only; `combined`, `rrf`, and `lemma-concepts` are excluded from the choice set. A larger oracle over all
  five would show more headroom, and might change which "single system" the router should default to.
- **Surface and lemma tokenization are not perfectly matched.** Both indexes come from the same token table, but that
  table is at the *syntactic-word* level, where Italian contractions are already split (*nel* → *in* + *il*). A query
  typed as *nel* is tokenized whole and matches neither split token, so surface is quietly penalized on some
  function-word matches. Content words (which carry the BM25 signal) are unaffected, but the surface baseline is a hair
  lower than a contraction-aware tokenizer would give.
- **The `form → lemma` query map is corpus-bounded and frequency-disambiguated.** It can only lemmatize words Dante used,
  and it resolves each surface form to its single most frequent lemma — so genuinely ambiguous forms are collapsed to one
  reading, and any query word outside the Inferno's vocabulary passes through un-normalized. This is exactly why lemma
  underperforms on misspelled and out-of-domain queries, and it means the "lemma" condition is really "lemma where the
  corpus can lemmatize."
- **BM25 hyperparameters are untuned.** k1=1.5, b=0.75 throughout, for every index. Lemma documents are shorter than
  surface documents (function words survive as forms but many collapse as lemmas), and BM25's length normalization `b`
  interacts with that; a per-index sweep could move the surface/lemma gap in either direction.
- **Gold multiplicity is handled leniently and unevenly across types.** A query with several `accepted_tercet_ids` counts
  as a hit if *any* is retrieved, and these multi-gold queries concentrate in the `entity_level` /
  `multi_tercet_reference` / `ambiguous_fragment` buckets — the same buckets routed to surface. The lenient rule is
  defensible but it makes those buckets mechanically easier, which partly inflates surface's apparent strength there.
- **Eval provenance and decontamination are inherited, not re-audited.** The 290 queries are the Italian slice of a
  submitted-correct benchmark; this study did not re-run a leakage audit over them, and takes the upstream `gold_ok ==
  correct` labeling at face value. If any query is a near-duplicate of its target, surface benefits first.
- **No qualitative error catalogue.** As with the pipeline article, the argument is entirely quantitative — no worked
  example of a paraphrase where lemma rescues the gold, or a misspelling where it buries it. The router's policy is
  intuitive enough to state in a sentence, but the failure cases that a learned router would have to handle are not
  enumerated.

*This is a working draft from an ongoing project; the numbers and tables are reproducible from the versioned code
(`bm25.py`, `bm25_eval.py`, `scripts/analyse_bm25_eval_results.py`) and the labeled eval slice.*
