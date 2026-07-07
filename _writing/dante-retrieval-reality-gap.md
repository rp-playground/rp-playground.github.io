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
with dense retrieval over translations and paraphrases (and, as §2 shows, the original Italian verses themselves),
fused with query-aware weighting and followed 
by cross-encoder reranking. The work described here belongs to the verse-recall component and documents
the evaluation and diagnostic process that shaped its development.

**Background**

I wanted a system that finds the right *tercet* of Dante's *Divine Comedy* from a fuzzy query — a half-remembered
fragment, a paraphrase, an English approximation, the name of a character. The user half-knows the text and the system
returns the exact three lines; three because the tercet is system's semantic unit.

The retrieval stack is conventional: **BM25** over the original Italian, plus a **dense** bi-encoder
(`multilingual-e5-large`, zero-shot). The dense index starts over English translations and paraphrases; §2 then adds
the original Italian verses to it, which turns out to be the single largest dense gain. Standard metrics: Recall@1,
Recall@5, MRR@10.

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

### Is the canto-1 outlier really *memorization*?

So far "fame" is an inference: canto 1 scores higher, and it is the most-quoted canto, so the model has *probably*
memorized it. But a higher score on its own does not prove the *mechanism* — canto 1 could simply be lexically easier, or
have cleaner, more abundant translations. To pin the mechanism down I ran a small ablation that contrasts the famous canto
against the non-famous ones under three index conditions, asking two questions that a memorized exact string would answer
"yes" to. First: does indexing the **original verse** beat indexing a meaning-equivalent **Italian paraphrase** — and only
where there is a memorized surface form to lean on? Second: with **no Italian in the index at all** (only English
translations and paraphrases), is the famous canto still recalled better, because the model recognizes the material
cross-lingually from pre-training?

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_memorization_ablation.png" alt="Grouped bar chart 'Memorization ablation — dense R@1 by index condition'. Two groups, 'canto 1 (famous, n=52)' and 'cantos 4/5/26/30 (non-famous, n=196)', each with three blue bars for the index condition: EN-only, + Italian paraphrase, + original verse. Canto 1 climbs steeply 0.79 → 0.86 → 0.92; the pooled non-famous cantos stay flat 0.67 → 0.70 → 0.71. Subtitle: exact-verse premium +0.058 (canto 1) vs +0.005 pooled; EN-only fame gap 0.79 vs 0.67 — both signals are canto-1-specific.">
  <figcaption>Both memorization signatures are canto-1-specific: the original verse buys canto 1 a jump a meaning-equivalent paraphrase does not, and even English-only the famous canto is recalled better.</figcaption>
</figure>

Both signatures show up, and both are specific to canto 1. The **exact-verse premium** — the gain from indexing the
original string over a semantically-equivalent Italian paraphrase — is **+0.058** on canto 1 but only **+0.005** pooled
across the four non-famous cantos (95% CI [−0.03, +0.04], i.e. indistinguishable from zero). And with only the English
representations in the index, canto 1 still sits at **0.79** against **0.67** for the non-famous cantos. The original verse
buys canto 1 something a paraphrase of the same meaning does not, and the model knows the famous canto across languages —
neither holds for the rest.

| index condition | canto 1 (famous, n=52) | cantos 4/5/26/30 (pooled, n=196) |
|---|---|---|
| EN-only (no Italian in index) | 0.79 | 0.67 |
| + Italian paraphrase | 0.86 | 0.70 |
| + original verse (`t.dante`) | 0.92 | 0.71 |
| **exact-verse premium** | **+0.058** | **+0.005** |

Two honest caveats. The canto-1 premium's confidence interval just touches zero (n≈52, so a handful of queries move it),
which is why the argument leans on the *combination* of the two signatures and the sharp contrast with the flat non-famous
premium rather than on the premium alone. And this is a natural experiment on real text: I deliberately did **not** fabricate
"fake Dante" to obscure the verse, because synthetic tercets would confound memorization with the model's fluency on
invented archaic Italian — the fame gradient across real cantos is the cleaner test. With that, the memorization reading of
the canto-1 outlier is no longer just plausible; it is what the ablation shows.

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
  <img src="/assets/dante-retrieval-reality-gap/fig_realworld_progression.png" alt="Three color-coded bars labelled with their purpose: canto 1 (single canto, development) 0.92, cantos 4/5/26/30 (single canto, generalization probes) 0.71, noisy cross-canto (whole Inferno, real-world) 0.42. Title: 'The reality gap'.">
  <figcaption>Same retriever, three benchmarks built for different purposes.</figcaption>
