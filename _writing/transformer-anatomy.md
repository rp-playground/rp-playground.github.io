---
layout: article
title: "A GPT-2 you can interrogate: the architecture, proven not asserted"
description: Reimplementing GPT-2 small from scratch and treating every architectural claim — residual stream, QK/OV, position-wise MLPs, LayerNorm folding — as a falsifiable test against the real model rather than a sentence in a tutorial.
summary: I reimplement GPT-2 small from scratch and turn each fact about the architecture into an experiment that passes or fails against the real weights — claim = test.
date: 2026-06-16
tags: [transformers, GPT-2, mechanistic-interpretability, architecture]
---

*This is the design-and-architecture half of the [`transformer-anatomy`](#why-this-shape)
project: the model laid out precisely, and each architectural claim written as a
falsifiable test. The runnable repo — every test wired to the real GPT-2 weights,
with the figures it produces — is the next installment. Numbers and plots land
when the code runs; nothing below is a measured result I'm reporting yet.*

Most "transformer explained" posts assert the architecture: *the residual stream is
a communication channel, attention moves information between positions, MLPs act
per-position.* All true — but asserted. The way I want to show I understand the
architecture is the same falsifiable habit I built into
[kaggle-lab](/writing/kaggle-lab/): **state a claim, then make it a test that passes
or fails against the real model.** Not "attention is the only thing that moves
information sideways" — *delete attention and watch the information fail to move.*

The substrate is **GPT-2 small**, reimplemented from scratch in PyTorch and then made
to load the real pretrained weights. Reusing the real weights isn't laziness — it's
the strongest correctness check I have. To make my logits match Hugging Face's to
floating-point noise, I have to get *every* detail right, including the ones people
quietly get wrong.

## The model in one screen

GPT-2 small is a decoder-only, pre-LayerNorm transformer:

| | |
|---|---|
| parameters | ~124M |
| blocks / heads | 12 / 12 |
| `d_model` | 768 |
| `d_head` | 64 (= 768 / 12) |
| `d_mlp` | 3072 (= 4 × 768) |
| context | 1024 tokens |
| vocab | 50257 (byte-level BPE) |
| activation | GELU, **tanh approximation** |
| positions | **learned** absolute embeddings (`wpe`) |
| embed ↔ unembed | **tied** (`W_U = W_E^T`) |

Everything happens on the **residual stream** — a `[seq, d_model]` tensor that each
block reads from and adds back to. The block is the whole architecture:

```python
def block(x):                    # x: [seq, d_model]
    x = x + attn(ln1(x))         # the only sub-layer that mixes across positions
    x = x + mlp(ln2(x))          # acts on each position independently
    return x
# ... then ln_f, then logits = (W_E.T) @ ln_f(x)   # unembed is the tied embedding
```

Two properties of that snippet are the whole point of the project, and both are
testable: the residual stream is **additive** (every sub-layer contributes a vector
you can isolate), and **attention is the only term that reads across positions**.
The claims below each pin one such property to an experiment.

## Claim 0 — it matches the real thing

> **Test:** load the pretrained GPT-2 weights into my from-scratch module and assert
> `max |logits_mine − logits_HF| < 1e-4` on a batch of real text.

This is the load-bearing test: if it passes, I implemented the architecture, not an
approximation of it. The details that make or break it are exactly the ones that
reveal whether you understand the model:

- **`Conv1D`, not `Linear`.** Hugging Face's GPT-2 stores every projection as a
  `Conv1D` whose weight is `[in, out]` (it computes `x @ W + b`), the transpose of
  `nn.Linear`'s `[out, in]`. Forget the transpose and the shapes still line up while
  the numbers are garbage.
- **Fused QKV.** `c_attn` is a single `[768, 2304]` matrix; Q, K, V are slices of it,
  not three separate parameters.
- **The GELU variant.** GPT-2 uses the `tanh` approximation, not the exact `erf`
  GELU. The gap is small enough to pass a loose tolerance and fail a tight one — a
  good tripwire for "looks right" vs. "is right."
- **Tied unembedding.** The output projection *is* the token-embedding matrix
  transposed; there is no separate `W_U` to load.

A passing Claim 0 is what licenses every claim after it: when I then ablate a
component, I'm intervening on the real GPT-2, not on a lookalike.

## Claim 1 — the residual stream is the channel

> **Test (logit lens):** at each layer, decode the residual stream *as if it were
> final* — `softmax(W_U · ln_f(resid_ℓ))` — and watch the distribution converge
> toward the model's actual output.

If the residual stream really is one running "current best guess" that each layer
edits, then decoding it early should already be meaningful, and should sharpen
monotonically with depth. The figure this produces is the analogue of the
**complexity ladder** in my [MNIST calibration](/writing/mnist-calibration/) piece —
depth as a refinement process, quantified as KL-to-final dropping rung by rung.

```python
def logit_lens(resid_by_layer):          # list of [seq, d_model], one per layer
    return [softmax(unembed(ln_f(r))) for r in resid_by_layer]
```

The complement is **direct logit attribution**: because the stream is additive, the
final logit for a token is the sum of dot products between the unembedding direction
and *each* component's write. So I can ask not just *when* the answer appears but
*which* head or MLP wrote it — attributing each rung of the ladder to attention vs.
MLP. The logit lens is nostalgebraist's; the additive decomposition is the
[*Mathematical Framework*](https://transformer-circuits.pub/2021/framework/index.html)'s.
My contribution is only the framing: convergence curve = falsifiable claim about the
residual stream, not a picture.

## Claim 2 — attention is the only thing that moves information sideways

> **Test:** perturb the token at position `i`. With attention intact, logits at
> positions `t > i` change. With attention ablated, they **do not** — the only path
> from `i` to `t` runs through attention.

This is the claim that's pure assertion in every tutorial, and it's binary to check.
Embeddings, MLPs, LayerNorm, and the unembedding all act position-wise; the single
cross-position operation in the whole network is the attention pattern. Zero out the
attention sub-layer and the model collapses into independent per-position pipelines,
so an edit at `i` can no longer reach `t`. Either the downstream logits move or they
don't — there's no room for a hedge.

## Claim 3 — QK chooses *where*, OV chooses *what*

> **Test:** decompose each head into its QK circuit (which positions it attends to)
> and its OV circuit (what it copies once it attends), and reproduce a known
> **induction head** in GPT-2 small.

A head factors into two independent circuits: `W_Q W_K^T` sets the attention
*pattern* (where to look), and `W_O W_V` sets the *content* written once you look
(what to move). Induction heads are the clean demonstration: on a repeated sequence
`[A][B] … [A] → [B]`, the QK circuit attends from the current token back to the token
that *followed* the previous copy of it, and the OV circuit copies that token
forward. Olsson et al. (2022) showed the minimal two-layer mechanism (a
previous-token head feeding an induction head); the behaviour is documented around
**layer 5** in GPT-2 small, so the test is to find it and show the QK pattern and the
OV copy-map separately — confirming the factorization rather than describing it.

## Claim 4 — MLPs and LayerNorm are position-wise

> **Test:** permute the positions of a sequence; the MLP (and LayerNorm) output must
> permute *identically* — `mlp(P·x) == P·mlp(x)` to floating-point noise.

The mirror image of Claim 2. If a sub-layer is genuinely position-wise, shuffling the
sequence can only shuffle its output the same way — there is no cross-talk to break.
Run the permutation through attention and it fails (attention is *not* equivariant
under arbitrary permutation; it mixes positions); run it through the MLP or a
LayerNorm and it holds exactly. Two sub-layers, one test, opposite results — which is
the cleanest way I know to *show* what "acts on each position independently" means.

## Claim 5 — positional embeddings carry the order

> **Test:** zero the learned positional embeddings (`wpe`) and measure loss on
> natural text and on an order-sensitive task; expect a sharp degradation.

GPT-2's only source of absolute order is the learned `wpe` table added at the input
(no rotary, no sinusoids). Delete it and the token content is intact but the model
can no longer tell *the dog bit the man* from *the man bit the dog*. The causal mask
still distinguishes positions by *how much context* they see, so it's not a total
collapse — which is itself the interesting, testable nuance, and a more honest claim
than "remove positions and it breaks."

## Claim 6 — LayerNorm folds away exactly

> **Test:** fold each LayerNorm's learned scale/shift into the following linear
> layer; assert the logits are unchanged (`< 1e-5`).

LayerNorm is `(x − mean) / std ⊙ γ + β`. The `γ` scale and `β` shift are linear and
are always followed by a linear map `W`, so they can be absorbed: `W (γ ⊙ x̂) =
(W · diag(γ)) x̂`. Folding them in leaves a parameter-free `LayerNormPre` and an
adjusted `W` — and the output must be *bit-for-bit* (to rounding) identical. It's the
trick TransformerLens uses so the only nonlinearity left in LayerNorm is the
normalization itself, and it doubles as a second correctness check: if folding moves
the logits, I got the algebra wrong.

## Reproduce it (planned interface)

Each claim is one script, so the test suite reads as the table of contents above:

```bash
python -m anatomy.validate          # Claim 0: my logits == HF, < 1e-4
python -m anatomy.logit_lens        # Claim 1: KL-to-final ladder + direct logit attribution
python -m anatomy.cross_position    # Claim 2: perturb pos i, attention on vs ablated
python -m anatomy.qk_ov             # Claim 3: QK pattern + OV copy-map for an induction head
python -m anatomy.position_wise     # Claim 4: permutation equivariance, MLP vs attention
python -m anatomy.positions         # Claim 5: zero wpe, loss delta
python -m anatomy.ln_folding        # Claim 6: fold LayerNorm, logits unchanged
```

<a id="why-this-shape"></a>

## Why this shape of project

I could have written a transformer from scratch and explained it paragraph by
paragraph — it's the most-rebuilt project there is. The part that's mine is the
falsifiable framing carried over from [kaggle-lab](/projects/kaggle-lab/): a claim I
can't test is just a sentence, so every architectural fact here is wired to an
experiment that the real GPT-2 either confirms or contradicts. Reusing the
pretrained weights makes the contradictions sharp — there's a ground truth to miss.
The natural next step is the interpretability one Neel Nanda's guide points at:
once you can *interrogate* the architecture, you can start asking what specific
circuits inside it are computing.

---

### References

- Radford et al. (2019). *Language Models are Unsupervised Multitask Learners* (GPT-2).
- Elhage et al. (2021). *[A Mathematical Framework for Transformer
  Circuits](https://transformer-circuits.pub/2021/framework/index.html).*
- nostalgebraist (2020). *Interpreting GPT: the Logit Lens.*
- Olsson et al. (2022). *In-context Learning and Induction Heads.*
- Nanda. *How to Become a Mechanistic Interpretability Researcher* — the
  ML/transformer-basics section this project answers.
