---
layout: article
title: "Replicating a GPT-2 Transformer Block from the Residual Stream"
subtitle: "Rebuilding block 0 by hand and checking every tensor against TransformerLens"
description: "Rebuilding block 0 of GPT-2 by hand from the residual stream: recomputing LayerNorm, attention and the MLP from their parts and checking each step against TransformerLens's activation cache, all the way from token IDs to logits."
summary: "A hands-on tour of the mechanistic-interpretability tooling: reconstruct GPT-2's first transformer block from the residual stream, one variable per box in the dataflow diagram, and verify every arrow against the activation cache."
date: 2026-06-23
tags: [mech-interp, transformers, interpretability, GPT-2, TransformerLens]
published: true
permalink: /writing/replicating-gpt2-block/
---

This article rebuilds **block 0** of GPT-2 by hand: recomputing each step from its parts
and checking it against *TransformerLens*'s activation cache.
I wrote it to introduce myself to the tools available for doing mechanistic-interpretability:
reconstructing a block this way is a good way to learn what
each hook actually holds. It follows the dataflow diagram exactly:

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

```
        resid_pre              (hook_resid_pre)
           │
        ┌──┴── skip ──────────┐
        ▼                     │
       LN1  (ln1)             │
        │                     │
     Attention (attn)         │
        │                     │
   attn.hook_out              │
        ▼                     │
       ( + )◄─────────────────┘
        │
        resid_mid             (hook_resid_mid)
           │
        ┌──┴── skip ──────────┐
        ▼                     │
       LN2  (ln2)             │
        │                     │
   mlp.in.hook_in             │
        │                     │
       MLP  (mlp)             │
        │                     │
   mlp.hook_out               │
        ▼                     │
       ( + )◄─────────────────┘
        │
        resid_post            (hook_resid_post)
```

The two equations the diagram encodes (GPT-2 is **pre-norm**: each sub-block normalizes a *copy* of the residual and its output is *added back*):

```
resid_mid  = resid_pre + Attention( LN1(resid_pre) )
resid_post = resid_mid + MLP( LN2(resid_mid) )
```

Every Python variable below is named after a box in the diagram.

---

## 0. Setup

```python
import torch
import torch.nn.functional as F
from transformer_lens.model_bridge import TransformerBridge

s = "Hello world"
bridge = TransformerBridge.boot_transformers("gpt2", device="cpu")
logits, cache = bridge.run_with_cache(s)
num_tokens = bridge.to_tokens(s)
```

A tiny helper to check that a and b are all close with `torch.allclose`:

```python
def check(label, a, b, atol=1e-5):
    ok = torch.allclose(a, b, atol=atol)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    return ok
```

---

## 1. Read each node of the diagram from the cache

One variable per box. Note the two aliases the diagram calls out: `attn` is `attn.hook_out`, and `ln2` is exactly the tensor the MLP reads (`mlp.in.hook_in`).

```python
resid_pre  = cache['blocks.0.hook_resid_pre']        # top gray box
ln1        = cache['blocks.0.ln1.hook_normalized']   # LayerNorm 1 output  (feeds Attention)
attn       = cache['blocks.0.hook_attn_out']         # Attention contribution  (= attn.hook_out)
resid_mid  = cache['blocks.0.hook_resid_mid']        # middle gray box  (after first +)
ln2        = cache['blocks.0.ln2.hook_normalized']   # LayerNorm 2 output  (= mlp.in.hook_in)
mlp        = cache['blocks.0.hook_mlp_out']          # MLP contribution    (= mlp.hook_out)
resid_post = cache['blocks.0.hook_resid_post']       # bottom gray box  (after second +)

for name, t in [('resid_pre', resid_pre), ('ln1', ln1), ('attn', attn),
                ('resid_mid', resid_mid), ('ln2', ln2), ('mlp', mlp),
                ('resid_post', resid_post)]:
    print(f"{name:11s} {tuple(t.shape)}")
```

Expected shapes (batch 1, num_tokens 3 [including BOS], `d_model` = 768):

