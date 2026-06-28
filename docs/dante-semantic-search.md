# Semantic Search in Dante's Divine Comedy — Solution Design

> **Status:** Draft · **Version:** 0.9 · **Last updated:** 2026-06-28

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
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

The bounded, exhaustive nature of the corpus is a design asset: ground truth can be constructed completely, and the index fits comfortably in memory.

---

## 3. Architecture Overview

The system uses a **two-stage retrieval pipeline** — the current best practice for dense retrieval. A key architectural decision (v0.3) is that the **original Italian is not part of the retrieval index**. It is a display target, recovered via a static lookup after retrieval. The dense index and BM25 index operate entirely over modern-language representations (translations and paraphrases), which are semantically accessible to pre-trained multilingual models without the archaic vocabulary problem.

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

- `(italian_fragment, translation_EN)` — archaic fragment → English translation; trains the model to surface the right tercet from an Italian-language query
- `(translation_A, translation_B)` — cross-translation positives; aligns different English renderings of the same tercet
- `(translation_EN, modern_paraphrase_EN)` — English translation → English paraphrase; paraphrase robustness
- `(modern_paraphrase_IT, translation_EN)` — modern Italian query → English translation; cross-lingual alignment for domestic Italian traffic
- `(modern_paraphrase_IT, modern_paraphrase_EN)` — cross-lingual modern paraphrase pairs
- `(modern_query, translation_EN)` — thematic query → relevant tercet (Phase 2 training data)

With ~4,740 tercets and 5 representations, the retrieval corpus yields ~28K translation↔translation pairs from English alone, and ~40K+ once modern Italian paraphrase pairs are included. Total approaches ~60K without manual annotation.

### 5.2 Hard Negative Mining

Random negatives (any non-matching verse) are easy to distinguish and produce embeddings with poor boundary precision. Hard negatives — passages that are thematically close but factually wrong — are essential.

**Mining procedure:**

1. Index the retrieval corpus (translations + paraphrases) with a frozen base model
2. For each document, retrieve top-50 nearest neighbors from the same index
3. Remove true positives (documents sharing the same `tercet_id`)
4. Remaining top-K (K = 5–10) are hard negatives for that anchor

This is standard practice in all strong dense retrieval work (DPR, BGE, E5) and is the single most impactful dataset improvement beyond the basic parallel structure.

### 5.3 Training Objective

**MultipleNegativesRankingLoss** (InfoNCE variant):

```
L = -log [ exp(sim(q, p+) / τ) / Σ exp(sim(q, pj) / τ) ]
```

where `q` is the query, `p+` is the positive passage, and `{pj}` are in-batch negatives supplemented with mined hard negatives. Temperature `τ` is a hyperparameter (typically 0.05–0.1).

Implemented directly in `sentence-transformers` via `MultipleNegativesRankingLoss`.

---

## 6. Evaluation Framework

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

- **Annotators:** minimum 2 per query; disagreements resolved by adjudication (third annotator or majority vote)
- **Inter-annotator agreement:** Cohen's kappa ≥ 0.60 required before annotations are used for evaluation; queries below threshold are re-annotated or removed
- **Scope:** annotators assess the original Italian tercet alongside its translations — relevance is judged on meaning, not surface form
- **Pool size:** each query is judged against a pool of 50 candidate tercets (top-50 from the baseline retriever), not the full corpus

#### Metrics

| Metric | Definition | Target | Notes |
|--------|------------|--------|-------|
| **nDCG@10** | Normalised Discounted Cumulative Gain at 10 | > 0.70 | Primary — accounts for graded relevance and rank position |
| **nDCG@5** | nDCG at cutoff 5 | > 0.65 | Stricter; tests whether top results are the best results |

nDCG is the correct metric here because it rewards surfacing highly relevant passages (score 3) higher in the ranking over marginally relevant ones (score 1), and discounts relevance logarithmically by rank.

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

### Phase 0 — Corpus and Baseline

- [ ] Assemble and clean corpus: original Italian + 3 English translations, aligned at tercet level; assign stable `tercet_id` keys
- [ ] Build lookup table: `tercet_id → original Italian text`
- [ ] Generate modern Italian paraphrases for all ~4,740 tercets (LLM-assisted, manually spot-checked)
- [ ] Extract and store Hollander commentaries as metadata JSON keyed on `tercet_id`
- [ ] Build evaluation benchmark (200 paraphrase queries, ground truth)
- [ ] Implement BM25 retrieval; measure Recall@1, MRR@10
- [ ] Run zero-shot multilingual-e5-large; compare vs. BM25

