---
layout: article
title: "Basic: what 32-bit float representation means"
description: "Bits, bytes, and what quantization actually buys you: from float32 down to int8, with the model-size arithmetic worked out."
summary: A bit is a logical state, a byte is eight of them, and quantization is what happens when you decide a parameter doesn't need all 32.
date: 2026-07-10
tags: [quantization, float32, int8, inference]
published: false
---

## Bits and bytes

One bit represents a logical state with one of two possible values.

One byte is a group of eight bits. The byte is a unit of digital information: it
was the number of bits needed to encode a single character of text in a
computer, and it is the smallest addressable unit of memory in many computer
architectures.

## Quantization

Quantization is a technique to reduce the computational and memory costs of
running inference by representing model parameters with low-precision data,
like 8-bit integers (`int8`), instead of the usual 32-bit floating point
(`float32`).

## The arithmetic

The size of a model with 100M parameters:

| Precision | Bits per param | Bytes per param | Model size |
|---|---|---|---|
| `float32` | 32 | 4 | 400 MB |
| `float16` | 16 | 2 | 200 MB |
| `int8` | 8 | 1 | 100 MB |

## What 8 bits can hold

8 bits give `2**8 = 256` distinct values.

- For signed `int8`, one bit encodes the sign: the max value is 127, the lowest
  is -128.
- For unsigned `uint8`, the max value is 255 and the min value is 0.

## So is the largest float32 equal to 2³²?

No. 2³² (≈ 4.3 billion) is the **number of distinct values** a 32-bit pattern
can encode, not the maximum value. That reasoning works for integers, but
floating point spends its bits differently.

A float32 splits its 32 bits into three fields:

- 1 sign bit
- 8 exponent bits
- 23 mantissa (fraction) bits

The value is roughly: sign × mantissa × 2^exponent. The exponent field lets the
number scale up to 2¹²⁷, so the maximum finite float32 is about
**3.4 × 10³⁸**, vastly larger than 2³².

The trade-off is precision. There are still only 2³² bit patterns, spread across
that enormous range, so the values are not evenly spaced. Near zero, adjacent
representable numbers are extremely close together; near the maximum, the gap
between adjacent representable numbers is around 2¹⁰⁴. A float32 has about 7
significant decimal digits of precision everywhere: it can represent
3.4 × 10³⁸, but it cannot distinguish 3.4000000 × 10³⁸ from 3.4000001 × 10³⁸.

Contrast with `int8`/`int32`: integers cover a small range with exact, evenly
spaced values; floats cover a huge range with relative (percentage-scale)
precision. This is why quantizing float32 weights to int8 requires a scale
factor: you are mapping a wide, unevenly-spaced representation onto 256 evenly
spaced levels.
