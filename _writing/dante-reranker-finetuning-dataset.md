---
layout: article
title: "Generating Synthetic Training Data for Verse Retrieval"
subtitle: "DeepSeek generates the queries, Claude judges the fidelity"
description: I built a synthetic data pipeline to fine-tune a verse retrieval reranker. DeepSeek generates realistic user queries, and Claude filters out the hallucinations and ambiguous matches.
summary: I needed a dataset of (query, gold tercet) pairs to fine-tune a verse retrieval reranker. I built a two-step pipeline using an LLM to generate queries and a second LLM to filter them. I used DeepSeek-V4-Pro to generate queries because its generations sounded more realistic in the simulation of human users. I used Claude Sonnet as a judge to score the fidelity of the generated queries, rejecting ambiguous or off-by-one matches.
date: 2026-07-18
tags: [synthetic data, LLM judge, reranking, Divine Comedy]
published: true
permalink: /writing/dante-reranker-finetuning-dataset/
---

This article is part of my ongoing work on *DanteGPT*, a semantic search system for Dante's *Divine Comedy*. As established in my [previous evaluation of the reality gap](/writing/dante-retrieval-reality-gap/), the main bottleneck in the retrieval pipeline is the reranker, and targeted fine-tuning is the next required step.

To fine-tune the reranker, I needed a dataset of `(query, gold tercet)` pairs. Manually writing thousands of queries is slow, so I built a synthetic data pipeline to generate the dataset using an LLM to write the queries and a second LLM to filter the outputs.

```
corpus + glosses ──► query generator ──► raw pairs ──► fidelity judge ──► promoted ──► reranker training
                     (DeepSeek)          (anchored     (Claude,          rejected ──► discard / analysis
                                          rows)         score 0/1/2)
```

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## Generating the queries

Every generated query is anchored to one specific tercet. The generator receives a context chunk (original verses or modern summaries) and writes a query targeting a single tercet within that context. To prevent data leakage, I filter out all tercets present in the evaluation dataset before sampling candidates for the generator.

The dataset mix is defined by a taxonomy of 13 query types. Just under half the dataset covers standard retrieval targets like exact matches and paraphrases. The rest models messy user inputs. A user might search for a character's spoken dialogue, or they might query a misremembered quote.

| Query type | Context given to the generator | Lang | Weight | What it models |
|---|---|---|---|---|
| `exact_italian_fragment` | original tercets | it | 1 | a phrase lifted, or slightly misremembered, from the archaic Italian |
| `english_translation_fragment` | original tercets | en | 1 | a fragment of the English translation |
| `modern_italian_paraphrase` | modern summaries | it | 1 | colloquial Italian describing what happens in the tercet |
| `english_semantic_paraphrase` | modern summaries | en | 1 | modern English describing the scene |
| `thematic_emotional` | Wikipedia sections | it/en | 1 | a feeling or metaphor the tercet carries, no proper names allowed |
| `thematic_philosophical` | Wikipedia sections | it/en | 1 | a theological or philosophical concept, no proper names allowed |
| `entity_it_name` | entity context | it | 1 | a lookup by the character's Italian name |
| `entity_en_name` | entity context | en | 1 | a lookup by the character's English name |
| `entity_it_descriptor` | entity context | it | 1 | a periphrasis describing the character without naming them |
| `scene_recall_it` | original tercets | it | 3 | elliptical recall of a scene ("Virgilio spinge Dante verso Farinata") |
| `character_line_it` | original tercets | it | 3 | a character's line rendered as modern direct speech, no attribution |
| `misremembered_quote_it` | original tercets | it | 3 | a half-remembered quote with one word swapped or dropped |
| `knowledge_required_it` | Wikipedia sections | it | 3 | a query only answerable with the gloss: it names something the verse does not say |

The four user-style types at the bottom of the table are the messy side of the mix: each carries triple weight, so they take 12 of the 21 total weight units, about 57% of the dataset. The type counts are stratified targets, not sampling probabilities: when a context turns out unusable, the row is redrawn within its own type instead of shifting mass to the others.

I control the register by sampling one of three user personas:

| Persona | Register |
|---|---|
| `reader_recalling_from_memory` | plain evocative recall, may be just a noun phrase |
| `terse_note_taker` | telegraphic, drops articles and verbs |
| `informal_student` | casual modern wording, simple words |

The persona modulates the tone and vocabulary without altering the target content. I tried theatrical personas in early iterations, but they produced out-of-distribution framing and filler text. A separate difficulty dimension (easy, medium, hard) controls how oblique the reference to the tercet is.

