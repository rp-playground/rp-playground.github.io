---
layout: article
title: "A GPT-2 you can interrogate"
description: Reimplementing GPT-2 small from scratch and turning each architectural claim — residual stream, QK/OV, position-wise MLPs, LayerNorm folding — into a test that runs against the real pretrained weights.
summary: I reimplement GPT-2 small from scratch and turn each fact about the architecture into a test that passes or fails against the real weights — claim = test.
date: 2026-06-16
tags: [transformers, GPT-2, mechanistic-interpretability, architecture]
---

*This is the first half of the [`transformer-anatomy`](#why-this-shape) project:
the model laid out, with each architectural claim written as a test that can fail.
The runnable repo — every test wired to the real GPT-2 weights, with the figures it
produces — comes next. The numbers and plots are not here yet; nothing below is a
measured result I'm reporting.*

Most write-ups about transformers state the architecture and move on: the residual
stream is a communication channel, attention moves information between positions,
MLPs act per-position. Those are all correct, and I wanted a way to back each one
rather than repeat it. So I used the same habit I built into
[kaggle-lab](/writing/kaggle-lab/): state a claim, then make it a test that passes
or fails against the real model. For "attention is the only thing that moves
information sideways", the test is to delete attention and check whether information
can still cross positions.

The substrate is **GPT-2 small**, reimplemented from scratch in PyTorch and then
loaded with the real pretrained weights. Reusing the weights gives me the strongest
correctness check available. To make my logits match Hugging Face's to floating-point
noise, I have to get every detail right, including the ones people quietly get wrong.

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

Two properties of that snippet drive the whole project, and both are testable. The
residual stream is additive, so every sub-layer contributes a vector you can isolate;
and attention is the only term that reads across positions. Each claim below pins one
of these to an experiment.

## Claim 0 — it matches the real thing

> **Test:** load the pretrained GPT-2 weights into my from-scratch module and assert
> `max |logits_mine − logits_HF| < 1e-4` on a batch of real text.

This is the load-bearing test. If it passes, I built the architecture rather than
something close to it. The details that decide it are the ones that show whether you
understand the model:

- **`Conv1D`, not `Linear`.** Hugging Face's GPT-2 stores every projection as a
  `Conv1D` whose weight is `[in, out]` (it computes `x @ W + b`), the transpose of
  `nn.Linear`'s `[out, in]`. Forget the transpose and the shapes still line up while
  the numbers are wrong.
- **Fused QKV.** `c_attn` is a single `[768, 2304]` matrix; Q, K, V are slices of it,
  not three separate parameters.
- **The GELU variant.** GPT-2 uses the `tanh` approximation, not the exact `erf`
  GELU. The gap is small enough to pass a loose tolerance and fail a tight one, which
  makes the tolerance a good check on whether the implementation is right rather than
  only close.
- **Tied unembedding.** The output projection *is* the token-embedding matrix
  transposed; there is no separate `W_U` to load.

Once Claim 0 passes, every later claim is an intervention on the real GPT-2 rather
than on a lookalike.

## Claim 1 — the residual stream is the channel

> **Test (logit lens):** at each layer, decode the residual stream *as if it were
> final* — `softmax(W_U · ln_f(resid_ℓ))` — and watch the distribution converge
> toward the model's actual output.

If the residual stream really is one running "current best guess" that each layer
edits, then decoding it early should already be meaningful, and should sharpen with
depth. The figure it produces is the analogue of the **complexity ladder** in my
[MNIST calibration](/writing/mnist-calibration/) piece, with KL-to-final dropping at
each layer.

```python
def logit_lens(resid_by_layer):          # list of [seq, d_model], one per layer
    return [softmax(unembed(ln_f(r))) for r in resid_by_layer]
```

The complement is **direct logit attribution**. Because the stream is additive, the
final logit for a token is the sum of dot products between the unembedding direction
and each component's write, so I can ask not just when the answer appears but which
head or MLP wrote it, attributing each rung of the ladder to attention vs. MLP. The
logit lens is nostalgebraist's and the additive decomposition is from the
[*Mathematical Framework*](https://transformer-circuits.pub/2021/framework/index.html).
What I add is the framing: I treat the convergence curve as a claim about the residual
stream that the experiment can refute.

## Claim 2 — attention is the only thing that moves information sideways

> **Test:** perturb the token at position `i`. With attention intact, logits at
> positions `t > i` change. With attention ablated, they **do not** — the only path
> from `i` to `t` runs through attention.

Every tutorial states this one and stops there, and it is binary to check.
Embeddings, MLPs, LayerNorm, and the unembedding all act position-wise; the only
cross-position operation in the network is the attention pattern. Zero out the
attention sub-layer and the model becomes a set of independent per-position
pipelines, so an edit at `i` can no longer reach `t`. The downstream logits either
move or they don't.

## Claim 3 — QK chooses *where*, OV chooses *what*

> **Test:** decompose each head into its QK circuit (which positions it attends to)
> and its OV circuit (what it copies once it attends), and reproduce a known
> **induction head** in GPT-2 small.

A head factors into two independent circuits: `W_Q W_K^T` sets the attention
*pattern* (which positions it attends to), and `W_O W_V` sets the *content* written
once it attends (what to move). Induction heads are the clean demonstration: on a
repeated sequence `[A][B] … [A] → [B]`, the QK circuit attends from the current token
back to the token that *followed* the previous copy of it, and the OV circuit copies
that token forward. Olsson et al. (2022) showed the minimal two-layer mechanism (a
previous-token head feeding an induction head); the behaviour is documented around
**layer 5** in GPT-2 small. The test is to find it and show the QK pattern and the OV
copy-map separately, which confirms the factorization rather than describing it.

## Claim 4 — MLPs and LayerNorm are position-wise

> **Test:** permute the positions of a sequence; the MLP (and LayerNorm) output must
> permute *identically* — `mlp(P·x) == P·mlp(x)` to floating-point noise.

This is the mirror image of Claim 2. If a sub-layer is genuinely position-wise,
shuffling the sequence can only shuffle its output the same way, because there is
nothing to carry information between positions. Run the permutation through attention
and it fails, since attention mixes positions; run it through the MLP or a LayerNorm
and it holds exactly. The same test on the two sub-layers gives opposite results,
which is the clearest way I know to show what "acts on each position independently"
means.

## Claim 5 — positional embeddings carry the order

> **Test:** zero the learned positional embeddings (`wpe`) and measure loss on
> natural text and on an order-sensitive task; expect a sharp degradation.

GPT-2's only source of absolute order is the learned `wpe` table added at the input;
there are no rotary or sinusoidal positions. Delete it and the token content is
intact, but the model can no longer tell *the dog bit the man* from *the man bit the
dog*. It isn't a total collapse, because the causal mask still distinguishes
positions by how much context they see, and that partial degradation is what the test
measures rather than an all-or-nothing break.

## Claim 6 — LayerNorm folds away exactly

> **Test:** fold each LayerNorm's learned scale/shift into the following linear
> layer; assert the logits are unchanged (`< 1e-5`).

LayerNorm is `(x − mean) / std ⊙ γ + β`. The `γ` scale and `β` shift are linear and
are always followed by a linear map `W`, so they can be absorbed: `W (γ ⊙ x̂) =
(W · diag(γ)) x̂`. Folding them in leaves a parameter-free `LayerNormPre` and an
adjusted `W`, and the output stays identical down to rounding. TransformerLens does
this so the only nonlinearity left in LayerNorm is the normalization itself. It also
works as a second correctness check: if folding moves the logits, the algebra was
wrong.

## Reproduce it (planned interface)

Each claim is one script, so the suite reads like the section list above:

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
paragraph; it is the most-rebuilt project there is. What makes this version mine is
the framing carried over from [kaggle-lab](/projects/kaggle-lab/), where every
architectural fact is wired to an experiment that the real GPT-2 either confirms or
contradicts. Reusing the pretrained weights makes those contradictions sharp, because
there is a ground truth to miss. The next step is the interpretability work Neel
Nanda's guide points at: once you can interrogate the architecture this way, you can
start asking what specific circuits inside it compute.

---

### References

- Radford et al. (2019). *Language Models are Unsupervised Multitask Learners* (GPT-2).
- Elhage et al. (2021). *[A Mathematical Framework for Transformer
  Circuits](https://transformer-circuits.pub/2021/framework/index.html).*
- nostalgebraist (2020). *Interpreting GPT: the Logit Lens.*
- Olsson et al. (2022). *In-context Learning and Induction Heads.*
- Nanda. *How to Become a Mechanistic Interpretability Researcher* — the
  ML/transformer-basics section this project answers.