**Deliverable:** baseline numbers; evaluation harness; reproducible corpus pipeline

---

### Phase 1a — Fine-Tuned Bi-Encoder

- [ ] Construct positive pair dataset from parallel corpus (~28K pairs from translations alone; ~50K with paraphrases)
- [ ] Mine hard negatives using frozen base model
- [ ] Fine-tune `multilingual-e5-large` with `MultipleNegativesRankingLoss`
- [ ] Evaluate on benchmark; ablate random vs. hard negatives
- [ ] Cross-lingual alignment audit: plot cosine similarity distribution for IT↔EN tercet pairs, pre/post fine-tuning

**Deliverable:** fine-tuned bi-encoder checkpoint; alignment audit plot; ablation table

---

### Phase 1b — Hybrid Pipeline + Reranker

- [ ] Combine BM25 + dense with RRF; tune `k` on dev set
- [ ] Add cross-encoder reranker on top-50 shortlist
- [ ] Full ablation: BM25 / dense / hybrid / hybrid+reranker
- [ ] Latency profiling: bi-encoder, reranker, full pipeline (p50, p95, p99)

**Deliverable:** full retrieval pipeline; ablation table; latency report

---

### Phase 2 — Thematic Search

- [ ] Define thematic query evaluation set (100 queries, graded relevance)
- [ ] Implement LLM query expansion (prompt: modern expression → poem-space concepts)
- [ ] Evaluate thematic search: expansion alone / dense alone / expansion + dense
- [ ] Failure mode analysis: where does thematic search break?

**Deliverable:** thematic search pipeline; evaluation results; failure taxonomy

---

### Phase 3 — Visualization and Calibration

- [ ] UMAP of tercet embeddings colored by Canticle, then by Canto — do embeddings reflect the poem's structure?
- [ ] Retrieval score calibration: plot score vs. precision; apply temperature scaling if needed
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

## 10. Open Questions

- [x] **Retrieval unit:** Tercet (terzina). Verse-level alignment across translations is unreliable — translators shift line boundaries and semantic closure consistently falls at the three-line unit. Resolved in v0.2.
- [x] **Archaic vocabulary handling:** Resolved in v0.3. The FAISS index holds only modern-language representations; the archaic Italian is never embedded for retrieval. Residual Italian-query coverage is handled by BM25 over the original text.
- [x] **Modern Italian paraphrases in the index:** Yes — included. Closes the cross-lingual gap for Italian users querying in contemporary vernacular. Fifth representation per tercet; ~24K total index documents. Resolved in v0.6.
- [x] **Deduplication strategy:** Max pooling (highest-scoring representation kept). Average pooling is rejected — stylistically specific queries score high against one translation and low against others; averaging penalises correct matches. Resolved in v0.6.
- [x] **Commentary inclusion:** Kept separate. Commentaries stored as metadata JSON keyed on `tercet_id`, displayed alongside results, never indexed. Indexing commentaries would pollute vectors with outside vocabulary and cause false positives on historically annotated but thematically unrelated tercets. Resolved in v0.6.
- [ ] **Cross-encoder training:** Fine-tune the reranker on this corpus, or use the multilingual reranker zero-shot? Training data for reranking is harder to construct (requires graded relevance, not binary positives).
- [x] **Thematic query evaluation:** Resolved in v0.7. 0–3 relevance scale; minimum 2 annotators per query; Cohen's kappa ≥ 0.60 required; pool of 50 candidates per query judged against original Italian + translations; primary metric nDCG@10.

---

## 11. Connections to Existing Work

| This project | Prior work on this site |
|---|---|
| Embedding calibration: retrieval score vs. precision | MNIST calibration (ECE, calibration curves) |
| UMAP of tercet embeddings | UMAP of penultimate features in bear detector |
| MLflow experiment tracking for training runs | MNIST MLflow project |
| Ablation-driven evaluation | Structure-vs-recall: logit lens, patching, DLA |
| Hard negative mining as a form of hard case analysis | OOD detection: near-OOD as hard boundary cases |

---

*This document is a living design reference. Sections marked with open checkboxes are unresolved. Completed phases will be annotated with results links.*
