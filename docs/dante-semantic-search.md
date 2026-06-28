# Semantic Search in Dante's Divine Comedy — Solution Design

> **Status:** Draft · **Version:** 0.1 · **Last updated:** 2026-06-28

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-06-28 | Initial draft — project framing, architecture, dataset strategy, phasing |

---

## 1. Problem Statement

The Divine Comedy (~14,200 lines, composed 1308–1320) is one of the most commented and translated texts in the Western literary canon. Canonical English translations alone number over a dozen (Longfellow 1867, Mandelbaum 1980, Hollander 2000, …), each making distinct linguistic and interpretive choices. This layering — original medieval Italian plus centuries of translation variance — makes conventional keyword search nearly useless across languages and completely useless across semantic distance.

**The goal:** build a retrieval system that answers two classes of query:

1. **Verse recall** — a user provides a text fragment, in any language or paraphrase, and the system returns the matching verse(s) with high precision. Example: "a metà della vita" → Inferno I:1.
2. **Thematic search** — a user expresses a modern feeling or concept, and the system surfaces semantically relevant passages regardless of surface form. Example: "I was 35 and felt lost" → passages on Dante's midlife journey.

These are distinct retrieval tasks with different evaluation criteria and different model requirements.

---

## 2. Scope and Constraints

| Item | Decision |
|------|----------|
| Corpus | Divine Comedy only (all three Canticles) |
| Languages | Italian (original) + English (3–4 canonical translations) |
| Corpus size | ~14,200 verses; fixed and fully known |
| Inference target | Low-latency interactive search (< 300 ms p95) |
| Training budget | Consumer GPU (single A100 or equivalent) |
| Serving | Hugging Face Space (public demo) |

The bounded, exhaustive nature of the corpus is a design asset: ground truth can be constructed completely, and the index fits comfortably in memory.

---

## 3. Architecture Overview

The system uses a **two-stage retrieval pipeline** — the current best practice for dense retrieval:

```
User query
    │
    ▼
[Phase 2 only] Query Expansion (LLM)
    │
    ▼
Bi-encoder embedding  ──────────────────────────────────┐
    │                                                    │
    ▼                                                    ▼
ANN index (FAISS)                               Parallel BM25 index
    │                                                    │
    └──────────────── Reciprocal Rank Fusion ────────────┘
                               │
                               ▼
                    Top-K candidates (K = 50–100)
                               │
                               ▼
                    Cross-encoder reranker
                               │
                               ▼
                    Final ranked results (with scores)
```

### 3.1 Bi-Encoder (Dense Retrieval)

Encodes query and passages independently into a shared embedding space. At search time, retrieval is a cosine similarity lookup — fast, approximate, suitable for the full corpus. The bi-encoder is the component that will be **fine-tuned** on the parallel corpus.

**Base model:** `intfloat/multilingual-e5-large` or `BAAI/bge-m3`

Rationale: both are state-of-the-art multilingual dense retrieval models trained on large-scale cross-lingual data. BGE-M3 additionally supports hybrid dense/sparse retrieval natively. Zero-shot performance will be evaluated before fine-tuning to establish a baseline delta.

### 3.2 BM25 (Lexical Retrieval)

Classical term-frequency retrieval. Complementary to the bi-encoder: BM25 excels at rare proper nouns (character names, Florentine place names, hapax legomena) where dense retrieval can fail due to low training frequency. Combined via **Reciprocal Rank Fusion (RRF)**:

```
score_rrf(d) = Σ  1 / (k + rank_i(d))
```

where `k = 60` (standard) and the sum is over the two ranking lists. No additional parameters to tune.

### 3.3 Cross-Encoder (Reranker)

Takes (query, passage) pairs as joint input and produces a scalar relevance score. Slower than the bi-encoder (cannot pre-index) but significantly more accurate. Applied only to the top-K shortlist from stage 1.

**Base model:** `cross-encoder/mmarco-mMiniLMv2-L12-H384` (multilingual, efficient)

### 3.4 Query Expansion (Phase 2 only)

For thematic queries, a small LLM reformulates the user's query into terms closer to what the fine-tuned retriever expects. This is a thin agentic wrapper — not generative RAG — and does not replace the retrieval backbone.

**Design choice rationale:** agentic query expansion handles the semantic gap between modern vernacular ("avevo 35 anni") and the poem's conceptual vocabulary ("viaggio di mezzo cammino", midlife, exile). Fine-tuned embeddings handle verse-level alignment. Neither alone is sufficient for Phase 2.

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

The parallel corpus is the training signal. Its structure:

```
Verse unit (one terzina or single verse):
  ├── original_italian     "Nel mezzo del cammin di nostra vita"
  ├── translation_longfellow  "Midway upon the journey of our life"
  ├── translation_mandelbaum  "When I had journeyed half of our life's way"
  ├── translation_hollander   "Midway in the journey of our life"
  └── [optional] modern_paraphrase  "I was halfway through my life's journey"
```

