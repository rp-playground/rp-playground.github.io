# Semantic Search in Dante's Divine Comedy — Solution Design

> **Status:** Draft · **Version:** 0.16 · **Last updated:** 2026-06-28

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.16 | 2026-06-28 | Executive summary: key design decisions added to make it self-contained as a standalone one-pager; §3.4: concrete example prompt (system/user format + JSON output schema) added to make Phase 2 immediately executable; Risk Register: annotation-effort row rewritten to lead with explicit pilot recommendation sentence |
| 0.15 | 2026-06-28 | Executive summary added; §2 licensing note added for canonical translations; §3.1 second-highest representation score surfaced in metadata; §3.4 LLM implementation details added (model, temperature, few-shot, structured output, cost/latency); §6.5 staged annotation pilot (30–40 queries) added before full 100-query annotation; LoRA/QLoFA added to §8 infrastructure and Phase 1a; §12 Risk Register added; §12 Connections → §13; §13 Future Work relabeled and renumbered to §14 |
| 0.14 | 2026-06-28 | Four targeted improvements: modern Italian paraphrase generation spec tightened (Phase 0: stronger LLM + few-shot from Hollander, stratified spot-check); CoT prompting strategy added to §3.4 query expansion; UMAP moved from Phase 3 to Phase 1a as a diagnostic checkpoint; neighboring tercet display added to Phase 1b milestones |
| 0.13 | 2026-06-28 | Research-level extensions section added (§13): translation variance as confidence signal, ColBERT-style multi-vector retrieval, interpretability layer; §3 Architecture intro tightened to remove repeated Italian-exclusion rationale; simplified pipeline flow added; §7 phasing intro added; §11 Open Questions restructured to separate open from closed items |
| 0.12 | 2026-06-28 | Known failure modes section added (§10): abstract thematic queries, multi-tercet concepts, irony/rhetorical inversion, character relational queries; index composition risk added (§5.4): paraphrase dominance in embedding space, detection procedure, and mitigations |
| 0.11 | 2026-06-28 | Training data redesigned: cross-translation pairs made explicit as hard positives; negative mining restructured into three tiers with adjacent-tercet structural negatives as Tier 1; pair counts updated |
| 0.10 | 2026-06-28 | Query reformulation evaluation added: logging spec, retrieval delta measurement, per-query-type reporting, and fine-tuning path documented |
| 0.9 | 2026-06-28 | Fusion strategy updated: static RRF replaced with query-aware weighted RRF; language detection tier and score-based dynamic tier specified; ablation updated |
| 0.8 | 2026-06-28 | Query distribution model added: assumed prior over query types with component weighting implications; evaluation set composition updated to mirror distribution |
| 0.7 | 2026-06-28 | Evaluation section restructured: separate protocols for verse recall and thematic search; Recall@5 added; human annotation protocol specified as mandatory for thematic search with relevance scale, annotator requirements, and inter-annotator agreement threshold |
| 0.6 | 2026-06-28 | Resolved three open questions: modern Italian paraphrases added to FAISS index; max pooling confirmed for deduplication; commentaries kept as metadata only. Index size updated to ~24K documents; dataset structure, positive pairs, Phase 0 milestones, and infrastructure table updated. |
| 0.5 | 2026-06-28 | Cross-encoder input specified: highest-scoring bi-encoder representation per tercet; asymmetric reranking rationale documented |
| 0.4 | 2026-06-28 | BM25 tokenization specified: no stemmer; word unigrams + character 5-grams for robustness to archaic spelling variants and user misremembering |
| 0.3 | 2026-06-28 | Retrieval architecture changed: original Italian is a display target (lookup), not a retrieval corpus; FAISS index holds translations and paraphrases only; BM25 repurposed as Italian-language lexical track; dataset, infrastructure, and design decisions updated |
| 0.2 | 2026-06-28 | Retrieval unit changed from verse to tercet; corpus size updated; dataset structure, evaluation counts, and open questions updated accordingly |
| 0.1 | 2026-06-28 | Initial draft — project framing, architecture, dataset strategy, phasing |

---

## Executive Summary

**Problem:** The Divine Comedy has no usable semantic search tool. Keyword search fails across languages and across the centuries of paraphrase that separate a modern reader from the text. This project builds a retrieval system answering two distinct query classes: *verse recall* (return the matching tercet for a text fragment) and *thematic search* (surface semantically relevant passages for a modern concept or feeling).

**Architecture:** Two-stage pipeline — bi-encoder (FAISS dense retrieval over modern-language translations and paraphrases) + BM25 (original Italian, lexical track) fused via query-aware weighted RRF, reranked by a multilingual cross-encoder. The original Italian is a display target, not a retrieval corpus. Phase 2 adds LLM query expansion with chain-of-thought prompting for thematic queries. The entire pipeline is instrumented with an observability platform (Phoenix or Langfuse) for trace collection and error analysis.

```
Query → [Dense (FAISS) + BM25] → Fusion (RRF) → Dedup (max pool) → Cross-encoder → Lookup → Display
```

**Key metric targets:**

| Task | Primary metric | Target |
|------|---------------|--------|
| Verse recall (Phase 1) | Recall@1 | > 0.85 |
| Verse recall (Phase 1) | MRR@10 | > 0.88 |
| Thematic search (Phase 2) | nDCG@10 | > 0.70 |

**Phase deliverables:**

| Phase | Deliverable |
|-------|-------------|
| 0 — Corpus & Baseline | Aligned tercet corpus, BM25 + zero-shot bi-encoder baseline, evaluation harness |
| 1a — Fine-Tuned Bi-Encoder | Fine-tuned checkpoint, UMAP diagnostic, ablation table |
| 1b — Hybrid + Reranker | Full retrieval pipeline, latency report |
| 2 — Thematic Search | Thematic evaluation set, LLM expansion pipeline, delta distribution report |
| 3 — Visualization & Demo | UMAP extended analysis, calibration plots, public HF Space |

**Key design decisions (rationale in §9):**

- Index translations and modern paraphrases — not original medieval Italian — so retrieval operates in a semantic space the model was trained on. Original Italian is the display target, recovered via lookup.
- Retrieval unit: **tercet** (3 lines). Verse-level alignment across translations is unreliable; semantic closure falls at the terzina unit.
- Query-aware BM25 weighting: BM25 over archaic Italian is useful for ~14% of queries (Italian fragments); query-aware `w_BM25` suppresses it for all others rather than blending noise.
- Hard positives from cross-translation pairs: C(5,2) = 10 pairs × 4,740 tercets = 47,400 positive training pairs, zero annotation cost.
- LoRA/QLoRA first: 100× fewer trainable parameters, 3–5× faster iteration; switch to full fine-tuning only if LoRA plateaus.

---

## 1. Problem Statement

The Divine Comedy (~14,200 lines, composed 1308–1320) is one of the most commented and translated texts in the Western literary canon. Canonical English translations alone number over a dozen (Longfellow 1867, Mandelbaum 1980, Hollander 2000, …), each making distinct linguistic and interpretive choices. This layering — original medieval Italian plus centuries of translation variance — makes conventional keyword search nearly useless across languages and completely useless across semantic distance.

**The goal:** build a retrieval system that answers two classes of query:

1. **Verse recall** — a user provides a text fragment, in any language or paraphrase, and the system returns the matching passage with high precision. Example: "a metà della vita" → Inferno I:1–3. The retrieval unit is the **tercet** (terzina): three lines forming the ABA rhyme unit, the natural semantic closure of the poem. A user query may be a fragment of a single verse; the system returns the containing tercet.
2. **Thematic search** — a user expresses a modern feeling or concept, and the system surfaces semantically relevant passages regardless of surface form. Example: "I was 35 and felt lost" → passages on Dante's midlife journey.

These are distinct retrieval tasks with different evaluation criteria and different model requirements.

---

## 2. Scope and Constraints

| Item | Decision |
|------|----------|
| Corpus | Divine Comedy only (all three Canticles) |
| Languages | Italian (original) + English (3–4 canonical translations) |
| Corpus size | ~4,740 tercets (~14,200 lines); fixed and fully known |
| Inference target | Low-latency interactive search (< 300 ms p95) |
| Training budget | Consumer GPU (single A100 or equivalent) |
| Serving | Hugging Face Space (public demo) |
| **Translation licensing** | Longfellow (1867) — public domain. Mandelbaum (1980) and Hollander (2000) are under copyright; their use in a public demo requires explicit permission or a fair-use assessment. Training on these texts for research purposes may qualify as fair use, but serving them publicly does not. **Action item before Phase 3:** confirm licensing or substitute with public-domain translations (e.g. Norton 1892, Cary 1814) for the demo corpus. |

