---
layout: reference
title: "Transformers — A Telling to Myself"
description: A living reference for the transformer architecture, explained back to myself — searchable, modular, and built to grow.
summary: A working reference for the transformer architecture, in the voice of explaining it back to myself. Searchable and modular, with formulas that carry explicit dimensions so any piece lifts out without re-deriving the rest.
date: 2026-06-19
tags: [transformers, attention, mech-interp, reference]
permalink: /writing/transformers/
---

A working reference for the transformer architecture, written in the voice of explaining it back
to myself. Built to be **searched, extended, and modified** — not read once. Sections are
modular; formulas carry explicit dimensions so any single piece can be lifted out without
re-deriving the rest.

> **Notation.** Math is typeset with KaTeX. Dimensions are explicit: $$\times$$ is a dimension
> product, $$\cdot$$ a matrix/scalar product, $$^{\top}$$ transpose, $$x_{i}$$ a subscript,
> $$\sqrt{\,\cdot\,}$$ a square root, $$\sum_j$$ a sum over $$j$$, and $$\mathbb{R}^{a\times b}$$
> the real matrices of that shape. Symbols are defined in §2.

## How to use this file

- **Conventions (read once).**
  - $$T$$ = `num_tokens` = sequence length. I use $$T$$ in formulas and `num_tokens` in prose.
  - **Row convention everywhere:** $$X$$ is $$T \times d$$, and projections are *right*-multiplies,
    $$Q = X\cdot W_Q$$. The one place this matters is multi-head (§3.7), where the circuits image uses
    the *column* convention ($$W\cdot x$$, vectors stacked vertically). They are transposes of each
    other; I flag the switch where it happens.
  - $$d_e$$ = embedding / model width (the residual-stream width, a.k.a. $$d_{\mathrm{model}}$$).
- **Greppable markers** (search these to navigate the living parts):
  - `[OPEN]` — a question or thing to verify.
  - `[STUB]` — section is thin on purpose; expand later.
  - `[EXT]` — a hook where attached / future material plugs in.
- **Two reference models** — the 2017 paper and GPT-2 small. Their specs differ and are easy to
  conflate; §2 pins down both.

---

## 1. What a transformer does (the big picture)

A transformer maps a sequence of tokens to a sequence of **next-token probability
distributions**. Given `num_tokens` tokens in, it produces `num_tokens` distributions out — one
per position, each over the vocabulary. To generate, take the distribution at the **last**
position and pick a token from it: `argmax` gives the single most likely token (**greedy
decoding**); more commonly one **samples** from the distribution (temperature, top-`k`, top-`p`).
The chosen token is appended to the input and the model runs again.

This is what **autoregressive** means:

$$ x_{t+1} = f(x_1, x_2, \ldots, x_t) $$

The next token conditions on the **entire prefix** — that is the whole point of attention.

> **The question I keep returning to:** if only the last position's distribution is needed to
> generate the next token, why compute a distribution at *every* position? It looks inefficient.
> — Resolved in §4, once the causal mask and the train/inference split are on the table.

---

## 2. Notation and dimensions

| Symbol | Meaning | Typical shape / value |
|---|---|---|
| $$T$$ | sequence length (`num_tokens`) | — |
| $$d_e$$ / $$d_{\mathrm{model}}$$ | embedding & residual-stream width | 512 (paper) · 768 (GPT-2 small) |
| $$X$$ | token representations entering a block | $$T \times d_e$$ |
| $$W_Q, W_K$$ | query / key projections | $$d_e \times d_q$$, $$d_e \times d_k$$ |
| $$W_V$$ | value projection | $$d_e \times d_v$$ |
| $$Q, K$$ | queries, keys | $$T \times d_q$$, $$T \times d_k$$ (with $$d_k = d_q$$) |
| $$V$$ | values | $$T \times d_v$$ |
| $$W_O$$ | output / mixing projection (multi-head) | $$(h\cdot d_v) \times d_e$$ |
| $$h$$ | number of attention heads | 8 (paper) · 12 (GPT-2 small) |
| $$L$$ | number of blocks (layers) | 6 (paper) · 12 (GPT-2 small) |
| $$d_{ff}$$ | MLP hidden width | 2048 (paper) · 3072 (GPT-2 small) |