### 5.1 Positive Pairs

Formed from cross-language and cross-translation alignment:

- `(italian, english_translation_A)` — cross-lingual positives
- `(english_translation_A, english_translation_B)` — cross-translation paraphrase positives
- `(italian, modern_paraphrase)` — archaic → modern positives

Each verse in the corpus generates multiple positive pairs without manual annotation.

### 5.2 Hard Negative Mining

Random negatives (any non-matching verse) are easy to distinguish and produce embeddings with poor boundary precision. Hard negatives — passages that are thematically close but factually wrong — are essential.

**Mining procedure:**

1. Index the corpus with a frozen base model (no fine-tuning yet)
2. For each verse, retrieve top-50 nearest neighbors
3. Remove true positives (same verse or known translations)
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
| Translation pairs | ~14,200 | Automatic (parallel corpus) | Measures cross-lingual alignment |
| Paraphrase queries | 200 | Hand-crafted | Measures paraphrase robustness |
| Thematic queries | 100 | Hand-crafted | Phase 2 evaluation |
| Hard cases | 50 | Adversarially selected | Boundary analysis |

Hard cases include: false cognates between archaic Italian and modern Italian, verses from the same Canto that are thematically adjacent, and queries that match multiple Canticles.

### 6.2 Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Recall@1 | Correct verse in top-1 result | > 0.85 (verse recall) |
| Recall@10 | Correct verse in top-10 | > 0.97 |
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

- [ ] Assemble and clean corpus: original Italian + 3 English translations, aligned at verse level
- [ ] Build evaluation benchmark (200 paraphrase queries, ground truth)
- [ ] Implement BM25 retrieval; measure Recall@1, MRR@10
- [ ] Run zero-shot multilingual-e5-large; compare vs. BM25

**Deliverable:** baseline numbers; evaluation harness; reproducible corpus pipeline

---

### Phase 1a — Fine-Tuned Bi-Encoder

- [ ] Construct positive pair dataset from parallel corpus (~50K pairs)
- [ ] Mine hard negatives using frozen base model
- [ ] Fine-tune `multilingual-e5-large` with `MultipleNegativesRankingLoss`
- [ ] Evaluate on benchmark; ablate random vs. hard negatives
- [ ] Cross-lingual alignment audit: plot cosine similarity distribution for IT↔EN pairs, pre/post fine-tuning

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

- [ ] UMAP of verse embeddings colored by Canticle, then by Canto — do embeddings reflect the poem's structure?
- [ ] Retrieval score calibration: plot score vs. precision; apply temperature scaling if needed
- [ ] Interactive Hugging Face Space demo

**Deliverable:** UMAP plots; calibration analysis; public demo

---

## 8. Infrastructure

| Layer | Tool | Notes |
|-------|------|-------|
| Training | `sentence-transformers` | Native support for contrastive losses and bi-encoder training |
| Experiment tracking | MLflow | Already in use; track loss, retrieval metrics per checkpoint |
| ANN index | FAISS `IndexFlatIP` | Exact search sufficient at 14K vectors; upgradeable to `IVF` if corpus grows |
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

---

## 10. Open Questions

- [ ] **Canto-level vs. verse-level retrieval:** Should the retrieval unit be a single verse (11 syllables, ~8 words) or a full terzina (3 verses, ABA rhyme scheme)? Terzine are the natural semantic unit but make retrieval granularity coarser.
- [ ] **Archaic vocabulary handling:** Medieval Florentine has significant lexical drift from modern Italian. Does `multilingual-e5-large` handle this well zero-shot, or is tokenization fragmentation a problem? Needs early empirical check.
- [ ] **Commentary inclusion:** Should translator commentary (Hollander's notes are extensive) be included in the retrieval index as additional signal, or kept separate to avoid conflating primary text with interpretation?
- [ ] **Cross-encoder training:** Fine-tune the reranker on this corpus, or use the multilingual reranker zero-shot? Training data for reranking is harder to construct (requires graded relevance, not binary positives).
- [ ] **Thematic query evaluation:** Graded relevance (1–3 scale) for thematic queries requires human judgment. Who judges, and what is the annotation protocol?

---

## 11. Connections to Existing Work

| This project | Prior work on this site |
|---|---|
| Embedding calibration: retrieval score vs. precision | MNIST calibration (ECE, calibration curves) |
| UMAP of verse embeddings | UMAP of penultimate features in bear detector |
| MLflow experiment tracking for training runs | MNIST MLflow project |
| Ablation-driven evaluation | Structure-vs-recall: logit lens, patching, DLA |
| Hard negative mining as a form of hard case analysis | OOD detection: near-OOD as hard boundary cases |

---

*This document is a living design reference. Sections marked with open checkboxes are unresolved. Completed phases will be annotated with results links.*
