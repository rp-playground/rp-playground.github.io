# Semantic Search in Dante's Divine Comedy — Solution Design

> **Status:** Draft · **Version:** 0.4 · **Last updated:** 2026-06-28

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
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
```

### 3.1 Bi-Encoder (Dense Retrieval)

Encodes query and passages independently into a shared embedding space. At search time, retrieval is a cosine similarity lookup over the FAISS index. The bi-encoder is the component that will be **fine-tuned** on the parallel corpus.

**Index contents:** translations and paraphrases only. Each indexed document carries a `tercet_id` pointing back to the original. Multiple documents may share the same `tercet_id` (one per translation), so results are deduplicated by `tercet_id` before reranking — the highest-scoring representation per tercet is kept. The indexed corpus is thus ~14K–19K documents (4,740 tercets × 3–4 representations), still trivially small for FAISS.

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

Takes (query, passage) pairs as joint input and produces a scalar relevance score. Slower than the bi-encoder (cannot pre-index) but significantly more accurate. Applied only to the top-K shortlist after deduplication — one (query, best_translation) pair per candidate tercet.

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
| **Retrieval corpus** | Translations + paraphrases | Indexed in FAISS; what the bi-encoder searches over |
| **Display corpus** | Original Italian | Returned to the user via lookup after retrieval; never searched directly |
| **Lexical corpus** | Original Italian | Indexed in BM25 separately for Italian-language queries |

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
  └── [FAISS index] modern_paraphrase
        "I was halfway through my life and found myself lost in darkness."
```

### 5.1 Positive Pairs

Training pairs have a query on the left and an indexed document (translation or paraphrase) on the right. The original Italian appears only on the query side — as a source of fragment queries — not as a retrieval target.

- `(italian_fragment, translation_A)` — archaic fragment → indexed translation; trains the model to surface the right tercet from an Italian query
- `(translation_A, translation_B)` — cross-translation positives; aligns different renderings of the same tercet
- `(translation_A, modern_paraphrase)` — trains paraphrase robustness for thematic queries
- `(modern_query, translation_A)` — thematic query → relevant tercet (Phase 2 training data)

With ~4,740 tercets, 3 translations, and paraphrases, the retrieval corpus yields ~28,000 translation↔translation pairs automatically. Paraphrase pairs and Italian-fragment pairs add further signal; total approaches ~50K without manual annotation.

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
| ANN index | FAISS `IndexFlatIP` | ~14K–19K vectors (translations + paraphrases); exact search still fast at this size |
| Lookup table | Python dict / JSON | `tercet_id → original Italian`; loaded in memory at startup; trivial overhead |
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

**Why no stemmer for BM25, and why character n-grams?**
Standard Italian stemmers (Snowball) were designed for modern Italian morphology and produce incorrect stems on medieval Florentine. Not stemming is strictly better. Character 5-grams are added as supplementary tokens to handle the realistic failure modes for this track: archaic spelling variants (*diritta* vs. *dritta*), clitic compounds (*ritrovami*), and fragments a user half-remembers. Word unigrams retain exact-match precision for the common case; character n-grams provide fuzzy robustness for the edge cases. This is the same design used in production search engines (Elasticsearch's edge n-gram filter) for morphologically complex or domain-specific vocabularies.

**Why index translations instead of the original Italian?**
The original text is in medieval Florentine — a language with significant lexical and morphological distance from modern Italian. Pre-trained multilingual models tokenize it poorly: rare tokens, fragmented subwords, low-frequency embeddings. Indexing translations in modern English (and optionally modern Italian paraphrases) sidesteps this entirely: the model operates in a semantic space it was trained on. The original Italian is not lost — it is the displayed result, retrieved via a static lookup keyed on `tercet_id`. This separation of concerns (retrieval over modern representations, display of the original) is analogous to the *document expansion* paradigm in information retrieval, where corpora are enriched with generated text to improve retrieval coverage while the original document remains the authoritative output. The BM25 track over the original Italian handles the residual case of users querying with archaic Italian fragments directly.

---

## 10. Open Questions

- [x] **Retrieval unit:** Tercet (terzina). Verse-level alignment across translations is unreliable — translators shift line boundaries and semantic closure consistently falls at the three-line unit. Resolved in v0.2.
- [x] **Archaic vocabulary handling:** Resolved in v0.3. The FAISS index holds only modern-language representations; the archaic Italian is never embedded for retrieval. Residual Italian-query coverage is handled by BM25 over the original text.
- [ ] **Modern Italian paraphrases in the index:** Should the index include modern Italian paraphrases (not just English translations) to improve coverage of Italian-language queries? This would add a fourth representation per tercet (~19K total index documents) and improve recall for Italian users without touching the archaic text.
- [ ] **Deduplication strategy:** Multiple representations of the same tercet may rank differently; currently the highest-scoring representation is kept. Alternative: average pooling of all representation scores before deduplication. Needs empirical comparison.
- [ ] **Commentary inclusion:** Should translator commentary (Hollander's notes are extensive) be included in the retrieval index as additional signal, or kept separate to avoid conflating primary text with interpretation?
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