**Per-model specs:**

- **Vaswani et al. 2017 (base):** $$L = 6$$ encoder + $$6$$ decoder blocks, $$h = 8$$ heads,
  $$d_{\mathrm{model}} = 512$$, $$d_{ff} = 2048$$, $$d_k = d_v = 64$$. **Sinusoidal** (fixed) positional encoding.
  **Post-LN** (LayerNorm after the residual add).
- **GPT-2 small:** $$L = 12$$ blocks, $$h = 12$$ heads, $$d_{\mathrm{model}} = 768$$, head dim $$= 64$$,
  context `1024`, vocab `50257`. **Learned absolute** position embeddings. **Pre-LN**
  (LayerNorm before each sublayer) plus a final LayerNorm.

**Invariant:** the standard choice is $$d_v = d_e / h$$, so concatenating $$h$$ heads lands back at
exactly $$d_e$$ and the residual-stream width never changes. (Head dim is 64 in both models above —
$$768/12 = 512/8 = 64$$.)

---

## 3. The forward pass, end to end

The spine. Each subsection is one stage; the residual stream (§3.3) is the thread running through
all of them.

### 3.1 Embedding

Each token id is mapped to a vector of width $$d_e$$ via a lookup table. Stacking them makes the
sequence a matrix $$X \in \mathbb{R}^{T \times d_e}$$.

### 3.2 Positional encoding

A position signal of the same width $$d_e$$ is **added** to each token embedding (dimension stays
$$d_e$$). The encoding is **absolute** — a vector per position index. In the original paper it is
**sinusoidal** (fixed); in GPT-2 it is a **learned** trainable vector per slot.

> A separate family — Shaw et al., Transformer-XL, RoPE — encodes **relative** position directly
> into the attention *scores* instead. Different mechanism; worth knowing as the real alternative.

**Why a position signal is needed:** self-attention is **permutation-equivariant** — permute the
input tokens and the outputs permute identically ($$\mathrm{Attn}(P\cdot X) = P\cdot \mathrm{Attn}(X)$$). The computation has no
built-in notion of order, so without a position signal the model sees a **bag of tokens**. The
position signal breaks that symmetry and lets order carry meaning.

### 3.3 Blocks and the residual stream

Multiple identical blocks are stacked ($$L$$ of them). **The residual stream is the backbone** — a
$$d_e$$-wide channel that runs *unbroken* from the embeddings to the final unembedding.

Each sublayer **reads** from the stream, computes something, and **adds** its contribution back
in — it does not replace the stream. In GPT-2 (pre-LN) one block is:

$$
\begin{aligned}
x &\leftarrow x + \mathrm{Attn}(\mathrm{LN}(x)) \\
x &\leftarrow x + \mathrm{MLP}(\mathrm{LN}(x))
\end{aligned}
$$

Information is *accumulated* additively along the stream rather than transformed in place. This
additive read/write-into-a-shared-channel picture is the framing the circuits literature builds
on, so it is worth holding from the start.

### 3.4 Inside attention: Q, K, V

The matrix $$X$$ ($$T \times d_e$$) enters the self-attention sublayer. Three linear projections:

$$ Q = X\cdot W_Q \qquad K = X\cdot W_K \qquad V = X\cdot W_V $$

$$
\begin{aligned}
Q &: (T \times d_e)(d_e \times d_q) = T \times d_q \\
K &: T \times d_k \quad (d_k = d_q,\ \text{required for the dot product to typecheck}) \\
V &: T \times d_v
\end{aligned}
$$

