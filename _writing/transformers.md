---
layout: reference
title: "Transformers — A Telling to Myself"
description: A living reference for the transformer architecture, explained back to myself — searchable, modular, and built to grow.
summary: A working reference for the transformer architecture, in the voice of explaining it back to myself. Searchable and modular, with formulas that carry explicit dimensions so any piece lifts out without re-deriving the rest.
date: 2026-06-19
tags: [transformers, attention, mech-interp, reference]
permalink: /writing/transformers/
---

A working reference for the transformer architecture, written in the voice of
explaining it back to myself. Built to be **searched, extended, and modified** —
not read once.

## 1. What a transformer does

A transformer maps a sequence of tokens to next-token probability distributions.
[OPEN] verify the exact phrasing against the source.

| Symbol | Meaning |
|---|---|
| `T` | sequence length |
| `d_e` | embedding width |

## 2. Inside attention

The scaled dot-product attention:

$$\mathrm{Attn}(X) = \mathrm{softmax}\!\left( \mathrm{mask}\!\left( \frac{Q\cdot K^{\top}}{\sqrt{d_k}} \right) \right) \cdot V$$

A reference implementation stays a code block, never math:

```python
def attention(Q, K, V):
    d_k = Q.size(-1)
    scores = Q @ K.transpose(-2, -1) / d_k ** 0.5
    return scores
```

The MLP treatment is thin on purpose. [STUB]
Expansion hook for the interp project. [EXT]