The bounded, exhaustive nature of the corpus is a design asset: ground truth can be constructed completely, and the index fits comfortably in memory.

---

## 3. Architecture Overview

The system uses a **two-stage retrieval pipeline** — the current best practice for dense retrieval. The original Italian is not indexed; it is the displayed result, recovered via lookup after retrieval. Full rationale for this design choice is in §9.

**Pipeline (simplified):**
```
Query → [Dense (FAISS) + BM25] → Fusion (RRF) → Dedup (max pool) → Cross-encoder → Lookup → Display
```

**Full flow (with Phase 2 branch):**
```
User query
    │
    ├─────────────────────────────────────────────────────────┐
    ▼                                                         ▼
[Phase 2 only] Query Expansion (LLM)                  BM25 index
    │                                          (original Italian —
    ▼                                           lexical track for
Bi-encoder embedding                            Italian queries)
    │                                                         │
    ▼                                                         │
FAISS index                                                   │
(translations + paraphrases only)                             │
    │                                                         │
    └──────────────── Reciprocal Rank Fusion ─────────────────┘
                               │
                               ▼
              Top-K tercet IDs, deduplicated across representations
                               │
                               ▼
                    Cross-encoder reranker
                               │
                               ▼
                    Ranked tercet IDs (with scores)
                               │
                               ▼
              Lookup table: tercet_id → original Italian tercet
                               │
                               ▼
              Display: original Italian + all translations side by side
                       + commentaries (from metadata store, keyed on tercet_id)
```

### 3.1 Bi-Encoder (Dense Retrieval)

Encodes query and passages independently into a shared embedding space. At search time, retrieval is a cosine similarity lookup over the FAISS index. The bi-encoder is the component that will be **fine-tuned** on the parallel corpus.

**Index contents:** English translations (×3), English modern paraphrases, and modern Italian paraphrases. Each document carries a `tercet_id` pointing back to the original. Multiple documents share the same `tercet_id`, so results are deduplicated by `tercet_id` before reranking — the **highest-scoring representation per tercet is kept (max pooling)**. Average pooling is explicitly rejected: a query quoting a Longfellow fragment will score high against Longfellow but low against Mandelbaum's poetic rendering; averaging would penalise a correct match. The indexed corpus is ~24K documents (4,740 tercets × 5 representations), still trivially small for FAISS. Commentaries are **not** indexed — they are stored as a separate metadata file keyed on `tercet_id` and surfaced at display time only.

**Representation metadata for scholarly users:** alongside the max-pooled score, store the **second-highest representation score and its representation type** in the result metadata. The gap between the top-1 and top-2 scores is a proxy for match confidence: a large gap means the query aligned strongly with one specific translation; a small gap means the content is consistent across representations (a more robust match). This feeds directly into §14.1 (Translation Variance as Confidence Signal, §14) and is available at zero extra inference cost from the deduplication step.

**Base model:** `intfloat/multilingual-e5-large` or `BAAI/bge-m3`

Rationale: both are state-of-the-art multilingual dense retrieval models trained on large-scale cross-lingual data. Because the index holds modern-language representations only, the model no longer needs to handle archaic Florentine tokenization — a meaningful simplification of the embedding task. BGE-M3 additionally supports hybrid dense/sparse retrieval natively. Zero-shot performance will be evaluated before fine-tuning to establish a baseline delta.

### 3.2 BM25 (Lexical Retrieval — Original Italian track)

BM25 runs over the **original Italian tercets** and serves a specific, narrow role: handling user queries that contain Italian fragments from memory (e.g., "selva oscura", "mi ritrovai"). The dense FAISS index holds only modern-language representations and would not reliably retrieve these via semantic similarity. BM25 over the original handles lexical match directly, without requiring the model to understand archaic vocabulary.

**Tokenization — no stemmer; word unigrams + character 5-grams:**

Standard Italian stemmers (Snowball and equivalents) assume modern grammatical rules. Medieval Florentine has different conjugation patterns, heavy clitic attachment, and orthographic variants (e.g., *diritta* vs. *dritta*, pronoun-clitic compounds like *ritrovami*) that a modern stemmer handles incorrectly or fails to normalise. Applying Snowball here is worse than not stemming at all.

The tokenization strategy is instead:

- **Word unigrams** (lowercase, alphanumeric only): provide exact-match signal for the majority of queries where the user remembers the word correctly. Rare archaic words like *selva*, *oscura*, *ritrovai* have high IDF and dominate the score when they match exactly.
- **Character 5-grams**: index each word's character substrings of length 5 as supplementary tokens. This makes the index robust to suffix variation, spelling variants, and partial recall — "ritro" bridges *ritrovai* and any misremembered form that shares a root; "diritt" bridges *diritta* and *dritta*. Size 5 is the right tradeoff: long enough to avoid false positives on common substrings ("della", "della"), short enough to catch most archaic variants.

The two token types are combined in the same BM25 index. Exact word matches score higher (high IDF on rare archaic words); character n-gram matches provide softer signal when exact match fails. For English or modern Italian queries, the BM25 track produces near-zero scores and the dense track dominates — the correct behaviour.

Combined with the dense track via **query-aware weighted RRF**:

```
score(d) = 1/(k + rank_dense(d))  +  w_BM25(q) * 1/(k + rank_BM25(d))
```

where `k = 60` (standard) and `w_BM25(q)` is a **query-dependent weight** — not a static constant. Static RRF (`w_BM25 = 1.0` always) assumes both rankers are equally useful for every query. In this system they are not: BM25 over archaic Italian is valuable for Italian-fragment queries and actively harmful for English queries, where it ranks tercets by irrelevant surface noise.

**Tier 1 — language detection (implemented first):**

Use a lightweight language identification model (`fasttext lid.176.ftz`, 917 KB, <1 ms per query) to classify the query. Apply threshold P(Italian) ≥ 0.6:

| Detected language | w_BM25 | Rationale |
|-------------------|--------|-----------|
| Italian | 1.0 | BM25 is primary lexical signal; full weight |
| Non-Italian | 0.1 | Near-zero but not zero — preserves BM25 signal for Italian proper nouns (Francesca, Virgilio) embedded in English queries |

**Tier 2 — score-based dynamic weighting (refinement, no language detection required):**

Use the BM25 top-1 raw score as a proxy for whether BM25 found a meaningful lexical match. If `max_score_BM25(q) < θ`, the BM25 index has no good matches and should be downweighted automatically:

```
w_BM25(q) = 1.0  if max_score_BM25(q) >= θ
             0.1  otherwise
```

`θ` is calibrated on the development set. This eliminates the language detection dependency and generalises to query types not anticipated at design time (e.g. Latin fragments, proper-noun-heavy queries in other languages). Trade-off: requires score normalisation since raw BM25 scores vary by document length and index statistics.

Both tiers are evaluated in the ablation structure (§6.6).

### 3.3 Cross-Encoder (Reranker)

Takes (query, passage) pairs as joint input and produces a scalar relevance score. Slower than the bi-encoder (cannot pre-index) but significantly more accurate. Applied only to the top-K shortlist after deduplication.

**Input specification — asymmetric reranking:**

The cross-encoder receives one `(query, passage)` pair per candidate tercet. The passage is the **highest-scoring translation** that the bi-encoder retrieved for that tercet — i.e., the representation that survived deduplication. This is the correct choice for two reasons:

1. **Computational efficiency.** Each cross-encoder call is expensive (full attention over the concatenated pair). Passing all 3–4 translations per tercet would multiply calls by the number of representations with no guaranteed gain, since the highest-scoring bi-encoder result is already the best semantic match to the query.

2. **Semantic consistency.** The bi-encoder already selected the translation that is closest to the query in embedding space. Feeding the same representation to the cross-encoder maintains coherence between the two stages — the cross-encoder refines a ranking signal on the same evidence that drove retrieval, not on a different translation that may not align with the query's language or register.

The setup is inherently asymmetric: the query is short, user-generated, in modern language; the passage is a fixed canonical translation in literary English (or a modern paraphrase). The cross-encoder handles this asymmetry natively — it was pre-trained on (query, passage) pairs with the same structure.

**Base model:** `cross-encoder/mmarco-mMiniLMv2-L12-H384` (multilingual, efficient)

### 3.4 Query Expansion (Phase 2 only)

For thematic queries, a small LLM reformulates the user's query into terms closer to what the fine-tuned retriever expects. This is a thin agentic wrapper — not generative RAG — and does not replace the retrieval backbone.

**Design choice rationale:** agentic query expansion handles the semantic gap between modern vernacular ("avevo 35 anni") and the poem's conceptual vocabulary ("viaggio di mezzo cammino", midlife, exile). Fine-tuned embeddings handle tercet-level alignment. Neither alone is sufficient for Phase 2.