**Roles.** All three are the same kind of object — a learned linear projection of the same
residual stream — but they play different parts. For a **destination** position, the **query**
$$q_i$$ encodes *what information am I looking for*; for a **source** position, the **key** $$k_j$$
encodes *what do I have to offer*, and the **value** $$v_j$$ is the *payload* that actually gets
moved if the match is good. Attention is then a **soft dictionary lookup**: match each query
against every key, then take a weighted blend of the corresponding values. The query and key
*look* interchangeable because $$W_Q$$ and $$W_K$$ are built alike — but they are not; why is §5.1.

### 3.5 Scaled dot-product + causal mask + softmax

**Scores** are the scaled dot product of queries against keys:

$$ Q\cdot K^{\top} / \sqrt{d_k} \;\in\; \mathbb{R}^{T \times T} $$

Entry $$(i, j)$$ is how much position $$i$$ attends to position $$j$$. The $$\sqrt{d_k}$$ keeps the dot
products from growing with dimension (which would saturate the softmax).

**The causal mask.** In a GPT-style (decoder-only) model, *before* the softmax a mask sets the
strictly-upper-triangular entries to $$-\infty$$, so token $$i$$ attends only to tokens $$\le i$$. The full
operation:

$$ \mathrm{Attn}(X) = \mathrm{softmax}\!\left( \mathrm{mask}\!\left( Q\cdot K^{\top} / \sqrt{d_k} \right) \right) \cdot V $$

Softmax is applied **row-wise** (over keys), turning each row into a set of weights that mix the
value vectors. Output shape:

$$ (T \times T)(T \times d_v) = T \times d_v $$

Reference implementation (single head, generic):

```python
import torch, torch.nn.functional as F

def attention(Q, K, V, causal=True):
    # Q, K: (..., T, d_k)   V: (..., T, d_v)
    d_k = Q.size(-1)
    scores = Q @ K.transpose(-2, -1) / d_k ** 0.5          # (..., T, T)
    if causal:
        T = scores.size(-1)
        future = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
        scores = scores.masked_fill(future, float("-inf"))  # block j > i
    weights = F.softmax(scores, dim=-1)                     # rows sum to 1
    return weights @ V                                      # (..., T, d_v)
```

#### 3.5.1 Naming & TransformerLens hooks

**The row-wise softmax, precisely.** For destination $$i$$, softmax runs over source positions
$$j \le i$$ — the prior tokens **and $$i$$ itself** ($$j = i$$ is on the diagonal, not above it, so the
causal mask keeps it). Each row is a distribution over $$[0..i]$$ summing to 1, and the full matrix
is **lower-triangular** (zeros strictly above the diagonal). Consequence: a token can always
attend to itself, and position 0 has nothing else to attend to — so row 0 is forced to $$1.0$$ on
the diagonal.

**Terminology — not all the same object.** It's worth keeping three of these apart:

- **Attention pattern = attention weights = $$A_{ij}$$** — the **post-softmax** $$T \times T$$ matrix, row $$i$$
  a distribution over sources. *These three names are genuinely synonyms.*
- **Self-attention** names the whole **sublayer/operation** — Q, K, V, the softmax, *and* the
  value-weighted sum $$A\cdot V$$ plus the output projection. "Self" = Q, K, V all come from the same
  sequence (vs cross-attention). **Not** a synonym for the weight matrix.
- **"Attention"** bare is ambiguous (sublayer, weights, or the output $$\sum_j A_{ij} v_j$$ depending on
  the writer) — avoid treating it as a label for the pattern.

**TransformerLens hooks** (shapes `[batch, head, query_pos, key_pos]` for the $$T \times T$$ ones):