```
resid_pre   (1, 3, 768)
ln1         (1, 3, 768)
attn        (1, 3, 768)
resid_mid   (1, 3, 768)
ln2         (1, 3, 768)
mlp         (1, 3, 768)
resid_post  (1, 3, 768)
```

---

## 2. Core replication: the two additions

The whole diagram in three lines. 
`attn` and `mlp` are the *contributions*, that include the nonlinearities (LayerNorm / Attention / MLP).

```python
check("resid_mid  = resid_pre + attn",       resid_pre + attn,       resid_mid)
check("resid_post = resid_mid + mlp",        resid_mid + mlp,        resid_post)
check("resid_post = resid_pre + attn + mlp", resid_pre + attn + mlp, resid_post)
```

```
[PASS] resid_mid  = resid_pre + attn
[PASS] resid_post = resid_mid + mlp
[PASS] resid_post = resid_pre + attn + mlp
```

The only things ever *added* to the residual stream are the attention contribution and the MLP contribution.

---

## 3. Additional checks

### 3.1 Same tensor, two names

The bridge exposes generic component-boundary hooks (`hook_in` / `hook_out`) 
*and* the classic semantic hooks. 

```python
check("attn.hook_out   == hook_attn_out",     cache['blocks.0.attn.hook_out'],   cache['blocks.0.hook_attn_out'])
check("mlp.hook_out    == hook_mlp_out",      cache['blocks.0.mlp.hook_out'],    cache['blocks.0.hook_mlp_out'])
check("ln1.hook_out    == ln1.hook_normalized", cache['blocks.0.ln1.hook_out'],  cache['blocks.0.ln1.hook_normalized'])
check("mlp.in.hook_in  == ln2.hook_out",      cache['blocks.0.mlp.in.hook_in'],  cache['blocks.0.ln2.hook_out'])
```

```
[PASS] attn.hook_out   == hook_attn_out
[PASS] mlp.hook_out    == hook_mlp_out
[PASS] ln1.hook_out    == ln1.hook_normalized
[PASS] mlp.in.hook_in  == ln2.hook_out
```

### 3.2 Every arrow is an equality 

Each arrow in the diagram is an equality: 
a component's `hook_in` is whatever the previous box emitted.

```python
check("blocks.0.hook_in  == resid_pre",   cache['blocks.0.hook_in'],     resid_pre)
check("ln1.hook_in       == resid_pre",   cache['blocks.0.ln1.hook_in'], resid_pre)
check("attn.hook_in      == ln1.hook_out", cache['blocks.0.attn.hook_in'], cache['blocks.0.ln1.hook_out'])
check("ln2.hook_in       == resid_mid",   cache['blocks.0.ln2.hook_in'], resid_mid)
check("mlp.hook_in       == ln2.hook_out", cache['blocks.0.mlp.hook_in'], cache['blocks.0.ln2.hook_out'])
check("blocks.0.hook_out == resid_post",  cache['blocks.0.hook_out'],    resid_post)
```

```
[PASS] blocks.0.hook_in  == resid_pre
[PASS] ln1.hook_in       == resid_pre
[PASS] attn.hook_in      == ln1.hook_out
[PASS] ln2.hook_in       == resid_mid
[PASS] mlp.hook_in       == ln2.hook_out
[PASS] blocks.0.hook_out == resid_post
```

### 3.3 Attention output is *not* what the MLP reads

`attn.hook_out` does not feed 
the MLP directly. Two operations sit between them in the diagram: the residual add, then `LN2`.

```python
# attn.hook_out is NOT mlp.in.hook_in:
print("attn == mlp input?", torch.allclose(attn, cache['blocks.0.mlp.in.hook_in']))  # -> False

# What the MLP reads is LN2 applied to (resid_pre + attn) = LN2(resid_mid):
check("mlp.in.hook_in == LN2(resid_mid)", cache['blocks.0.mlp.in.hook_in'], cache['blocks.0.ln2.hook_out'])
```

```
attn == mlp input? False
[PASS] mlp.in.hook_in == LN2(resid_mid)
```

