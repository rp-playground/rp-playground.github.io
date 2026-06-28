# Semantic Search in Dante's Divine Comedy — Solution Design

> **Status:** Draft · **Version:** 0.6 · **Last updated:** 2026-06-28

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
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

Combined with the dense track via **Reciprocal Rank Fusion (RRF)**:

```
score_rrf(d) = Σ  1 / (k + rank_i(d))
```

where `k = 60` (standard) and the sum is over the two ranking lists. No additional parameters to tune.

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

**Ground truth must be defined before training.**

### 6.1 Evaluation Sets

| Set | Size | Construction | Purpose |
|-----|------|--------------|---------|
| Translation pairs | ~4,740 | Automatic (parallel corpus, tercet-aligned) | Measures cross-lingual alignment |
| Paraphrase queries | 200 | Hand-crafted | Measures paraphrase robustness |
| Thematic queries | 100 | Hand-crafted | Phase 2 evaluation |
| Hard cases | 50 | Adversarially selected | Boundary analysis |

Hard cases include: false cognates between archaic Italian and modern Italian, verses from the same Canto that are thematically adjacent, and queries that match multiple Canticles.

### 6.2 Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Recall@1 | Correct tercet in top-1 result | > 0.85 (verse recall) |
| Recall@10 | Correct tercet in top-10 | > 0.97 |
| MRR@10 | Mean Reciprocal Rank at 10 | > 0.88 |
| NDCG@10 | Normalized Discounted Cumulative Gain | > 0.90 |

### 6.3 Ablation Structure

Every improvement is measured against a defined baseline chain:

```
BM25 only
  → Zero-shot bi-encoder (no fine-tuning)
    → Fine-tuned bi-encoder (random negatives)
      → Fine-tuned bi-encoder (hard negatives)
        → Hybrid BM25 + dense (RRF)
          → Hybrid + cross-encoder reranker
```

This structure makes it possible to attribute performance gains to specific design decisions rather than to the system as a whole.

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
- [ ] **Thematic query evaluation:** Graded relevance (1–3 scale) for thematic queries requires human judgment. Who judges, and what is the annotation protocol?

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