</figure>

The earlier sets served their purposes: canto 1 as the high-fidelity development and productive within-canto reference, and the sets for 4/5/26/30 as generalization probes to test the system and de-risk the fame effect. The noisy cross-canto set is the one whose design priority was real-world conditions — how the retriever behaves when a user does not know the canto and is searching from partial, noisy memory. That is the number that dropped to 0.42.

## 4. What actually improved results

The realistic benchmark showed which changes helped in the full system and which only helped in isolation.

**Entity contexts.** 
I added short descriptive contexts for each character, sourced from Wikipedia (see note at the end for details). 
I also corrected an attachment error: 
the contexts had been linked to tercets where a character appears/is implied rather than to the specific tercet in which the character’s 
name is spoken. For example, Homer’s description was attached to several peripheral tercets 
like 

*"Poi che la voce fu restata e queta, vidi quattro grand’ombre a noi venire: sembianz’avevan né trista né lieta."*

along with the one that names him explicitly 

*"quelli è Omero poeta sovrano; l’altro è Orazio satiro che vene; Ovidio è ’l terzo, e l’ultimo Ovidio."*.

This correction improved BM25 on name queries. On the name-query slice of the cross-canto set, 
Recall@1 rose from 0.05 to 0.26. However, the gain was limited to the BM25 track. 
The dense retriever showed no benefit from the English contexts. Because query-aware fusion already reduces 
BM25’s weight on English queries and the reranker reorders the final candidates, 
the entity contexts produced no change in the end-to-end pipeline. 
Reranked Recall@1 was 0.514 without the contexts and 0.510 with them. The name-query slice was also unchanged.

**Fusion, the right way.** BM25 and dense are complementary per query type: BM25 wins Italian fragments and names, dense
wins English and semantics. Fusing them with Reciprocal Rank Fusion at equal weights made things worse, because dense is
the stronger track and the weaker BM25 dilutes it. The per-type view shows why a single static weight can't
win.

<figure>
  <img src="/assets/dante-retrieval-reality-gap/fig_fusion.png" alt="Grouped bars on Inferno canto 1: dense vs static RRF vs query-aware RRF across R@1, R@5, MRR@10. Static RRF collapses on R@1 (0.79); query-aware returns to dense and slightly exceeds it on R@5/MRR.">
  <figcaption>Static RRF collapses because it injects BM25 noise on English queries; query-aware RRF, which weights BM25 to zero on English queries, recovers it.</figcaption>
</figure>

The fix is query-aware fusion: detect the query language and set BM25's weight to zero on English queries, where its
Italian-only index is just noise, and high on Italian ones. On the cross-canto set fusion
beats dense on R@5 and MRR. For details on the language detection algorithm currently used and its weakness, see par. **Methodological Weaknesses**.

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

The same wall shows up from the upstream side. I tried two independent ways to feed the reranker a better candidate set
for its hardest slice — character-name queries: indexing the **English** character name into BM25 (today it carries only
the Italian one), and **relaxing** the query-aware rule that zeros BM25 on English queries. Both net to zero on the real
set — reranked Recall@1 stays at 0.51 and the name-query slices are unchanged — and relaxing the fusion rule actually
*hurts* the pre-rerank candidate set (English-paraphrase R@1 0.42 → 0.35, the BM25-on-English noise the rule was there to
suppress). The reranker reads `(query, original verse + translations)` and never sees the entity context that would tell
'Chiron' apart from the other centaurs, so better retrieval upstream cannot help when the component that makes the final
call is blind to the signal that separates the gold.

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

Before that, a few inexpensive improvements are still available:

- Align the text passed to the reranker with the representation that actually matched in the first stage (or add entity context for character queries)
- Late fusion: combine the reranker score with the original retrieval scores instead of pure reordering
- Replace the function-word/accent language heuristic (`fusion.py:detect_language`) with a more robust language/script detector, so query-aware fusion degrades gracefully on short, noisy, or mixed Anglo-Italian queries instead of mis-weighting BM25


## Methodological Weaknesses

Before closing, the acknowledgment of a series of methodological weaknesses and inconsistencies in 
the current evaluation framework to be addressed in subsequent work:

- **The primary "real-world" benchmark is very small (n=210)**: The noisy cross-canto set — the one that drops 
performance to 0.42, and 0.51 after reranking — has only 210 queries. Too little for anything productive. 
The per-type subgroups (keyword vs. semantic vs. entity) have even smaller cell sizes — the noisy-fragment and ambiguous cells 
hold only ~13 and ~10 queries — so a single query flipping moves those slices by ~8–10 points. 
No confidence intervals, bootstrap, or significance tests are reported; 
sampling variance alone could move the headline number by several points. 
The same caveat applies to the §4 entity-grounding figures: the "BM25 lifts name-query R@1 from 0.05 to 0.26" claim 
is computed on just 42 name queries (only 12 of them English).

- **Language Detection Assumption**: The query-aware fusion sets BM25's weight to zero on English queries based on a deliberately lightweight heuristic (`fusion.py:detect_language`) — a count of Italian vs English function words plus an Italian-accent signal, with an `und` (undetermined) fallback when the two are tied. This is brittle exactly where the real-world set is hardest: on short, heavily misspelled, or blended Anglo-Italian queries the function-word signal is thin, so the detector lands in `und` or picks the wrong branch. Measured directly on the 190 cross-canto queries whose type implies a language, it is correct only **68%** of the time — and just **46%** on Italian (38 of 78 Italian queries fall through to `und`), vs 84% on English. The mitigating detail is that the dominant failure mode is the *conservative* `und` fallback (which applies a moderate BM25 weight, 0.3), not confident mis-branching: only **4 of 190** queries (~2%) are weighted toward the wrong language. So the query-aware gains on R@5/MRR are real rather than an artifact, but smaller than a correct detector would yield — many Italian queries get the `und` weight instead of the intended high BM25 weight. A more robust language/script detector is on the to-do list (see *What's next*).

- **Heavy reliance on synthetic queries, with limited validity**: Every eval query is machine-generated — agent 
prompt + gating, and the cross-canto set by Grok (model "Grok Build") — then passed through a decontamination audit 
(no query is an exact match or substring of its indexed target). The audit rules out trivial leakage, 
but it does not guarantee the queries *look like real ones*. LLM-written queries tend to be cleaner and more 
grammatical than how people actually half-remember verses: severe misspellings, distant memories blended across episodes,
non-native paraphrases, translation and cultural artifacts. So performance on this set may be optimistic. 
No human-curated validation set, and no comparison against real query logs, is available to check that the synthetic 
distribution matches real users. And the generation pipeline itself is under-specified for reproduction: the exact prompts, 
sampling temperature, gating criteria, and the precise decontamination rules are not described in the post nor linked to the ML 
journal — and since *every* eval query is synthetic, that is a material reproducibility gap, not only a validity one.

- **Handling of Thematic Ambiguity**: The system categorizes only 10 out of 210 queries as "ambiguous (multi-gold)". Given the nature of thematic searches (e.g., "I felt lost"), there are likely many more valid matching tercets across the poem than a single designated gold standard, potentially making the Recall@1 metric an overly harsh penalty for semantic searches.

- **No qualitative error analysis**: The argument is entirely quantitative — there are no concrete failure examples (a query where BM25 wins and dense loses or vice versa; the thematically-similar tercet that outranks the gold in the reranker; the effect of an entity context on a specific name query). This weakens the "reranking is the bottleneck" diagnosis and leaves the planned fine-tuning without a catalogue of the confusions it is supposed to target.

- **Inferno only**: Every benchmark is drawn from *Inferno*. *Purgatorio* and *Paradiso* differ in vocabulary, fame distribution, and thematic density, so none of these numbers — including the headline 0.51 — can be assumed to carry over to the full *Commedia*.

- **Small deltas reported without significance testing**: Several conclusions rest on differences that, at n≈50 per single-canto set, are within sampling noise — e.g. the Italian-paraphrase ablation (mean R@1 +0.006, mixed in sign across cantos) and some per-canto gaps. They are read directionally, but nothing rules out that they are noise. More broadly, none of the headline numbers (0.42, 0.51, the fusion R@5/MRR gains, the entity net-zero) carry confidence intervals, and the bar charts have no error bars or uncertainty bands — so "negligible", "plateau", and "no improvement" are read visually rather than tested.

- **Under-specified reranker comparison**: The "a bigger generic reranker doesn't help" claim spans "three off-the-shelf cross-encoders (120M–568M)", but the post does not name all of them, nor say whether they were instruction-tuned or how tercet-length inputs were truncated — details that matter for reproducing the plateau.

- **`t.dante` provenance not specified**: The original-Italian text source (`t.dante`) is never pinned down — which edition, what digital provenance, and what spelling/punctuation normalization was applied. Since indexing it was the single largest dense gain, this is a reproducibility gap.