### 3.4 Rebuild the LayerNorms from the raw residual

The bridge preserves the native HuggingFace weights and,
unlike HookedTransformer.from_pretrained (which folds by default), does **not** fold 
LayerNorm gain/bias into the next layer, 
so the LN parameters are live and we can reproduce both norm boxes from scratch. 

First, a helper to pull a weight out by suffix (the wrapper prefix doesn't matter):

```python
import torch.nn.functional as F

def get_param(suffix):
    matches = [(n, p) for n, p in bridge.named_parameters()
               if n.replace("._original_component", "").endswith(suffix)]
    if not matches:
        raise KeyError(f"No parameter matches suffix {suffix!r}")
    return matches[0][1].detach()

EPS = 1e-5  # GPT-2 layer_norm_epsilon

def layer_norm(x, w, b, eps=EPS):
    mu  = x.mean(-1, keepdim=True)
    var = ((x - mu) ** 2).mean(-1, keepdim=True)   # population variance (unbiased=False)
    return (x - mu) / torch.sqrt(var + eps) * w + b
```

`LN1` turns `resid_pre` into what Attention sees; `LN2` turns `resid_mid` into what the MLP sees:

```python
ln1_w, ln1_b = get_param("h.0.ln_1.weight"), get_param("h.0.ln_1.bias")
attn_in_recon = layer_norm(resid_pre, ln1_w, ln1_b)
check("LN1(resid_pre) == attn.hook_in", attn_in_recon, cache['blocks.0.attn.hook_in'], atol=1e-4)

ln2_w, ln2_b = get_param("h.0.ln_2.weight"), get_param("h.0.ln_2.bias")
mlp_in_recon = layer_norm(resid_mid, ln2_w, ln2_b)
check("LN2(resid_mid) == mlp.in.hook_in", mlp_in_recon, cache['blocks.0.mlp.in.hook_in'], atol=1e-4)
```

```
[PASS] LN1(resid_pre) == attn.hook_in
[PASS] LN2(resid_mid) == mlp.in.hook_in
```

### 3.5 Rebuild the MLP (up-projection → GELU → down-projection)

GPT-2's MLP uses `Conv1D` layers whose weight is stored as `[in, out]`, so the matmul is `y = x @ W + b` with **no transpose**. GPT-2 also uses the tanh-approximation GELU (`gelu_new`).

```python
W_in,  b_in  = get_param("h.0.mlp.c_fc.weight"),   get_param("h.0.mlp.c_fc.bias")    # [768, 3072]
W_out, b_out = get_param("h.0.mlp.c_proj.weight"), get_param("h.0.mlp.c_proj.bias")  # [3072, 768]

mlp_in = cache['blocks.0.mlp.in.hook_in']          # = ln2 (what the MLP reads)
pre    = mlp_in @ W_in + b_in                      # up-projection 768 -> 3072
post   = F.gelu(pre, approximate='tanh')           # GPT-2's gelu_new
out    = post @ W_out + b_out                      # down-projection 3072 -> 768

check("up-projection == mlp.hook_pre",   pre,  cache['blocks.0.mlp.hook_pre'],  atol=1e-4)
check("GELU          == mlp.hook_post",  post, cache['blocks.0.mlp.hook_post'], atol=1e-4)
check("down-proj     == mlp (hook_mlp_out)", out, mlp, atol=1e-4)
```

```
[PASS] up-projection == mlp.hook_pre
[PASS] GELU          == mlp.hook_post
[PASS] down-proj     == mlp (hook_mlp_out)
```

### 3.6 Rebuild the attention output projection

`attn.hook_z` holds the per-head weighted value vectors with shape `[batch, pos, n_heads, d_head]`. Concatenating the heads and applying the output projection `W_O` reproduces the attention contribution:

```python
W_O, b_O = get_param("h.0.attn.o.weight"), get_param("h.0.attn.o.bias")   # [768, 768]
z = cache['blocks.0.attn.hook_z']                  # [batch, pos, n_heads, d_head] = [1, 3, 12, 64]
b, p, n_heads, d_head = z.shape
z_flat = z.reshape(b, p, n_heads * d_head)         # concatenate heads -> [1, 3, 768]
attn_recon = z_flat @ W_O + b_O

check("z @ W_O == attn (hook_attn_out)", attn_recon, attn, atol=1e-4)
```

```
[PASS] z @ W_O == attn (hook_attn_out)
```

### 3.7 Cross-block continuity

The residual stream is the through-line: this block's output is the next block's input.

```python
check("blocks.0.hook_resid_post == blocks.1.hook_resid_pre",
      cache['blocks.0.hook_resid_post'], cache['blocks.1.hook_resid_pre'])
```

```
[PASS] blocks.0.hook_resid_post == blocks.1.hook_resid_pre
```

### 3.8 Capstone: the whole network is one big sum

Because every block *only adds* to the residual stream, the final residual is the token + positional embeddings plus the sum of every attention and MLP contribution across all layers. This is the property that makes direct logit attribution possible.

```python
import re
n_layers = 1 + max(int(re.match(r'blocks\.(\d+)\.', k).group(1))
                   for k in cache.keys() if k.startswith('blocks.'))   # 12 for gpt2-small

# Start: token embedding + positional embedding (positions [0, 1, 2])
stream = cache['hook_embed'] + cache['pos_embed.hook_out']
# Every block contributes attention + MLP, nothing else:
for l in range(n_layers):
    stream = stream + cache[f'blocks.{l}.hook_attn_out'] + cache[f'blocks.{l}.hook_mlp_out']

final = cache[f'blocks.{n_layers - 1}.hook_resid_post']
check(f"embed + pos + sum of {2 * n_layers} contributions == final resid_post",
      stream, final, atol=1e-4)
```

```
[PASS] embed + pos + sum of 24 contributions == final resid_post
```

### 3.9 All the way to the logits

Closing the loop: apply the final LayerNorm and the (weight-tied) unembedding to the final residual, and recover the model's own logits.

```python
lnf_w, lnf_b = get_param("ln_f.weight"), get_param("ln_f.bias")
W_U = get_param("wte.weight")                 # unembedding is tied to the token embedding
logits_recon = layer_norm(final, lnf_w, lnf_b) @ W_U.T

check("reconstructed logits == model logits", logits_recon, logits, atol=1e-3)
```

```
[PASS] reconstructed logits == model logits
```

From token IDs to logits, every intermediate tensor in the diagram has now been reproduced from its parts and matched against the cache.

---

## Notes and assumptions

- **Pre-norm.** GPT-2 normalizes a *copy* of the residual for each sub-block; the raw residual passes through untouched on the skip connection. That is why `resid_pre`, not `LN1(resid_pre)`, is the term added back at the first `+`.
- **The bridge keeps native weights.** `TransformerBridge` preserves the HuggingFace implementation, so LayerNorm gain/bias are not folded into adjacent matrices (unlike the default `HookedTransformer.from_pretrained` path). The reconstructions in 3.4–3.6 work because the LN parameters are still live.
- **Conv1D layout.** GPT-2's `c_attn`, `c_proj`, `c_fc` are `Conv1D`, storing weights as `[in, out]`. The matmul is `x @ W + b` with no transpose: the opposite of `nn.Linear`.
- **GELU variant.** GPT-2 uses `gelu_new`, the tanh approximation: `F.gelu(x, approximate='tanh')`.
- **Weight tying.** The unembedding is the transpose of the token-embedding table `wte.weight`; there is no separate unembed matrix and no logit bias.
- **`eps`.** GPT-2's `layer_norm_epsilon` is `1e-5`.
- **Tolerances.** Pure additions match at `atol=1e-5`. Single-matmul reconstructions use `1e-4`; the logits, which accumulate the full forward pass, use `1e-3`.
- **Weight suffixes.** `get_param` matches on the end of the parameter name (e.g. `h.0.ln_1.weight`), which is robust to whatever prefix the bridge wraps the HuggingFace module graph in.