| Hook | What it is | Formula |
| --- | --- | --- |
| `hook_attn_scores` | pre-softmax logits, causal-masked (masked entries $$\approx -\infty$$ here) | $$Q\cdot K^{\top}/\sqrt{d_k}$$ |
| `hook_pattern` | post-softmax — the distribution above; TL's "pattern" | $$A_{ij}$$ |
| `hook_z` | value-weighted sum (TL's $$z$$ == $$r_i$$ from §3.6, pre-$$W_O$$) | $$z_i = \sum_j A_{ij}\cdot v_j$$ |
| `hook_result` | per-head output — the residual-stream write (needs `use_attn_result=True`; memory-heavy, off by default) | $$z_i \cdot W_O$$ |

So the precise statement: softmax is applied **row-wise over `hook_attn_scores` along the
`key_pos` axis** (masked to $$j \le i$$) to produce `hook_pattern`. The pipeline is
$$\mathrm{scores} \to \mathrm{pattern} \to z \to \mathrm{result}$$, which maps onto §3.6 as
$$(Q\cdot K^{\top}/\sqrt{d_k}) \to A_{ij} \to r_i \to r_i\cdot W_O$$.

### 3.6 What an attention head does (positions, not tokens)

**Attention is the only component that moves information between positions.** The MLP, the
LayerNorms, the embedding and unembedding are all *position-wise* — they act on each position's
residual vector in isolation, with no reference to any other position. So any cross-token
dependency, anywhere in the network, must travel through an attention head. And unlike the MLP's
fixed linear map, an attention pattern is **data-dependent**: it is computed from the residual
content at runtime, so the routing is decided per input.

**Per-position view.** For a destination position $$i$$, the head's result vector is:

$$
\begin{aligned}
A_{ij} &= \mathrm{softmax}_{j \le i}\!\left( (x_i \cdot W_Q \cdot W_K^{\top} \cdot x_j^{\top}) / \sqrt{d_k} \right) \\
v_j &= x_j \cdot W_V \\
r_i &= \sum_j A_{ij} \cdot v_j \quad \in \mathbb{R}^{1 \times d_v}
\end{aligned}
$$

This is the per-position (row $$i$$) view of the matrix form in §3.5: $$A$$ is $$T \times T$$, $$v_j$$ is row
$$j$$ of $$V = X\cdot W_V$$, and $$r_i$$ is row $$i$$ of $$r = A\cdot V$$. The $$j \le i$$ on the softmax is the causal
mask. Afterward $$W_O$$ maps $$r_i$$ to width $$d_e$$ and **adds** $$r_i\cdot W_O$$ into the residual stream
(§3.7).

**Positions, not tokens.** A position is *not* its token. It starts as (token embedding +
position) but after a few attention layers it has accumulated information from across the
sequence. A head moves whatever is *currently* sitting at the source position — by mid-network, a
rich aggregate, not a lexical item. And what it moves are **features** (directions in residual
space), which can be abstract and relational rather than copies of tokens. A head can carry the
feature "this position is the final token of the sentence's subject" while carrying nothing about
*which* subject or *which* token.

**Two computations.** A head factors into *how much* to move — the pattern $$A_{ij}$$, from
$$W_Q, W_K$$ — and *what* to move — the value/output path, from $$W_V, W_O$$. Separate-ish parameters
and activations; the full factorization is §5.

### 3.7 Multi-head: concatenate ≡ additive

Each of the $$h$$ heads produces its own $$T \times d_v$$ output. The standard description
**concatenates** the per-head outputs along the feature axis into $$T \times (h\cdot d_v)$$, then applies one
output projection $$W_O$$ of shape $$(h\cdot d_v) \times d_e$$ to map back to $$d_e$$. With $$d_v = d_e/h$$ this
lands exactly at $$d_e$$. Heads **specialize** — each writes a different contribution into the
stream.

The **circuits** view shows the deeper structure: split $$W_O$$ into one block per head and the
layer output is a **sum of independent per-head writes**. In the image's column convention
($$r^h$$ = head $$h$$'s result vector at a position):

$$
W_O \cdot \begin{bmatrix} r^{h_1} \\ r^{h_2} \\ \vdots \end{bmatrix}
= \begin{bmatrix} W_O^{h_1} & W_O^{h_2} & \cdots \end{bmatrix} \cdot \begin{bmatrix} r^{h_1} \\ r^{h_2} \\ \vdots \end{bmatrix}
= \sum_i W_O^{h_i} \cdot r^{h_i}
$$

> **Convention note** (per §2): the image left-multiplies column vectors, so $$W_O$$ is
> $$d_e \times (h\cdot d_v)$$ and each $$W_O^{h_i}$$ is a $$d_e \times d_v$$ *column-block*. In the row convention this is
> $$\mathrm{Concat}(\ldots)\cdot W_O = \sum_i (\mathrm{head}_i)\cdot W_O^{h_i}$$ with $$W_O$$ row-block-split — same map, transposed.

So **"concatenate then $$W_O$$" equals "give each head its own $$W_O^h$$, lift its result to $$d_e$$,
and add it into the residual stream."** Concatenation is the compute-efficient form (one big
matmul instead of $$h$$ small ones); the **additive per-head** form is the one to reason with.

This is the residual-stream picture one level down: heads in a layer **do not interact** except
through what they each independently write back, and the layer's contribution is their sum.
Conceptually, each head writes its own $$d_e$$-dimensional vector into the stream — "concatenation"
is just the efficient packaging of that.

### 3.8 The MLP sublayer  [STUB]

After attention, the (pre-LN'd) stream passes through a position-wise MLP whose output is
**added** back into the stream (§3.3). Standard form: two linear layers with a nonlinearity,
widening to $$d_{ff}$$ and back —

$$ \mathrm{MLP}(x) = W_2 \cdot \sigma(W_1\cdot x + b_1) + b_2 \qquad W_1: d_e \to d_{ff},\ \ W_2: d_{ff} \to d_e $$

with $$\sigma = \mathrm{GELU}$$ in GPT-2, $$d_{ff} = 4\cdot d_e = 3072$$. Applied **independently per position** —
attention mixes across positions, the MLP mixes across *features*. [EXT] Expand with the
"MLP-as-key-value-memory" reading and feature/neuron notes for the interp project.

### 3.9 LayerNorm placement (pre-LN vs post-LN)

- **Post-LN** (original 2017): $$x \leftarrow \mathrm{LN}(x + \mathrm{Sublayer}(x))$$ — norm *after* the add.
- **Pre-LN** (GPT-2): $$x \leftarrow x + \mathrm{Sublayer}(\mathrm{LN}(x))$$ — norm on the *input* to the sublayer, leaving the
  residual path clean, plus a **final LayerNorm** after the last block. Pre-LN trains stably at
  depth, which is why GPT-2 and most successors use it.

### 3.10 Unembedding → logits

The final stream (after the last LayerNorm) is projected to vocabulary size — the **unembedding**
— giving logits; softmax over the vocab gives the per-position distributions from §1. In GPT-2 the
unembedding is **tied** to the input embedding matrix (weights shared).

---

## 4. The efficiency question, resolved

Returning to §1: *why compute a distribution at every position when only the last is needed?*

**Causality comes from the mask** (§3.5), an *architectural* choice. With it, the prediction at
**every** position $$i$$ depends only on tokens $$\le i$$, with no leakage from the future — so every
position is simultaneously a valid next-token problem.

**At training time, the all-position computation is the point, not waste.** One forward pass over
a length-$$T$$ sequence yields $$T$$ next-token predictions and $$T$$ loss terms at once. That
parallelism across positions is the main thing a transformer has over an RNN (which must unroll
step by step). Computing all $$T$$ distributions is **$$T$$ supervised signals per sequence**.

**At inference time, only the last position matters — and good implementations don't compute the
rest:**

- Earlier hidden states are still computed, because the last token attends to them as **keys and
  values** — but the **vocab/logit projection** is applied **only to the last position**.
- A **KV cache** stores each position's $$K$$ and $$V$$ once. Each new token then computes $$Q, K, V$$
  for *just that one token* against the cached keys/values — roughly $$O(T)$$ per step instead of
  re-running the whole sequence ($$O(T^2)$$).

**Train:** all positions, on purpose. **Infer:** last-position logits + KV cache.

---

## 5. Where this goes — interpretability hooks  [EXT]

Forward pointers for the mech-interp side.

- **Residual stream as the object of study.** Because every sublayer reads/writes additively
  (§3.3, §3.7), the stream is a *linear* sum of contributions — which is what makes terms
  attributable to specific heads/MLPs, the basis for the circuits program.

### 5.1 OV and QK circuits

The "two computations" of §3.6 become two matrices once you fuse the projection pairs.

**QK circuit — *where* to attend.** The score is the query–key dot product, and by associativity
the two projections collapse into one operator:

$$ s_{ij} = q_i \cdot k_j = (x_i\cdot W_Q)(x_j\cdot W_K)^{\top} = x_i \cdot \underbrace{(W_Q\cdot W_K^{\top})}_{d_e \times d_e} \cdot x_j^{\top} $$

So the logit is a **bilinear** function of the pair $$(x_i, x_j)$$ with the head's parameters fused
into a single $$d_e \times d_e$$ operator $$W_Q\cdot W_K^{\top}$$ — the **QK circuit**. ($$Q$$ and $$K$$ haven't
vanished; they're absorbed. The composition only typechecks because $$d_q = d_k$$, §3.4.) Through a
masked softmax this produces the pattern $$A_{ij}$$.

**OV circuit — *what* to move.** The value-write path of one head is $$x_j \cdot W_V \cdot W_O^h$$, a single
linear map $$W_V\cdot W_O^h$$ (the **OV circuit**, $$d_e \times d_e$$) applied to each source position's content
*identically, regardless of where it is read from or written to*. The OV circuit is
**position-blind**: it knows only "given this residual content, write this." All the
position/relevance logic lives in QK; all the content transformation lives in OV; the head's write
is the pattern-weighted sum of OV-transformed source content, $$\sum_j A_{ij} \cdot (x_j\cdot W_V\cdot W_O^h)$$.

**Why query ≠ key (the asymmetry).** $$Q$$ and $$K$$ are symmetric only in *construction* — same kind
of projection, same shape — not in *role*. The operative object $$M = W_Q\cdot W_K^{\top}$$ is **not** a
symmetric matrix (no reason it equals $$W_K\cdot W_Q^{\top}$$), so $$s_{ij} \ne s_{ji}$$: how much $$i$$ attends to $$j$$
differs from how much $$j$$ attends to $$i$$, and the attention matrix is asymmetric even before the
causal mask. The asymmetry lives in *which position enters through which matrix* — the
**destination** always goes through $$W_Q$$ ("what am I looking for"), the **source** through $$W_K$$
("what do I advertise") — and the softmax normalizes over keys *for a fixed query*: one asker,
many candidates competing. The source side also carries the **value** that flows source →
destination; the destination carries only the query. None of that placement is symmetric.

The clean way to see why untying matters — tie $$W_Q = W_K = W$$. Then $$M = W\cdot W^{\top}$$ *is* symmetric,
$$s_{ij} = s_{ji}$$, and (pre-mask) attention becomes **mutual**: $$i$$ attends to $$j$$ exactly as much as
the reverse. Keeping the two projections separate is precisely what buys **directional** attention
in content space — a token's query can look for property $$P$$ while its own key advertises property
$$Q$$. The induction head (§5.2) is the sharp case: the query asks "what followed the previous copy of
me?" while a candidate's key advertises "I'm preceded by token X." Genuinely different functions
of the same residual content; the head works only because $$W_Q$$ and $$W_K$$ are allowed to disagree.
So the only real symmetry is that the dot product $$q\cdot k$$ is a symmetric *operation* on its two
arguments — but $$q_i$$ and $$k_j$$ are not interchangeable arguments, so that symmetry never reaches
the mechanism.

**The "separate-ish" caveat.** The parameters genuinely are separable — $$\{W_Q, W_K\}$$ vs
$$\{W_V, W_O\}$$ — so each circuit can be read off independently, which is what lets you analyze
*where* a head attends apart from *what* it does. But they are not fully decoupled. The *logit*
$$s_{ij}$$ is pairwise in $$(x_i, x_j)$$; the *weight* is not:

$$ A_{ij} = \exp(s_{ij}) / \sum_{j'} \exp(s_{ij'}) $$

The denominator runs over the whole (masked) row, so $$A_{ij}$$ depends on $$x_i$$ and the *entire set*
$$\{x_{j'}\}$$ for $$j' \le i$$. The pattern is not separable into independent pairwise pieces: perturb one
source position's content and every weight in that row shifts, even with $$x_i$$ and the other
sources fixed.

### 5.2 Worked example — induction head

The canonical case where the factorization pays off: an induction head's **QK circuit** implements
"attend to the token that followed the previous occurrence of the current token," and its **OV
circuit** copies that token forward. The two halves are identified and studied separately.

[EXT] The routing (QK) vs content (OV) split is the natural lens for the recall regime — QK
decides *which* source position holds the fact, OV decides *what feature* is written to the query
position. Keep the mapping to specific suppression experiments loose: intervening on a
residual-stream feature touches both what downstream QK reads *and* what OV already wrote (and, via
5.1's caveat, shifts the whole attention row), so a single intervention is not a clean cut through
one circuit.

> Exact transpose/index conventions vary by source; pin them to Elhage et al. before relying on
> them.

---

## 6. Sources

- Vaswani et al., *Attention Is All You Need* (2017) — base architecture, sinusoidal PE, post-LN.
- Radford et al., *Language Models are Unsupervised Multitask Learners* (GPT-2, 2019) — pre-LN,
  learned absolute PE, tied embeddings, the 12/12/768 small config.
- Elhage et al., *A Mathematical Framework for Transformer Circuits* (Anthropic, 2021) — residual
  stream, the concatenate≡additive identity, OV/QK circuits.
- Shaw et al. (relative position), Transformer-XL, RoPE — the relative-position family (§3.2).

---

## 7. To extend  [EXT]

Plug-in point for additional material. Candidate homes: deeper MLP treatment → §3.8; OV/QK
extensions → §5; anything empirical / GPT-2-small-specific → **§8 Experiments** (now seeded
with the §1 run). Still to add there: cross-links from my `SelfAttention` implementation back
to §3.5–3.7.

---

## 8. Experiments — §1, measured

Running the §1 claims on **GPT-2 small**; the prompt is `"The capital of France is"`.

```python
prompt = "The capital of France is"

# [A] one distribution per position
show_per_position_distributions(prompt)

# [B] the LAST position's distribution -> the next token, under several strategies
last_logits = model(model.to_tokens(prompt))[0, -1]   # prediction for token AFTER prompt
print("\n[B] next token after the prompt, by decoding strategy:")
g = sample_next_token(last_logits, greedy=True)
print(f"    greedy (argmax)              -> {model.to_string(g.view(1))!r}")
torch.manual_seed(0)
for kw in (dict(temperature=0.7),
           dict(temperature=1.0, top_k=40),
           dict(temperature=1.0, top_p=0.9)):
    s = sample_next_token(last_logits, **kw)
    print(f"    sample {str(kw):34s} -> {model.to_string(s.view(1))!r}")

# [C] autoregressive generation (greedy is deterministic; sampling is not)
print("\n[C] greedy continuation:")
print("   ", generate(prompt, max_new_tokens=30, greedy=True))
torch.manual_seed(0)
print("    sampled continuation (T=0.8, top_p=0.95):")
print("   ", generate(prompt, max_new_tokens=30, temperature=0.8, top_p=0.95))

# [D] prefix dependence / causality
verify_prefix_dependence("The quick brown fox jumps over the lazy dog", cut=6)
```

Output:

```
[A] tokens  (in):  (1, 6)
    logits (out):  (1, 6, 50257)  -> one length-50257 distribution per position
    per-position greedy prediction  (prefix seen  ->  predicted next token):
      pos  0  '<|endoftext|>'                          -> '\n'
      pos  1  '<|endoftext|>The'                       -> ' first'
      pos  2  '<|endoftext|>The capital'               -> ' of'
      pos  3  '<|endoftext|>The capital of'            -> ' the'
      pos  4  '<|endoftext|>The capital of France'     -> ','
      pos  5  '<|endoftext|>The capital of France is'  -> ' now'

[B] next token after the prompt, by decoding strategy:
    greedy (argmax)              -> ' now'
    sample {'temperature': 0.7}                -> ' under'
    sample {'temperature': 1.0, 'top_k': 40}   -> ' on'
    sample {'temperature': 1.0, 'top_p': 0.9}  -> ' already'

[C] greedy continuation:
    <|endoftext|>The capital of France is now home to the world's largest concentration
    of the world's largest concentration of the world's largest concentration of the world's
    sampled continuation (T=0.8, top_p=0.95):
    <|endoftext|>The capital of France is under pressure to do something about a housing
    crisis caused by the soaring property price.

    The government on Wednesday announced a plan to build a 10-

[D] max |logit diff| at position 5, full-sequence run vs prefix-only run:  6.68e-06
    ~0  =>  appending future tokens never changes an earlier position's
    distribution  =>  x_{t+1} = f(x_1..x_t), not f of the whole sequence.
```

Reading the numbers back against §1:

- **[A] — "num_tokens in → num_tokens distributions out."** `(1, 6)` tokens → `(1, 6, 50257)`
  logits, one length-50257 distribution per position. The model is doing language modeling at *every* position, not just the end. At
  "The capital" it predicts `' of'`, at "The capital of" it predicts `' the'` (a fine guess —
  "of the" is more frequent than "of France"), at "The capital of France" it predicts `','`, and
  only at the full prompt does it commit to `' now'`. That last one is the single distribution
  generation actually consumes; the other five are the "wasted" ones.
- **[B] — same logits, different decode.** Greedy gives `' now'` — also what position 5 predicted
  in [A], confirming greedy = argmax of the last row. Temperature 0.7 → `' under'`, top-`k` →
  `' on'`, top-`p` → `' already'`: different strategies, different tokens, one logit vector.
- **[C] — the autoregressive loop, made visible.** Greedy collapses into "the world's largest
  concentration of the world's largest concentration of…" — degenerate repetition, which is
  exactly why [B] exists; the sampled run ("under pressure to do something
  about a housing crisis…") stays coherent. Greedy maximizes per-step probability and falls into
  a loop; sampling breaks the cycle. Empirical motivation for the temperature/top-`k`/top-`p`
  paragraph in §1.
- **[D] — causality, as a measured number.** Max $$|\Delta\,\text{logit}|$$ at position 5, between
  the full-sequence run and the prefix-only run, is `6.68e-06`. Position 5's distribution is
  bit-for-bit (to float32 noise) unchanged whether or not tokens 6+ exist — the empirical proof of
  $$x_{t+1} = f(x_1, x_2, \dots, x_t)$$.

GPT-2 small never lands on `' Paris'`. At 124M parameters, "The capital of France is now/under…"
is a fluent continuation it prefers over the factual completion: it **models the sentence rather
than recalling the fact** — bigger models recall it. [EXT] A hook for the recall-vs-reasoning
thread.