DeepSeek-V4-Pro generated the best queries. It has the Divine Comedy memorized, which helps it generate plausible misremembered quotes because it knows the text well enough to break it realistically. DeepSeek also produces queries that sound like an actual human user. I tried Claude Opus and Fable, and their outputs were technically correct but recognizably written by an AI assistant. They were too well-formed for the informal register I required.

## Filtering the noise

Writing a constraint in a prompt does not guarantee the model will follow it. Synthetic positives are noisy in ways the generator cannot identify. The most common failures are off-by-one errors, where the query references a detail found in the adjacent tercet, and generic queries that could match a dozen different verses.

I added a strict LLM judge to evaluate every generated pair. The judge receives the query and the gold tercet, then answers a single question: does this query uniquely recover this exact tercet?

The judge scores the pair on a three-point scale:
- 2: The query identifies the tercet uniquely.
- 1: The query is plausible but ambiguous. It matches the tercet, but could match many others.
- 0: The query mentions a detail the tercet does not contain.

I used Claude Sonnet as the judge. The assistant bias that made Claude a poor generator for realistic user queries made it a careful, effective discriminator. So DeepSeek generates and Claude filters.

## Promoting the dataset

I promote rows with a score of 2 to the training set. Everything else is rejected.

The rejection pile captures mismatches and the ambiguous score-1 matches. A score of 1 isn't wrong, just weak. Feeding weak positives to a reranker teaches it to reward generic matches, which degrades the final retrieval performance.

The rejection pile is dominated by off-by-one errors and incorrect speaker attributions. Entity lookups also fail frequently if the query uses a name that appears in multiple cantos. The strict filter keeps the training set restricted to queries the judge could tie to a single tercet.

Here is the exact breakdown of the final judged queries. It perfectly illustrates the "ambiguity" penalty (Score 1) hitting the entity lookups the hardest:

| Query type | Score 2 (Promoted) | Score 1 (Ambiguous) | Score 0 (Mismatch) | Total |
|---|---|---|---|---|
| `misremembered_quote_it` | 528 | 11 | 0 | 539 |
| `character_line_it` | 520 | 22 | 0 | 542 |
| `scene_recall_it` | 478 | 35 | 4 | 517 |
| `knowledge_required_it` | 450 | 69 | 16 | 535 |
| `english_translation_fragment` | 180 | 4 | 0 | 184 |
| `exact_italian_fragment` | 175 | 7 | 0 | 182 |
| `modern_italian_paraphrase` | 164 | 14 | 3 | 181 |
| `english_semantic_paraphrase` | 162 | 16 | 4 | 182 |
| `entity_it_descriptor` | 124 | 25 | 27 | 176 |
| `thematic_philosophical` | 122 | 17 | 4 | 143 |
| `entity_en_name` | 114 | 43 | 6 | 163 |
| `thematic_emotional` | 111 | 26 | 6 | 143 |
| `entity_it_name` | 94 | 51 | 11 | 156 |
| **Total** | **3,222** | **340** | **81** | **3,643** |

## The first four runs

I have run the pipeline four times so far: three DeepSeek runs (seeds 7, 8 and 9) and one Llama run (seed 22) as a comparison generator. All tables below report promotion rate, the share of rows the judge scored 2.

Promotion rate by query type:

| Query type | DS s7 | Llama s22 | DS s8 | DS s9 |
|---|---|---|---|---|
| `english_translation_fragment` | 100% | 95% | 96% | 100% |
| `misremembered_quote_it` | 99% | 94% | 100% | 98% |
| `character_line_it` | 96% | 92% | 99% | 96% |
| `exact_italian_fragment` | 96% | 97% | 98% | 94% |
| `scene_recall_it` | 96% | 82% | 95% | 95% |
| `english_semantic_paraphrase` | 98% | 72% | 87% | 96% |
| `modern_italian_paraphrase` | 92% | 81% | 92% | 96% |
| `knowledge_required_it` | 85% | 73% | 92% | 86% |
| `thematic_philosophical` | 86% | 67% | 97% | 90% |
| `thematic_emotional` | 86% | 50% | 91% | 83% |
| `entity_it_descriptor` | 77% | 51% | 76% | 76% |
| `entity_en_name` | 66% | **82%** | 64% | 71% |
| `entity_it_name` | 52% | **65%** | 56% | 74% |

Two patterns. The quotational and scene types are near-perfect for DeepSeek, which is where having the text memorized pays off, while Llama's losses concentrate on the thematic types and the paraphrases. The result I did not expect is at the bottom: on name lookups Llama beats DeepSeek. It is less imaginative, and a bare name is something it gets right more often.

Promotion rate by cantica and by difficulty:

| | DS s7 | Llama s22 | DS s8 | DS s9 |
|---|---|---|---|---|
| Inferno | 89% | 80% | 91% | 90% |
| Purgatorio | 92% | 78% | 90% | 91% |
| Paradiso | 88% | 83% | 92% | 93% |
| easy | 91% | 77% | 92% | 90% |
| medium | 90% | 81% | 89% | 92% |
| hard | 88% | 82% | 92% | 92% |

No cantica bias. Hard queries promote at the same rate as easy ones, which surprised me at first but is the healthy outcome: difficulty makes the reference oblique, not wrong. For Llama the easy bucket is actually the worst one, because its easy queries lean on bare names and those read as ambiguous.

Promotion rate by persona and query language:

| | DS s7 | Llama s22 | DS s8 | DS s9 |
|---|---|---|---|---|
| `reader_recalling_from_memory` | 88% | 80% | 91% | 92% |
| `informal_student` | 91% | 82% | 93% | 91% |
| `terse_note_taker` | 91% | 79% | 90% | 90% |
| query in Italian | 90% | 81% | 93% | 92% |
| query in English | 87% | 78% | 85% | 90% |

The three personas are statistically indistinguishable, which confirms they modulate the register without touching the content.

Average query length, in words:

| | DS s7 | Llama s22 | DS s8 | DS s9 |
|---|---|---|---|---|
| all queries | 10.5 | **5.6** | 10.6 | 10.9 |

Llama writes queries half as long as DeepSeek, and this is probably the main cause of its lower yield: fewer words leave the judge less disambiguating signal.

Anchor coverage (unique tercets) and breakage by context source:

| Run | Unique anchors | Of which new | Worst score-0 rate by source |
|---|---|---|---|
| DS s7 | 817 | 817 | entity_context 6.5% |
| Llama s22 | 685 | 518 | entity_context 8.5% |
| DS s8 | 801 | 484 | entity_context 11.7% |
| DS s9 | 644 | 644 (coverage-aware sampling) | entity_context 8.7% |
| **cumulative** | **2,463 / 4,811 (51%)** | | dante_original ~0.3% everywhere |

The seed 9 run sampled its anchors coverage-aware, restricting the draw to tercets no earlier run had used, which is why all of its 644 anchors are new. The broken pairs come almost entirely from the indirect sources, entity context and Wikipedia glosses. When the context is Dante's own text the breakage rate is near zero. This matches the off-by-one diagnosis: the error appears when the generator has to anchor a multi-tercet gloss to a single tercet.

Coverage of cantos across the final promoted datasets (unique cantos covered per query type):

| Query type | Inferno (34) | Purgatorio (33) | Paradiso (33) | Total (100) |
|---|---|---|---|---|
| `exact_italian_fragment` | 29 | 25 | 22 | 76 |
| `english_translation_fragment` | 28 | 26 | 28 | 82 |
| `modern_italian_paraphrase` | 29 | 25 | 29 | 83 |
| `english_semantic_paraphrase` | 25 | 20 | 29 | 74 |
| `thematic_emotional` | 22 | 24 | 21 | 67 |
| `thematic_philosophical` | 25 | 24 | 19 | 68 |
| `entity_it_name` | 19 | 26 | 9 | 54 |
| `entity_en_name` | 20 | 24 | 6 | 50 |
| `entity_it_descriptor` | 24 | 22 | 10 | 56 |
| `scene_recall_it` | 33 | 33 | 32 | 98 |
| `character_line_it` | 33 | 32 | 32 | 97 |
| `misremembered_quote_it` | 34 | 33 | 33 | 100 |
| `knowledge_required_it` | 33 | 32 | 31 | 96 |
| **Overall** | **34** | **33** | **33** | **100** |

## Next steps

With the positive `(query, gold tercet)` pairs generated and filtered, the final step before fine-tuning is preparing the negative pairs. 

I plan to generate hard negatives using `sentence_transformers.util.hard_negatives.mine_hard_negatives` ([docs](https://sbert.net/docs/package_reference/util/hard_negatives.html#sentence_transformers.util.hard_negatives.mine_hard_negatives)) and supplement them with soft negatives via random selection. 

This is a robust, standard approach for cross-encoder training:
- **Hard negatives** force the reranker to learn fine-grained distinctions. This is critical for our pipeline, as the initial retrieval stage surfaces a candidate pool filled with thematically similar but incorrect tercets. Mining these highly similar mismatches ensures the reranker focuses on the precise details that differentiate the gold tercet.
- **Soft (random) negatives** ensure the model doesn't overfit to only the edge cases, maintaining a proper score distribution that handles easy mismatches effectively.

Given Dante's structure, adjacent "off-by-one" tercets are very likely to be surfaced as hard negatives. Because the Claude judge explicitly filtered out queries that were ambiguous or prone to off-by-one errors during the positive generation phase, the reranker should have a clean, precise signal to learn from without being penalized by false negatives.