- **"Reranking is the bottleneck" understates a second ceiling**: calling reranking *the* bottleneck is fair for the immediate lever (recall@50 0.74 vs reranked R@1 0.51), but it obscures a second gap — initial retrieval already fails to bring the gold into the top-50 for 26% of queries. Even a perfect reranker caps the system at 0.74 on this set; closing the recall ceiling is a separate, later problem, not subsumed by fine-tuning the reranker.

- **Memorization mechanism not fully isolated**: the canto-1 ablation shows two signals (an exact-verse premium and a cross-lingual fame gap), but neither cleanly proves *memorization* over the simpler alternative that canto 1 has cleaner, more abundant English translations and easier lexical structure. The English-only fame gap (0.79 vs 0.67) is exactly what better translations would also produce; the memorization-specific signal is the exact-verse premium, whose 95% CI just touches zero. The reading leans on the *combination* of the two signals, not on a decisive test.

- **Apparent tension in the entity-context recommendation**: §4 shows that adding entity context to the *index* nets to zero through the pipeline, yet *What's next* lists "add entity context for character queries" as an inexpensive improvement. These are not contradictory — the latter means feeding the entity text to the *reranker* (which currently reads only verse + translations and is blind to it), not re-indexing it — but the wording does not make the distinction explicit.

- **Italian-paraphrase crowding not traced downstream**: §3 notes that Italian paraphrases slightly hurt R@5 on two cantos because near-duplicates crowd the top results, but treats the paraphrase only as *redundant*, not as potentially *harmful*. Whether that crowding dilutes the top-50 candidate pool that feeds the reranker is not measured.

- **The 0.92 → 0.42 drop conflates three effects, not just query realism**: the framing attributes the fall "mainly" to a more realistic test set, but three factors move together — (i) the famous/memorized canto 1 vs average cantos (0.92 → ~0.71, single-canto), (ii) the search space growing from ~46 candidates (single-canto) to ~1,596 (whole Inferno), and (iii) cleaner dev-style queries vs noisy cross-canto ones. Factor (ii) alone is a large difficulty increase unrelated to query realism. A clean decomposition — e.g. the same noisy queries evaluated with an oracle canto restriction (single-canto mode) — is not reported, so the realism and search-space contributions are not separated.

- **Possible circularity in query-type and difficulty labels**: the query-mix and difficulty splits (94 hard / 87 medium / 29 easy; the keyword/semantic/entity proportions) drive several per-slice conclusions, but the labels' provenance is not stated. If the same LLM that generated the queries also classified them, the strata are not independent of the generator and the per-type readings inherit that bias.

- **"The embedding model is not the limiter" rests on the final number only**: the claim is inferred from BGE-M3 giving the same post-rerank R@1 as e5-large. It would be more conclusive with the intermediate evidence — whether BGE-M3 changed recall@50 or the RRF metrics. If recall@50 stayed flat the claim is solid; if it improved but the reranker did not capitalize, the diagnosis points at the reranker even more strongly. That pre-rerank comparison is not reported.

- **Reproducibility specifics are thin beyond the reranker comparison**: exact model identifiers / Hugging Face paths (for `multilingual-e5-large`, BGE-M3, `mmarco-mMiniLM` and the three larger cross-encoders), the BM25 analyzer configuration (in particular the character-5-gram component), the precise query-aware RRF weights (the post says BM25 is weighted "high" on Italian queries without giving the value), and the reranker input formatting (how verse + translations are concatenated and truncated) are not pinned down — so the pipeline cannot be reproduced end-to-end from the post alone.

- **Minor numeric inconsistency on the canto-1 Italian-paraphrase step**: §2 reports the gain as 0.79 → 0.87, while the memorization-ablation table (§3) shows 0.79 → 0.86 for the same step. The two come from different runs/configs (the development sequence vs the rigorous ablation) and the ~0.01 gap is within run-to-run variation, but the figures should be reconciled or the difference noted.

**Note — entity contexts.** The per-character descriptive contexts were not hand-written. They were extracted by parsing
the English Wikipedia [List of cultural references in the Divine Comedy](https://en.wikipedia.org/wiki/List_of_cultural_references_in_the_Divine_Comedy),
then mapping each name to its Italian form via the Italian Wikipedia character categories — e.g.
[Personaggi citati nella Divina Commedia (Inferno)](https://it.wikipedia.org/wiki/Categoria:Personaggi_citati_nella_Divina_Commedia_%28Inferno%29).

*This is a working draft from an ongoing project; numbers and figures are reproducible from the project's versioned ML
journal.*