**Implementation details:**

| Parameter | Recommendation | Rationale |
|-----------|---------------|-----------|
| Model | GPT-4o or `claude-sonnet-4-6` (evaluation); GPT-4o-mini or equivalent (production) | Start with the strongest available model to establish ceiling; downgrade once prompting approach is validated |
| Temperature | 0.0 for evaluation runs; 0.3 for production | Deterministic output needed for repeatable delta measurement; slight diversity helps production |
| Prompting | Few-shot after zero-shot baseline | Start zero-shot to measure baseline quality; add few-shot examples from high-delta log entries once 20+ are available |
| Structured output | JSON schema enforcement (function calling / tool use) | Prevents hallucination of output format; ensures `reformulated_query` field is always a string |
| Cost estimate | ~$0.02–0.05 per query (GPT-4o) | At 30% of traffic being thematic queries, budget accordingly; cache reformulations for identical queries |
| Latency | 800ms–2s additional p95 | Exceeds the 300ms target — run expansion asynchronously or as a pre-fetch; Phase 2 profiling must measure end-to-end with expansion included |

**Prompting strategy — chain-of-thought before reformulation:**

Do not ask the LLM to produce the reformulation string directly. Instead, prompt it to reason in steps:

1. What Dantesque themes or concepts does this query map to?
2. Which characters, canticles, or episodes are most likely relevant?
3. What vocabulary was the retriever trained on (translations + modern paraphrases)?
4. Given the above — produce a reformulated query in that vocabulary.

CoT intermediate reasoning catches hallucination and overspecification before they propagate to the retrieval step: an LLM that has to commit to a Dantesque concept in step 1 is less likely to invent one in step 4. Log both the CoT trace and the final reformulation string. This prompting approach must be fully evaluated (via retrieval delta, §6.5) before considering the mT5 fine-tune path.

**Example prompt (zero-shot CoT, structured output):**

```
System:
You are a Dante scholar assisting a semantic retrieval system. Given a user query,
reason step by step about which Dantesque themes and vocabulary are relevant, then
produce a reformulated query suitable for retrieval over modern English translations
and Italian paraphrases of the Divine Comedy.

User:
Query: "avevo 35 anni e mi sentivo perso nella vita"

Reason through the following steps before producing output:
1. Dantesque themes/concepts: What does this query map to in Dante's world?
2. Characters/canticles/episodes: Which parts of the poem are most relevant?
3. Retriever vocabulary: What terms appear in the translations and modern paraphrases?
4. Reformulation: A concise query string in retriever vocabulary.

Respond in JSON:
{
  "step1_themes": "...",
  "step2_location": "...",
  "step3_vocabulary": "...",
  "reformulated_query": "..."
}
```

Expected output for the example query:
```json
{
  "step1_themes": "Midlife disorientation, spiritual crisis, loss of direction, Dante's journey at age 35",
  "step2_location": "Inferno I (Nel mezzo del cammin), the dark forest — Dante entering at midlife",
  "step3_vocabulary": "midway through life, lost path, dark wood, journey, age 35, selva oscura, smarrita",
  "reformulated_query": "midlife disorientation, lost in a dark forest, spiritual crisis, journey at age 35"
}
```

Start zero-shot; add few-shot examples once 20+ high-delta log entries are available (positive-delta pairs are the natural training signal). Enforce JSON schema via function calling / tool use — do not rely on free-form text parsing.

**Logging and Observability (via Phoenix/Langfuse):**

Every expansion call, retriever score, and cross-encoder score must be traced. The reformulation step is otherwise a black box: end-to-end nDCG@10 tells you whether the full pipeline worked, but not whether the LLM helped or hurt. Without comprehensive traces (using an open-source observability tool like Arize Phoenix or Langfuse), failure modes are invisible.

Minimum span attributes to capture per query:

```json
{
  "query_id": "...",
  "original_query": "avevo 35 anni e mi sentivo perso",
  "reformulated_query": "midlife disorientation, spiritual crisis, journey, age 35, dark forest",
  "nDCG10_without_expansion": 0.41,
  "nDCG10_with_expansion": 0.78,
  "retrieval_delta": +0.37,
  "top3_tercets_without": ["Inf.I.1", "Purg.XXX.1", "Par.I.1"],
  "top3_tercets_with":    ["Inf.I.1", "Inf.I.4", "Purg.XXX.1"],
  "query_type": "emotional"
}
```

`retrieval_delta = nDCG10_with - nDCG10_without` is the primary instrument for evaluating reformulation quality. It is computed query-by-query on the annotated thematic evaluation set, not just as a population mean. See §6.5 for the full measurement protocol.

---

## 4. Fine-Tuning vs. Agentic Layer

This is the central design decision. The answer differs by phase:

| Phase | Approach | Rationale |
|-------|----------|-----------|
| Phase 1 — verse recall | Fine-tune bi-encoder only | Pure retrieval task; no reasoning required; contrastive training on parallel corpus provides strong signal |
| Phase 2 — thematic search | Fine-tuned bi-encoder + LLM query expansion | Bridging modern vernacular to medieval concepts requires reasoning; retrieval backbone still needed for precision |

**What to avoid:** using a frontier LLM with the full text in context as a substitute for a retrieval system. This approach works but: (a) does not scale, (b) is opaque, (c) demonstrates prompt engineering rather than ML system design.

---

## 5. Dataset Strategy

The parallel corpus serves two distinct roles that must be kept separate:

| Role | Contents | Used for |
|------|----------|----------|
| **Retrieval corpus** | English translations (×3) + English paraphrases + modern Italian paraphrases | Indexed in FAISS; what the bi-encoder searches over |
| **Display corpus** | Original Italian | Returned to the user via lookup after retrieval; never searched directly |
| **Lexical corpus** | Original Italian | Indexed in BM25 separately for archaic Italian-fragment queries |
| **Metadata store** | Commentaries (e.g. Hollander's notes) | Stored as JSON keyed on `tercet_id`; displayed alongside results; never indexed |

The retrieval and alignment unit is the **tercet** — three lines sharing an ABA rhyme scheme. Verse-level alignment across translations is not reliable: translators shift line boundaries, expand or compress within the tercet, and the semantic closure consistently falls at the three-line unit, not the single line.

```
Tercet unit (terzina — 3 verses, ABA rhyme):
  ├── tercet_id: "Inf.I.1"
  │
  ├── [display / BM25 only] original_italian
  │     "Nel mezzo del cammin di nostra vita
  │      mi ritrovai per una selva oscura
  │      ché la diritta via era smarrita."
  │
  ├── [FAISS index] translation_longfellow
  │     "Midway upon the journey of our life
  │      I came within a forest dark,
  │      For the straightforward pathway had been lost."
  ├── [FAISS index] translation_mandelbaum
  │     "When I had journeyed half of our life's way,
  │      I found myself within a shadowed forest,
  │      for I had lost the path that does not stray."
  ├── [FAISS index] translation_hollander
  │     "Midway in the journey of our life
  │      I came to myself in a dark wood,
  │      for the straight way was lost."
  ├── [FAISS index] modern_paraphrase_english
  │     "I was halfway through my life and found myself lost in darkness."
  ├── [FAISS index] modern_paraphrase_italian
  │     "Ero a metà della mia vita e mi ritrovai perso in una foresta oscura."
  └── [metadata only] commentary
        "Nel mezzo: Dante places himself at age 35, midway through the biblical
         lifespan of 70 years (Psalms 89:10). The dark wood is the traditional
         symbol of sin and spiritual confusion. [Hollander, 2000]"
```

### 5.1 Positive Pairs

Training pairs have a query on the left and an indexed document (translation or paraphrase) on the right. The original Italian appears only on the query side — as a source of fragment queries — not as a retrieval target.

Positive pairs divide into two categories with different roles in training:

#### Standard positives

Query–document pairs where the query is a natural user input and the document is a retrieval target. These anchor the model to the actual retrieval task:

| Pair | Rationale |
|------|-----------|
| `(italian_fragment, translation_EN)` | Archaic fragment → English translation; trains cross-lingual alignment for Italian-fragment queries |
| `(modern_paraphrase_IT, translation_EN)` | Modern Italian query → English translation; cross-lingual alignment for domestic Italian traffic |
| `(modern_paraphrase_IT, modern_paraphrase_EN)` | Cross-lingual modern paraphrase pairs; ensures Italian queries can surface English paraphrase targets |
| `(modern_query, translation_EN)` | Thematic query → relevant tercet (Phase 2 training data) |

#### Hard positives (cross-representation pairs)

Any two representations of the **same tercet** form a hard positive pair: they are semantically equivalent (same source text, same meaning) but surface-divergent (different language, register, diction, syntax). Training on these pairs forces the model to learn content-level alignment independent of surface form — the core generalization property needed for thematic search.

This category includes cross-translation pairs (e.g., Longfellow ↔ Mandelbaum ↔ Hollander for the same tercet), translation ↔ paraphrase pairs, and cross-language paraphrase pairs (modern Italian ↔ English paraphrase). These are harder than standard positives because the two representations do not share obvious surface signals — the model cannot rely on lexical overlap, must rely entirely on semantic content.

**Scale with 5 representations per tercet** (3 English translations + 1 English paraphrase + 1 modern Italian paraphrase):

```
C(5, 2) = 10 cross-representation pairs per tercet
10 pairs × 4,740 tercets = 47,400 hard positive pairs
```

This is the largest positive pair category and requires zero manual annotation — all pairs are derived deterministically from the aligned corpus structure.

**Total positive pair budget (approximate):**

| Category | Source | Pairs |
|----------|--------|-------|
| Cross-representation hard positives | C(5,2) × 4,740 tercets | ~47,400 |
| Italian fragment → translation (standard) | 1 fragment × 3 translations × 4,740 | ~14,220 |
| Modern Italian → translation (standard) | 1 × 3 × 4,740 | ~14,220 |
| Thematic query → translation (Phase 2) | Manually created | ~1,000–2,000 |
| **Total** | | **~77K** (without Phase 2 manual) |

Cross-representation hard positives alone account for ~60% of the positive training signal and require no annotation effort.

### 5.2 Hard Negative Mining

Random negatives (any non-matching tercet) are easy to distinguish and produce embeddings with poor boundary precision. Hard negatives — passages that are close but factually wrong — are essential. Negative mining is structured into three tiers in order of cost: start cheap, add more expensive tiers if the model still fails on boundary cases.

#### Tier 1 — Structural negatives (adjacent tercets)

For each anchor tercet, adjacent tercets in the **same Canto** (positions ±1, ±2, ±3 from the anchor) are designated hard negatives without any model inference.

**Why these are hard:** Adjacent tercets share the same scene, characters, poetic register, and often the same lexical field. The narrative does not cut abruptly — Dante is still in the same forest, speaking to the same figures, continuing the same argument. A retriever that hasn't learned fine-grained semantic distinction will conflate adjacent tercets with high confidence.

**Why this tier comes first:** Structural negatives are **deterministic and free**. Given a `tercet_id` (e.g., `Inf.I.4`), the adjacent IDs (`Inf.I.1`, `Inf.I.7`) are computed from the corpus structure with no model inference, no scoring, no index lookup. The entire set of ~4,740 × 6 ≈ 28,000 structural negative pairs can be generated in milliseconds.

**Mining window:** ±1 tercet (immediate neighbors) is the hardest case; ±2 to ±3 adds softer structural negatives as the scene begins to shift. Use ±1 for the primary hard negative set; ±2–3 as supplementary negatives if training loss saturates.

#### Tier 2 — BM25-mined negatives (lexical overlap)

For each anchor document (a translation or paraphrase), run BM25 over the retrieval corpus and retrieve the top-50 results. Remove documents sharing the anchor's `tercet_id` (true positives). The remaining top-K (K = 5–10) are hard negatives.

**Why these are hard:** High BM25 score means high lexical overlap — the negative shares significant vocabulary with the anchor, but is a different tercet. For a model learning semantic similarity, these negatives require distinguishing passages that look similar on the surface but differ in meaning.

**Cost:** Requires a built BM25 index (available from Phase 0 baseline) but no model inference. Index once; mine once.

#### Tier 3 — Dense-mined negatives (semantic similarity)

For each anchor document, run the **frozen base model** over the FAISS index and retrieve the top-50 nearest neighbors by cosine similarity. Remove true positives (same `tercet_id`). The remaining top-K (K = 5–10) are hard negatives.

**Why these are hard:** Dense neighbors are semantically proximate — the model (even before fine-tuning) assigns them high similarity to the anchor. These are the failure cases of the zero-shot model: passages it cannot yet distinguish from the anchor. Training on these directly corrects the model's current worst errors.

**Cost:** Requires running model inference over the full index (~24K documents). Expensive relative to Tiers 1–2 but standard practice in state-of-the-art dense retrieval (DPR, BGE, E5). Run once per training iteration if iterative hard negative refresh is used.

#### Mining order and rationale

| Tier | Source | Inference required | Pairs per anchor | When to apply |
|------|--------|--------------------|-----------------|---------------|
| 1 — Structural | Adjacent tercets (±1 to ±3) | None | 2–6 | Always; first |
| 2 — BM25-mined | BM25 top-K after dedup | BM25 only | 5–10 | After Tier 1; cheap |
| 3 — Dense-mined | Dense top-K after dedup | Full model inference | 5–10 | After Tier 2; expensive |

Combine tiers: each training example gets Tier 1 negatives by default, supplemented by Tier 2 and Tier 3. If negatives from different tiers coincide (same `tercet_id`), deduplicate. The three-tier structure provides negatives at different levels of difficulty — structural (surface hard), lexical (lexically hard), and semantic (model-hard) — which together prevent the model from gaming any single hardness criterion.

### 5.3 Training Objective

**MultipleNegativesRankingLoss** (InfoNCE variant):

```
L = -log [ exp(sim(q, p+) / τ) / Σ exp(sim(q, pj) / τ) ]
```

where `q` is the query, `p+` is the positive passage, and `{pj}` are in-batch negatives supplemented with mined hard negatives. Temperature `τ` is a hyperparameter (typically 0.05–0.1).

Implemented directly in `sentence-transformers` via `MultipleNegativesRankingLoss`.

### 5.4 Index Composition Risk: Paraphrase Dominance

The FAISS index holds 5 representations per tercet: 3 English translations (Longfellow, Mandelbaum, Hollander), 1 English modern paraphrase, and 1 modern Italian paraphrase. These representations are not equivalent in their relationship to the model's pre-trained embedding space.

**The risk:** Modern paraphrases are written in plain, unambiguous contemporary prose. Literary translations — especially Longfellow (1867) — use archaic diction, syntactic inversions, and poetic compression. Pre-trained multilingual models encode plain modern prose more reliably than archaic literary register. As a consequence, paraphrase embeddings may cluster more tightly in the model's embedding space: they are *model-friendly* in a way that canonical translations are not.

Under contrastive training, the model can satisfy the InfoNCE loss primarily by aligning with paraphrase representations, treating literary translations as harder-to-distinguish outliers. At retrieval time this manifests as: modern-language queries surface the correct tercet (paraphrase is the matching representation — correct); translation-fragment queries fail to distinguish between translations from different tercets because those embeddings have been compressed into a region of space the model treats as uniform (incorrect).

**Detection:**

- **Per-representation match rate:** During training, log which representation type resolves the contrastive positive at each step. If paraphrases are the matched positive in ≥ 60% of steps, the model is optimising primarily against paraphrase targets.
- **Embedding space audit (UMAP):** Plot all index documents colored by representation type. If paraphrases form a tight separate cluster, the embedding space has been distorted in a way that disadvantages literary translations.
- **Per-type recall (§6.4):** If English-translation-fragment queries score significantly lower Recall@1 than modern-paraphrase queries, the model is paraphrase-biased in retrieval. This is the clearest signal because it is measured on held-out queries, not on training dynamics.

**Mitigations, in order of invasiveness:**

| Level | Mitigation | When to apply |
|-------|-----------|---------------|
| 1 | Monitor only — log match rate and per-type recall before acting | Phase 1a baseline |
| 2 | Subsample cross-paraphrase pairs in training; ensure translation↔translation pairs are not under-represented relative to paraphrase pairs | If match rate signal is visible |
| 3 | Apply higher contrastive loss weight to pairs where the positive is a literary translation | If per-type recall shows divergence |
| 4 | Add translation-fragment-specific held-out queries per translation; report recall separately per translation | If Mitigation 3 is insufficient |

The monitoring step (Level 1) is mandatory regardless: representation-type match rate is a diagnostic that costs nothing to log and makes paraphrase dominance detectable before it becomes a hard-to-diagnose retrieval failure.

---

## 6. Evaluation Framework

**Error Analysis First.** Before defining static evaluation sets or training models, we must perform qualitative error analysis (open coding and axial coding). This is the "secret sauce" of AI evaluation:
1. **Dimensional Sampling:** Generate 100+ diverse queries using dimensions like Canticle (Inf/Purg/Par), Theme (emotional/metaphor/conceptual), and User Persona (scholar/student/casual).
2. **Review Traces:** Run these queries through the Phase 0 baseline. Review the Phoenix/Langfuse traces and take notes on failure modes.
3. **Axial Coding:** Categorize the failures (e.g., "False Cognate Error", "Overweighting BM25", "Paraphrase Dominance") to prioritize fixes.

**Ground truth must be defined before training.** The two retrieval tasks have fundamentally different evaluation structures and cannot share a single protocol:

| Property | Verse recall (Phase 1) | Thematic search (Phase 2) |
|----------|----------------------|--------------------------|
| Ground truth construction | Automatic (parallel corpus) | Human annotation — mandatory |
| Relevance type | Binary (one correct tercet per query) | Graded (multiple tercets may be relevant) |
| Correct answers per query | Exactly one | One or many |
| Primary metric | Recall@1 | nDCG@10 |

---

### 6.1 Query Distribution Model

The expected distribution of query types determines: (a) the relative importance of BM25 vs. dense retrieval in RRF weighting, (b) the training data allocation across pair types, and (c) the composition of the evaluation sets. Without an explicit distribution, these choices are arbitrary.

The following is an **assumed prior** based on the likely user population (Italian literary users, English translation readers, general public). It must be validated and updated post-launch via query logging.

**Phase-level split (estimated):**

| Phase | Traffic share |
|-------|--------------|
| Verse recall (Phase 1) | ~70% |
| Thematic search (Phase 2) | ~30% |

**Verse recall — query type breakdown (% of Phase 1 traffic):**

| Type | Example | Est. % | Primary retrieval track |
|------|---------|--------|------------------------|
| Exact / near-exact Italian fragment | "nel mezzo del cammin" | 20% | BM25 (archaic Italian) |
| Modern Italian paraphrase | "a metà della mia vita" | 25% | Dense (modern IT reps) |
| English translation fragment | "midway upon the journey" | 20% | Dense (EN translations) |
| English semantic paraphrase | "halfway through life's journey" | 35% | Dense (EN paraphrases) |

**Thematic search — query type breakdown (% of Phase 2 traffic):**

| Type | Example | Est. % |
|------|---------|--------|
| Emotional / experiential | "I was lost and afraid at 35" | 50% |
| Conceptual / character reference | "storia di Paolo e Francesca" | 30% |
| Cross-domain metaphor | "standing at a crossroads" | 20% |

**Implications for component weighting:**

- BM25 is the primary track for ~14% of total queries (20% of 70% Phase 1 traffic). For all other queries, BM25 contributes noise; the dense track should dominate.
- This sets a prior for the RRF `α` parameter: start with BM25 weight ≈ 0.2, dense weight ≈ 0.8, tune on the development set.
- LLM query expansion is relevant for 100% of Phase 2 (thematic) traffic — ~30% of total. Its latency cost is therefore significant at scale and must be measured in Phase 2 profiling.

**Implication for evaluation set composition:**

The Phase 1 evaluation set of 200 paraphrase recall queries should be composed to mirror the distribution:

| Query type | Target count |
|------------|-------------|
| Exact / near-exact Italian fragment | 40 |
| Modern Italian paraphrase | 50 |
| English translation fragment | 40 |
| English semantic paraphrase | 70 |

The Phase 2 evaluation set of 100 thematic queries:

| Query type | Target count |
|------------|-------------|
| Emotional / experiential | 50 |
| Conceptual / character reference | 30 |
| Cross-domain metaphor | 20 |

Metrics must also be reported **per query type**, not only in aggregate — a system that achieves 0.90 Recall@1 overall but 0.40 on Italian fragments has a specific, actionable failure mode that the aggregate number hides.

---

### 6.3 Evaluation Sets

| Set | Phase | Size | Construction |
|-----|-------|------|--------------|
| Cross-lingual recall | 1 | ~4,740 | Automatic: each translation → its source tercet |
| Paraphrase recall | 1 | 200 | Hand-crafted: distributed per §6.1 query type targets |
| Hard cases | 1 | 50 | Adversarially selected (see below) |
| Thematic queries | 2 | 100 | Hand-crafted: distributed per §6.1 query type targets |

**Hard cases** for verse recall include: false cognates between archaic and modern Italian that mislead the dense retriever; tercets from the same Canto that are thematically adjacent (test boundary precision); queries that could plausibly match passages across multiple Canticles.

---

### 6.4 Verse Recall Metrics (Phase 1)

Ground truth is **unique and automatic**: each query has exactly one correct answer, derived from the parallel corpus alignment. Relevance is binary.

| Metric | Definition | Target | Notes |
|--------|------------|--------|-------|
| **Recall@1** | Correct tercet is the top-1 result | > 0.85 | Primary metric — the system either finds it or it doesn't |
| **Recall@5** | Correct tercet appears in top 5 | > 0.95 | Secondary — if not in top 5 the system has meaningfully failed |
| **MRR@10** | Mean Reciprocal Rank at cutoff 10 | > 0.88 | Captures partial credit for near-misses; sensitive to rank position |

Recall@10 is deliberately excluded as a primary metric: for verse recall, a system that requires 10 results to surface the correct tercet is not fit for purpose. Recall@5 is the practical failure threshold.

All metrics must be reported **per query type** (Italian fragment / modern Italian / EN fragment / EN paraphrase) in addition to aggregate — a system scoring 0.90 Recall@1 overall but 0.40 on Italian fragments has a specific, actionable failure mode that the aggregate hides.

---

### 6.5 Thematic Search Metrics (Phase 2)

Ground truth is **non-unique and graded**: multiple tercets may be relevant to a thematic query at different degrees. Human annotation is not optional — there is no automatic proxy for thematic relevance.

#### Relevance Scale

| Score | Label | Definition |
|-------|-------|------------|
| 0 | Not relevant | Passage has no meaningful connection to the query |
| 1 | Marginally relevant | Shares surface theme but does not illuminate the query |
| 2 | Relevant | Passage meaningfully addresses the query's theme |
| 3 | Highly relevant | Passage is a strong, direct match; a reader would find it valuable |

#### Annotation Protocol

**Staged approach — pilot before full annotation:**

Before committing to all 100 queries, run a **30–40 query pilot**:
1. Select a stratified subset (covering all three query types and all three Canticles)
2. Annotate with 2 annotators using the 0–3 scale
3. Compute kappa on the pilot set
4. If kappa < 0.50: the rubric is ambiguous — refine definitions, add examples to the annotation guide, and re-annotate the pilot before proceeding
5. If 0.50 ≤ kappa < 0.60: borderline — hold a calibration session, resolve disagreements collectively, then expand
6. If kappa ≥ 0.60: proceed to full annotation

The pilot also provides a time estimate per query: annotation of 50-candidate pools for thematic queries typically takes 10–20 minutes per annotator per query. With 100 queries and 2 annotators, budget 35–70 hours of annotation effort before starting.

**Full annotation protocol & LLM-as-a-Judge:**

- **Annotators:** minimum 2 per query; disagreements resolved by adjudication (third annotator or majority vote)
- **Inter-annotator agreement:** Cohen's kappa ≥ 0.60 required before annotations are used for evaluation; queries below threshold are re-annotated or removed
- **LLM-as-a-Judge (Scaling Up):** Once human annotation has established a gold standard of 100 queries, build an LLM Judge (e.g., GPT-4o) using the same 0-3 grading rubric. Supply it with the user query, retrieved tercet, and Hollander's commentary to provide semantic context. Evaluate the judge's alignment with human annotators. If alignment is high, use the LLM Judge for continuous CI/CD evaluation, applying statistical correction against the human baseline to account for judge bias.
- **Scope:** annotators assess the original Italian tercet alongside its translations — relevance is judged on meaning, not surface form
- **Pool size:** each query is judged against a pool of 50 candidate tercets (top-50 from the baseline retriever), not the full corpus

#### Metrics

| Metric | Definition | Target | Notes |
|--------|------------|--------|-------|
| **nDCG@10** | Normalised Discounted Cumulative Gain at 10 | > 0.70 | Primary — accounts for graded relevance and rank position |
| **nDCG@5** | nDCG at cutoff 5 | > 0.65 | Stricter; tests whether top results are the best results |

nDCG is the correct metric here because it rewards surfacing highly relevant passages (score 3) higher in the ranking over marginally relevant ones (score 1), and discounts relevance logarithmically by rank.

#### Reformulation Quality Evaluation

The LLM expansion step must be evaluated independently, not only as part of the end-to-end pipeline. The instrument is **retrieval delta** — the change in nDCG@10 attributable to reformulation alone, measured on the annotated thematic evaluation set.

**Measurement procedure:**
1. Run all 100 thematic queries through the pipeline **without** expansion (raw query → retriever)
2. Run the same queries **with** LLM expansion (reformulated query → retriever)
3. For each query: `delta_i = nDCG10_with(i) - nDCG10_without(i)`

**Reporting — do not report the mean alone:**

| Statistic | What it reveals |
|-----------|----------------|
| Mean delta | Overall tendency; can be positive even when many queries are harmed |
| % queries with delta > 0 | Fraction where expansion helped |
| % queries with delta < 0 | Fraction where expansion actively hurt — the critical failure signal |
| % queries with \|delta\| < 0.05 | Fraction where expansion had no meaningful effect |
| Delta by query type | Whether expansion helps emotional queries more than conceptual ones |

A mean delta of +0.12 with 35% of queries having delta < 0 is a system with a significant failure mode hiding behind a positive average. Per-query distribution exposes this.

**Qualitative inspection:**

Sample 20–30 (original, reformulated) pairs from queries with the largest negative delta and inspect manually. Common failure modes:
- **Overspecification:** LLM adds concepts not implied by the query, retrieving thematically adjacent but wrong tercets
- **Hallucination:** LLM introduces characters or events not actually in the poem, biasing the retriever toward false matches
- **Register mismatch:** reformulation in archaic or scholarly register that does not match the fine-tuned retriever's training distribution

#### Fine-Tuning Path

If the delta distribution reveals systematic failure modes in specific query types, the reformulator can be improved without changing the retrieval backbone:

1. Collect (original_query, reformulated_query, delta) triples from the evaluation set
2. Positive examples: reformulations with delta > 0 (expansion helped)
3. Negative examples: reformulations with delta < 0 (expansion hurt)
4. Fine-tune a small sequence-to-sequence model (e.g. mT5-base) on positive examples using standard supervised fine-tuning
5. Use retrieval delta as the reward signal — this is equivalent to offline RLHF for query reformulation, with nDCG@10 delta as the proxy for human preference

This path is only warranted if prompt engineering fails to close the gap, and only after the annotated evaluation set is large enough to provide reliable signal (≥ 200 thematic queries with human judgments).

---

### 6.6 Ablation Structure (Phase 1)

Every Phase 1 improvement is measured against a defined baseline chain on the verse recall evaluation sets:

```
BM25 only (word unigrams + character 5-grams, original Italian)
  → Zero-shot bi-encoder (multilingual-e5-large, no fine-tuning)
    → Fine-tuned bi-encoder (random negatives)
      → Fine-tuned bi-encoder (hard negatives)
        → Hybrid: static RRF (w_BM25 = 1.0)
          → Hybrid: query-aware RRF, Tier 1 (language detection)
            → Hybrid: query-aware RRF, Tier 2 (score-based dynamic weighting)
              → Full pipeline + cross-encoder reranker
```

Each step is evaluated on Recall@1, Recall@5, and MRR@10, reported both in aggregate and per query type. The two query-aware fusion steps are evaluated separately to isolate their contribution — language detection and score-based weighting are not equivalent and may perform differently across query type distributions.

---

## 7. Phasing and Milestones

The implementation follows four sequential phases. Each phase has a concrete deliverable that gates the next phase. Phase 0 is prerequisite to all subsequent phases; Phases 1a and 1b are sequential; Phase 2 depends on Phase 1b; Phase 3 requires Phase 2 outputs.

### Phase 0 — Corpus and Baseline

- [ ] Assemble and clean corpus: original Italian + 3 English translations, aligned at tercet level; assign stable `tercet_id` keys
- [ ] Build lookup table: `tercet_id → original Italian text`
- [ ] Generate modern Italian paraphrases for all ~4,740 tercets: use a capable instruction-tuned LLM (e.g. GPT-4o) with few-shot examples drawn from Hollander's prose commentary — these exemplify the right register (scholarly yet accessible modern Italian, tercet-scoped, meaning-faithful rather than word-for-word). Spot-check a stratified sample of ~100 tercets across all three Canticles before indexing; reject and regenerate any paraphrase that hallucinates content or misidentifies the speaker
- [ ] Extract and store Hollander commentaries as metadata JSON keyed on `tercet_id`
- [ ] Build evaluation benchmark (200 paraphrase queries, ground truth)
- [ ] Implement BM25 retrieval; measure Recall@1, MRR@10
- [ ] Run zero-shot multilingual-e5-large; compare vs. BM25

**Deliverable:** baseline numbers; evaluation harness; reproducible corpus pipeline

---

### Phase 1a — Fine-Tuned Bi-Encoder

- [ ] Construct positive pair dataset from parallel corpus (~28K pairs from translations alone; ~50K with paraphrases)
- [ ] Mine hard negatives using frozen base model
- [ ] Fine-tune `multilingual-e5-large` with `MultipleNegativesRankingLoss`; consider **LoRA/QLoRA** for the first iteration — fine-tuning all ~560M params on a single A100 is feasible but slow to iterate (full fine-tuning: ~4–8h per run). LoRA (rank 16–32 on attention layers) reduces trainable parameters by 100×, enabling 3–5× faster iteration with comparable retrieval gains on small corpora; switch to full fine-tuning only if LoRA reaches a ceiling
- [ ] Evaluate on benchmark; ablate random vs. hard negatives
- [ ] Cross-lingual alignment audit: plot cosine similarity distribution for IT↔EN tercet pairs, pre/post fine-tuning
- [ ] **UMAP diagnostic** (pre- and post-fine-tuning): embed all ~24K index documents; plot colored by Canticle, then by Canto. If Canticle boundaries are not visible post-training, the model is not learning the poem's semantic structure — a signal to revisit training data or loss formulation before proceeding to Phase 1b. This is a diagnostic checkpoint, not a presentation artifact.

**Deliverable:** fine-tuned bi-encoder checkpoint; alignment audit plot; UMAP pre/post comparison; ablation table

---

### Phase 1b — Hybrid Pipeline + Reranker

- [ ] Combine BM25 + dense with RRF; tune `k` on dev set
- [ ] Add cross-encoder reranker on top-50 shortlist
- [ ] Full ablation: BM25 / dense / hybrid / hybrid+reranker
- [ ] Latency profiling: bi-encoder, reranker, full pipeline (p50, p95, p99)
- [ ] Display layer: show retrieved tercet plus immediate neighbors (±1) — mitigates the multi-tercet concept failure mode (§10.2) at display time with no retrieval cost; confirm this does not hurt precision on verse recall queries (neighbors should be clearly secondary)

**Deliverable:** full retrieval pipeline; ablation table; latency report

---

### Phase 2 — Thematic Search

- [ ] Define thematic query evaluation set (100 queries, graded relevance, distributed per §6.1 targets)
- [ ] Implement LLM query expansion with structured logging (original query, reformulated query, retrieval delta per §3.4 spec)
- [ ] Measure retrieval delta distribution: mean, % helped, % hurt, % neutral, by query type
- [ ] Qualitative inspection of 20–30 highest-negative-delta (original, reformulated) pairs — identify failure mode taxonomy
- [ ] Evaluate thematic search end-to-end: expansion alone / dense alone / expansion + dense; report nDCG@10 and nDCG@5
- [ ] Failure mode analysis: where does thematic search break and does it break at the expansion step or the retrieval step?

**Deliverable:** thematic search pipeline; evaluation results; failure taxonomy

---

### Phase 3 — Visualization and Calibration

- [ ] UMAP extended visualization (building on Phase 1a diagnostic): if Canticle/Canto structure is visible, add coloring by sin category (Inferno circles), stage of purification (Purgatorio terraces), and sphere (Paradiso heavens) — does fine-grained moral/theological structure emerge in embedding space?
- [ ] Retrieval score calibration: plot score vs. precision; apply temperature scaling if needed
- [ ] If reformulation delta analysis (Phase 2) reveals systematic failure modes: fine-tune a small reformulator (mT5-base) on positive delta examples — only if prompt engineering has failed to close the gap and ≥ 200 annotated thematic queries are available
- [ ] Interactive Hugging Face Space demo

**Deliverable:** UMAP plots; calibration analysis; public demo

---

## 8. Infrastructure

| Layer | Tool | Notes |
|-------|------|-------|
| Training | `sentence-transformers` | Native support for contrastive losses and bi-encoder training |
| Experiment tracking | MLflow | Already in use; track loss, retrieval metrics per checkpoint |
| ANN index | FAISS `IndexFlatIP` | ~24K vectors (4,740 tercets × 5 representations); exact search still fast at this size |
| Lookup table | Python dict / JSON | `tercet_id → original Italian`; loaded in memory at startup; trivial overhead |
| Metadata store | JSON file | `tercet_id → commentary text`; loaded at startup; displayed alongside results; never queried |
| BM25 | `rank_bm25` | Lightweight; no server required |
| Cross-encoder | `cross-encoder/mmarco-mMiniLMv2-L12-H384` | Multilingual; fits on CPU for reranking |
| Serving | FastAPI + FAISS in-memory | Deployable as Hugging Face Space |
| Hardware | Single A100 (or Colab Pro) | Fine-tuning `multilingual-e5-large` (~560M params) |
| Fine-tuning efficiency | LoRA/QLoRA via `peft` | Rank 16–32 on attention layers; ~100× fewer trainable params; 3–5× faster iteration; use for initial experiments before committing to full fine-tuning |

---

## 9. Key Design Decisions and Rationale

**Why not RAG over a frontier LLM?**
The corpus is fixed and bounded. RAG addresses the problem of keeping a model's knowledge current — not applicable here. What is needed is specialized retrieval, not generation. A frontier LLM with the full text in context would work for demo purposes but is opaque, expensive, and uninteresting from an ML design perspective.

**Why sentence-transformers over training from scratch?**
Pre-trained multilingual models already encode a strong prior over cross-lingual semantics. Fine-tuning adapts the representation to the specific distribution of the corpus (archaic vocabulary, verse structure, terzina rhythm) without discarding this prior. Training from scratch would require orders of magnitude more data.

**Why three translations and not one?**
Multiple translations capture interpretive variance. Longfellow's literal prose, Mandelbaum's poetic line, and Hollander's annotated translation make different lexical choices. A model trained on all three learns that these surface differences are not semantic differences — which is exactly the robustness needed for thematic search.

**Why evaluate before training?**
Defining the evaluation benchmark before any model training eliminates the risk of inadvertently optimizing for the wrong objective. It also forces precision about what "good retrieval" means for this specific task.

**Why pass the highest-scoring bi-encoder translation to the cross-encoder?**
After FAISS retrieval and deduplication, each candidate tercet is represented by its best-matching translation. Passing all translations to the cross-encoder instead would multiply inference time by 3–4× per candidate with no guaranteed improvement — the bi-encoder already selected the translation most aligned to the query. The alternative of concatenating all translations risks exceeding context limits and introduces noise from translations that do not match the query's register. Keeping one passage per tercet through the full pipeline is consistent, efficient, and maintains the semantic signal established at the retrieval stage.

**Why no stemmer for BM25, and why character n-grams?**
Standard Italian stemmers (Snowball) were designed for modern Italian morphology and produce incorrect stems on medieval Florentine. Not stemming is strictly better. Character 5-grams are added as supplementary tokens to handle the realistic failure modes for this track: archaic spelling variants (*diritta* vs. *dritta*), clitic compounds (*ritrovami*), and fragments a user half-remembers. Word unigrams retain exact-match precision for the common case; character n-grams provide fuzzy robustness for the edge cases. This is the same design used in production search engines (Elasticsearch's edge n-gram filter) for morphologically complex or domain-specific vocabularies.

**Why query-aware fusion instead of static RRF?**
Static RRF with fixed `k` assumes both rankers are beneficial for every query. In this system the BM25 track runs over archaic Italian text — a representation that is useful only for queries containing Italian fragments (~14% of estimated total traffic). For all other queries, the BM25 track adds noise: it produces rankings based on surface overlap between modern-language queries and medieval text, which is largely accidental. Blending this noise into the final score via static RRF harms precision. Query-aware weighting sets `w_BM25` to near-zero for non-Italian queries, effectively bypassing BM25 without the overhead of running two completely independent pipelines. The two-tier design (language detection → score-based) provides a degradation path: if language detection fails or is unavailable, Tier 2 falls back to a signal that is always available (the BM25 top-1 score itself).

**Why include modern Italian paraphrases in the FAISS index?**
English translations alone leave a cross-lingual gap for Italian users querying with contemporary vernacular (e.g., "storia di Paolo e Francesca", "paura nella foresta"). The BM25 track over the archaic original does not close this gap — BM25 matches surface tokens, not modern Italian meaning. Modern Italian paraphrases give the bi-encoder an explicit target in the right language and register, routing domestic Italian traffic through the dense track rather than the less precise BM25 track.

**Why max pooling (highest-scoring representation) for deduplication, not average?**
Queries are stylistically specific. A user quoting a Longfellow fragment will score very high against Longfellow and potentially low against Mandelbaum's poetic rendering of the same tercet. Averaging those scores penalises a correct match by diluting it with irrelevant representations. Max pooling preserves the strongest signal: if any representation matches the query well, the tercet is correctly retrieved.

**Why keep commentaries out of the retrieval index?**
Commentaries (e.g. Hollander's extensive theological and historical notes) introduce vocabulary, concepts, and proper names that are not present in the primary text. Indexing them would pollute the dense vectors with outside semantic signal and cause high false-positive rates: a query about Florentine political history might surface tercets that merely happen to be annotated with historical commentary, not tercets that thematically match. Commentaries are stored as a separate metadata file keyed on `tercet_id` and displayed alongside results — useful as context, not as retrieval signal.

**Why index translations instead of the original Italian?**
The original text is in medieval Florentine — a language with significant lexical and morphological distance from modern Italian. Pre-trained multilingual models tokenize it poorly: rare tokens, fragmented subwords, low-frequency embeddings. Indexing translations in modern English (and optionally modern Italian paraphrases) sidesteps this entirely: the model operates in a semantic space it was trained on. The original Italian is not lost — it is the displayed result, retrieved via a static lookup keyed on `tercet_id`. This separation of concerns (retrieval over modern representations, display of the original) is analogous to the *document expansion* paradigm in information retrieval, where corpora are enriched with generated text to improve retrieval coverage while the original document remains the authoritative output. The BM25 track over the original Italian handles the residual case of users querying with archaic Italian fragments directly.

---

## 10. Known Failure Modes

Every retrieval system has a failure boundary. Stating it explicitly serves two purposes: it constrains the claimed scope of the design, and it identifies what the evaluation sets must cover to be credible. The following failure modes are **known and architectural** — they cannot be resolved by training better embeddings alone.

### 10.1 Highly abstract thematic queries

Queries like "the nature of divine love" or "the relationship between reason and faith" have no single retrievable tercet as an answer. The meaning is distributed across the poem, emergent from hundreds of passages in aggregate. The bi-encoder maps the query to a single embedding and retrieves single tercets — the retrieval paradigm itself cannot surface distributed concepts.

LLM query expansion (Phase 2) partially mitigates this: decomposing the abstract query into specific sub-themes ("God as light", "Beatrice as grace", "reason failing where faith begins") produces multiple targeted queries whose union covers more of the relevant tercets. But this is workaround, not solution — the user receives a list of passages, not a synthesised answer about the poem's theology.

**Evaluation implication:** the thematic query set (§6.3) should include ≥10 abstract queries of this type, with a lower nDCG@10 target than concrete thematic queries. The target for this subtype should be set after measuring zero-shot performance, not assumed.

### 10.2 Multi-tercet concepts

Dante's narrative develops across sequences of 3–10 consecutive tercets: extended Homeric similes, dialogue exchanges, the progressive stages of Dante's emotional transformation as he enters each realm. A single tercet is frequently not the unit of meaning — it is an incomplete phrase in a longer syntactic or rhetorical structure.

This is a **deliberate scope constraint**, not a solvable failure mode. The system retrieves tercets. A user whose intent spans multiple consecutive tercets will receive the most relevant tercet in the sequence, not the full passage. The display layer can partially compensate by showing the retrieved tercet plus its immediate neighbors (±1), but this is a UX mitigation — the retrieval problem itself is not resolved.

### 10.3 Irony and rhetorical inversion

Dante uses irony systematically — praising what he condemns, expressing admiration that is contempt, putting sincere belief in the mouths of characters who lack it. A query for "passages where Dante admires political power" may retrieve tercets in which Dante is at his most caustic toward corrupt rulers. The bi-encoder matches semantic surface similarity between the query and the text; it cannot distinguish sincere assertion from performative statement.

The cross-encoder reranker is also unlikely to resolve this. Cross-encoders learn joint relevance from training data; without training pairs that explicitly flag ironic tercets as non-relevant to their literal-reading query counterparts, the reranker has no signal to distinguish them.

**Mitigation path:** ironic passages could be flagged in the metadata store (e.g., from Hollander's commentary, which explicitly notes rhetorical inversion) and excluded from — or down-ranked in — retrieval for literal-intent queries. This requires query intent classification (is the user asking about sincere passages or rhetorical ones?) and is a Phase 3+ concern.

### 10.4 Character-based relational queries

Queries like "where Virgil hesitates", "when Beatrice smiles", or "tercets where Dante weeps" require identifying a character and a specific action or state attributed to that character. The bi-encoder embeds the tercet holistically — a tercet that mentions Virgil prominently but in a guiding rather than hesitating role may score high against "Virgil hesitates" because "Virgil" matches strongly and "hesitates" matches weakly.

The cross-encoder improves this: full attention over the (query, passage) pair can attend to the specific predicate. But cross-encoder gains here depend on how frequently such query types appear in the training data for the base cross-encoder model. Without targeted training pairs that stress-test character-predicate distinction, performance on this query type is unpredictable.

**Evaluation implication:** the hard cases set (§6.3, 50 adversarial queries) should include ≥10 character-based relational queries covering all three Canticles and multiple characters. These queries are the sharpest test of boundary precision between adjacent tercets.

---

## 11. Open Questions

All design questions identified in the initial draft have been resolved except one. Resolved items are captured in the relevant version's changelog entry.

**Open:**

- [ ] **Cross-encoder training:** Fine-tune the reranker on this corpus, or use the multilingual reranker zero-shot? Reranker training data requires graded relevance judgments — not binary positives — which adds annotation cost. Decision deferred to Phase 1b after measuring zero-shot cross-encoder performance.

---

## 12. Risk Register

Known risks and dependencies that could materially affect the project. Tracked here so they are visible at design time, not discovered at implementation time.

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **LLM paraphrase quality** — GPT-4o generates modern Italian paraphrases that are fluent but semantically incorrect for specific tercets | Medium | High (corrupts 5th representation; hurts Italian user retrieval) | Stratified QC sample + back-translation round-trip check + embedding similarity to original; budget regeneration for ~5% of tercets |
| **Language detection brittleness** — fasttext `lid.176.ftz` misclassifies short or mixed-language queries; `w_BM25` is set incorrectly | Medium | Low–Medium (BM25 noise bleeds into non-Italian results) | Tier 2 score-based fallback is designed for exactly this; evaluate language detection accuracy on the verse recall query set separately |
| **A100 availability** — single GPU access is intermittent on Colab Pro; full fine-tune is preempted mid-run | Medium | Medium (delays Phase 1a) | Use LoRA for initial experiments (fits on smaller GPU, faster to checkpoint); reserve full fine-tuning for final run |
| **Annotation effort underestimate** — 100 thematic queries × 50 candidates × 2 annotators exceeds available bandwidth | Medium | High (blocks Phase 2 evaluation) | **Run a 30–40 query pilot annotation first** to validate the rubric and estimate per-query effort before committing to the full set (see §6.5 for staged protocol). If effort is constrained, prioritise the hard-cases set (50 adversarial queries) over the thematic set — it yields more diagnostic signal per annotation hour. |
| **Translation copyright** — Mandelbaum (1980) and Hollander (2000) are under copyright; public demo may infringe | High | High (demo must be taken down or rebuilt) | Resolve before Phase 3; substitute Norton (1892) / Cary (1814) for demo if licensing cannot be obtained |
| **Cross-encoder zero-shot insufficient** — mmarco reranker doesn't generalise to medieval-literary content well enough | Low–Medium | Medium (thematic search quality below target) | Ablation in Phase 1b will quantify; graded relevance annotation for reranker fine-tuning is expensive — only pursue if zero-shot nDCG lift is < 0.05 |
| **BM25 character n-gram index size** — 5-gram indexing of ~14K original Italian lines may produce a large index | Low | Low (still fits in memory; `rank_bm25` is pure Python) | Profile index size at Phase 0; if problematic, reduce to character 4-grams or limit n-gram coverage to token-internal substrings only |

---

## 13. Connections to Existing Work

| This project | Prior work on this site |
|---|---|
| Embedding calibration: retrieval score vs. precision | MNIST calibration (ECE, calibration curves) |
| UMAP of tercet embeddings | UMAP of penultimate features in bear detector |
| MLflow experiment tracking for training runs | MNIST MLflow project |
| Ablation-driven evaluation | Structure-vs-recall: logit lens, patching, DLA |
| Hard negative mining as a form of hard case analysis | OOD detection: near-OOD as hard boundary cases |

---

---

## 14. Future Work / Research Opportunities

The following extensions exceed the scope of the current design but represent genuine research opportunities — empirical questions that this corpus and pipeline are unusually well-positioned to answer.

### 13.1 Translation Variance as Confidence Signal

In the current architecture, the *spread* of bi-encoder scores across a tercet's 5 representations is discarded after max pooling. That spread is information.

High score variance across translations of the same tercet means the query's alignment is sensitive to one translation's specific word choices — the match is brittle. Low variance across high-scoring representations means the tercet aligns with the query regardless of surface form — the match is robust. For scholarly users this distinction is material: a retrieved passage driven by a modern paraphrase is a weaker textual claim than one driven by two independent canonical translations.

**Operationalization:**

```
conf(tercet, query) = μ(scores) / (1 + σ(scores))
```

where `μ` and `σ` are mean and standard deviation of bi-encoder similarities across all 5 representations. High mean, low variance → confident match; same mean, high variance → flagged as ambiguous.

**Research contribution:** measure the correlation between `σ(scores)` and human relevance judgments from the thematic annotation set (§6.5). Test whether routing high-variance candidates through an additional cross-encoder pass improves precision. This is a novel calibration question — parallel-corpus retrieval provides the signal; standard single-representation benchmarks cannot. Direct connection to the calibration work in §13.

### 13.2 Multi-Vector Retrieval (ColBERT-style)

The current bi-encoder compresses each passage into a single vector. A tercet about "light as divine metaphor" and a tercet about "light in a forest clearing" may map to nearby points because both compress to the same topical neighbourhood without preserving the distinction.

**ColBERT** (Khattab & Zaharia, 2020) replaces single-vector compression with *token-level late interaction*: each query token computes a maximum similarity (MaxSim) against all passage tokens; the final score is the sum of per-token MaxSims. Fine-grained lexical signal is preserved without the compression bottleneck.

Relevance to this system's known failure modes (§10):

- **Partial recall queries:** a user who remembers one specific word benefits from token-level matching — the query token finds its counterpart without needing the full query to compress into the right neighbourhood.
- **Mixed-language input:** a query mixing Italian and English ("the selva, dark and overwhelming") has Italian tokens that match via BM25 and English tokens that interact at the token level with translation embeddings. Code-switching that confuses a single-vector encoder is naturally handled at the token level.
- **Character relational queries (§10.4):** "Virgil hesitates" requires both the character name and the predicate to match — token-level interaction explicitly scores both.

**Implementation:** `pylate` (a `sentence-transformers` extension) provides ColBERT. At ~24K index documents, full token-level storage is tractable without PLAID compression.

**Research framing:** a head-to-head comparison of bi-encoder vs. ColBERT on the verse recall evaluation sets (§6.3), at Recall@1 and MRR@10 per query type, is a well-scoped empirical contribution. The hypothesis — ColBERT gains most on partial-recall and mixed-language queries, loses nothing on full-paraphrase queries — is directly testable with the existing evaluation infrastructure.

### 13.3 Interpretability Layer

The current output is a ranked list of tercets with relevance scores. For scholarly use, "the system returned this passage" is insufficient. A researcher needs to know *which representation* drove the retrieval and *which tokens* in the query and passage were responsible for the match.

Three levels of attribution, in order of implementation cost:

**Level 1 — Which representation matched (free):** The max-pooling deduplication step already knows which of the 5 representations scored highest for each candidate. Surface this alongside results. "Matched via Longfellow 1867" vs. "matched via modern English paraphrase" is material: a match driven by a paraphrase is a weaker textual claim than one driven by a 19th-century verse translation that independently made the same lexical choices.

**Level 2 — Key token attribution:** Apply **Integrated Gradients** to the bi-encoder to identify which query tokens and which passage tokens contributed most to the cosine similarity. For "midway through life's journey", attribution should surface "midway" ↔ "mezzo" ↔ "del cammin" — a legible cross-lingual chain grounded in the text, not a black-box score.

**Level 3 — Cross-encoder attention visualization:** The cross-encoder's final-layer attention weights show which query tokens attended to which passage tokens when computing the relevance score. Visualizing this for the top-ranked result produces a scholar-legible trace of why the reranker placed this tercet first.

**Scholarly upside:** this layer transforms the system from a retrieval engine into a scholarship tool. A Dante scholar can discover which translation's lexical choices made a passage retrievable for a given query — a meta-insight about the translations themselves, not only about the poem. That use case is unavailable from any existing Dante concordance or search tool.

---

*This document is a living design reference. Sections marked with open checkboxes are unresolved. Completed phases will be annotated with results links.*
