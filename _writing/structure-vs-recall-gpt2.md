---
layout: article
title: "The capital of France is ` now`"
subtitle: "Structure vs. Recall in GPT-2 Small"
description: GPT-2 small continues "The capital of France is" with " now", not " Paris". A walk through the tools — logit lens, tuned lens, direct logit attribution, activation and path patching — that test whether the model is continuing a form or failing to retrieve a fact, and where the answer actually lives.
summary: Feed GPT-2 small "The capital of France is" and it answers " now", not " Paris". The tempting reading is language-as-structure over fact-recall; this is the attempt to check that reading with real tools — and the trivial explanation (token frequency and training data) that comes back instead.
date: 2026-06-20
published: false
tags: [mech-interp, transformers, interpretability, GPT-2]
permalink: /writing/structure-vs-recall-gpt2/
---

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

## Introduction

Feed GPT-2 small (124M) the prompt "The capital of France is", decode greedily, 
and the next token is `·now`. The capital of France is now. What exactly stops the model 
from answering Paris, and what makes it prefer the form of language instead?

Maybe Paris simply isn’t there. But can it really be that GPT-2 small, small as it is, 
holds no notion of Paris at all? More likely it holds one, and the signal is just too weak 
to ever beat the form. How weak, though?
That is the first thing to measure, and the answer decides which story to tell: 
the story of a name resting just below the surface and never popping up as argmax,
or the story of a name buried thousands of tokens down, almost in real absence, where data-dilution 
makes its signal extremely weak.

The prefix certainly doesn’t help. 
The phrasing "the capital of France is ___", with the name straight after the verb, 
belongs to encyclopedias and grammar books and almost nowhere else. 
And encyclopedias and grammar books are not among the fifteen domains that contributed 
the most data by volume to WebText, as the model card records.

[Wikipedia wasn’t just underrepresented in WebText — it was deliberately removed during 
construction (the GPT-2 paper’s dataset section says they stripped Wikipedia documents 
to avoid overlap with evaluation sets). Worth verifying against the source, but if it 
holds, “the canonical encyclopedia was explicitly excluded” is a sharper claim
 than “encyclopedias aren’t in the top fifteen.”]

What follows is a beginner’s attempt to investigate the questions thoroughly and answer it 
plainly, using the concepts and tools of mechanistic interpretability.

Its value, I think, lies less in the subject or the answers — the field is by now saturated 
with similar and better explorations — than in the introduction to mechanistic interpretability 
it gave me.

## The observation

First, a note on how tokens are written. A token with a leading space is shown with a middot: `·now` means 
the token `␣now` (the word "now" with a space in front), and `·Paris` means `␣Paris`. This is different from the 
bare token `Paris` with no space. 

The `·now` we saw isn't special to the end of the sentence. 
If you let the model predict greedily at every position, not just the last one, it does the same thing each time — it picks 
the word that fits the grammar, not a word that adds a fact:

```
pos 2  '...The capital'            -> ' of'
pos 3  '...The capital of'         -> ' the'
pos 4  '...The capital of France'  -> ','
pos 5  '...The capital of France is' -> ' now'
```

I see a promise of Paris at pos 4, after the predicted comma. It appears to me the comma like setting up the phrase 
"The capital of France, Paris, is…". We will verify it, in the Experiments section.

## A note on the greedy decoding

Greedy decoding reports only the **argmax** — the single most probable token. So the trace shows that `·now` beats every other token for *first place*; it does **not** show that `·Paris` is absent from the distribution. Tokens like `·now`, `·a`, `·home`, `·one` are generic post-copula continuations that are valid across essentially every topic in the corpus. For `·Paris` to take the top slot it has to outscore that entire mass of generic continuations, and at 124M it doesn't.

Recall is most likely present but pushed down, not missing.

## Two reasons structure wins here

Two forces make the generic continuation win.

The first is distributional frequency. `is now / is a / is home to` is extremely high-frequency everywhere in text, 
whereas `·Paris` requires a pretty specific subject–attribute association. 

The second force is in the data itself, and this one I checked by googling `"The capital of France is"`.

The simple-Wikipedia article [Capital of France](https://simple.wikipedia.org/wiki/Capital_of_France) 
opens
- `"The capital of France is Paris. In the course of history,"` 

`is` followed straight away by the name. That source is the exception. 

In the other results the phrase shows up as an appositive with Paris already named first: 
- `"Paris, the capital of France, is renowned globally for its…"`, 
- `"Paris, the capital of France, is a world-renowned city for its history…"`,
- `"The capital of France is called: Buyyourselfamap."`. 

The slot after `is` holds most of the times a predicate, because the name already sits at the front of the sentence. 
One docs page even calls `"The capital of France is"` a poorly designed example, I'd guess for the same reason.

So in this text, `"the capital of France … is ___"` takes a description more often than `Paris`. 
`P(Paris | this prefix)` must be a quite weak conditional probability. 

The two forces differ in scope. The first, frequency, is general: the generic predicate is common after "…is ___" 
for any subject, so it should suppress every capital, not just Paris. 
The second, the data, is subject-specific: France's phrase is unusually appositive-dominated and "Paris" 
has many non-capital senses, so France should rank lower than subjects whose data is cleaner. 
If only frequency applies, France is one instance of a general frame effect; 
if the data penalty also applies, France is partly a special case. 
§7 settles the question across a dozen subjects.

## The mechanistic picture

## The mechanistic picture

Grammatical continuation is learned early and robust — roughly high-order n-gram statistics.

Factual recall is a specific stored lookup. In the key–value-memory view of MLPs (Geva et al., 2021), 
the subject representation accumulates attributes across mid layers, and a later attention head moves 
the object token to the final position.

Causal tracing (Meng et al., 2022, ROME) localizes the decisive step to mid-layer MLPs at the last subject token.

If that picture holds in a model this small, it predicts where to look: the `·Paris` write should sit in the 
mid-layer MLPs, with a layer-wise read showing the name promoted there before the output settles. 
The prediction can fail in two telling ways — a single attention head might carry the write instead, 
or the MLPs might suppress the name rather than store it. §3's lenses and direct attribution decide which.

Whatever recall machinery exists at 124M is weak: the France→Paris write isn't sharp enough to outrank 
the generic continuation. The obvious lever is a larger model. If this is capacity-limited recall, 
scaling up should sharpen the write and, at some size, lift `·Paris` to the top along a clean monotone 
curve — which would separate "too small to recall yet" from "structurally unable to." A ragged curve, 
or a name that never reaches the top at any size, would point back to the data rather than the parameter count. 
§2 runs the scale.

## The most telling line is pos 4, not pos 5

At `"The capital of France"` the argmax is a comma. The most natural reading of that comma is that the model is 
setting up an **appositive**: *"The capital of France, Paris, is…"*. 

The prompt's trailing `"…is"` forecloses the appositive and forces a predicate-nominative slot — and that slot is exactly where the generic continuation wins. The same logic runs through the whole trace: pos 3 `"The capital of"` → `·the` (a determiner, not a country), pos 4 → comma (appositive setup), pos 5 → `·now` (generic predicate). At every position the model takes the locally grammatical continuation and never commits to content.

We can assume that Paris, the knowledge, isn't simply missing; it is **more accessible under one syntactic 
frame than another**. Recall here is *frame-sensitive* — and this is the sharpest of the bets, because it can 
be settled at fixed weights: if changing only the syntax, an appositive or a cloze in place of the 
predicate-nominative, lifts `·Paris` toward the top, then the knowledge was present and gated by form; 
if the frame makes no difference, the reading is wrong. §4 makes the swap.


## Experiments

Each section above makes a claim the following experiments will test: 
the name is present but outranked (§1); larger models should raise `·Paris` until it ranks first (§2); 
the component that writes `·Paris` should be a mid-layer MLP (§3); 
rewording the prompt, at fixed weights, should lift `·Paris` toward the top (§4);
and France's low rank is either the general frame effect that holds for every capital, 
or partly a penalty specific to France — §7 settles which.

Two further experiments depend on these rather than testing claims of their own — the causal check in §5 and 
the feature-level analysis in §6 — and are introduced where they appear.

### 1. Locate `·Paris` in the distribution

The first thing to settle empirically is whether `·Paris` is sub-argmax or genuinely suppressed. Report its rank and log-prob in the final-position distribution, for both the leading-space token `·Paris` and the bare `Paris`, and check the BPE segmentation so nothing is missed.

```python
last = model(model.to_tokens(prompt))[0, -1]
logprobs = last.log_softmax(-1)
for s in (" Paris", "Paris"):
    tid = model.to_single_token(s)
    rank = (logprobs > logprobs[tid]).sum().item()
    print(f"{s!r:9s} rank={rank:5d}  logprob={logprobs[tid]:.2f}")
```

*Prediction:* `·Paris` lands in the top tens of tokens but not at rank 0. If it's genuinely far down (rank ≫ 1000), the "present but outcompeted" story weakens and the data-dilution explanation gets relatively more weight.

*Result.* The leading-space token `·Paris` sits at **rank 92** (log-prob −6.42) — present and clearly sub-argmax, not buried. The bare `Paris` (the wrong tokenization after a trailing space) is far down at rank 12 973; both are single tokens.

| token | segmentation | rank | log-prob | multitoken |
|---|---|---|---|---|
| `" Paris"` | `[" Paris"]` | 92 | −6.42 | False |
| `"Paris"`  | `["Paris"]`  | 12 973 | −14.57 | False |

Rank 92 out of ~50 k shows clearly that recall is there — the open question is what holds it down, 
which is what (4) and (5) test.

### 2. The scale curve

Run the same measurement across `gpt2` (124M) → `gpt2-medium` (355M) → `gpt2-large` (774M) → `gpt2-xl` (1.5B) and track the rank/log-prob of `·Paris` and whether it eventually wins the argmax.

*Prediction:* `·Paris` climbs monotonically with scale and crosses into first place at some size. 
A clean monotone curve is the actual evidence that this is **capacity-limited recall** rather than impossibility.

*Result.* The curve does **not** behave as predicted. `·Paris` improves sharply but **non-monotonically**, and it **never wins the argmax** — not even at 1.5B:

| model | params | rank of `·Paris` | log-prob | argmax? |
|---|---|---|---|---|
| `gpt2`        | 124M | 92 | −6.42 | no |
| `gpt2-medium` | 355M | 3  | −3.71 | no |
| `gpt2-large`  | 774M | 54 | −5.93 | no |
| `gpt2-xl`     | 1.5B | 2  | −3.08 | no |


Two things contradict the capacity-limited prediction **for France**. 
First, the curve is non-monotonic: `gpt2-medium` 
pulls `·Paris` to rank 3, but `gpt2-large` regresses to 54 before `gpt2-xl` recovers to rank 2. 
Second, the winning token shifts (`·now` → `·the` → `·a`) but stays generic; at gpt2-xl `·Paris` actually 
outscores `·now` (logit diff +1.26) but loses to ` a` — so for France, `·Paris` is *never* the argmax, at any scale here.

But four ranks on one prompt can't carry a claim about capacity, so I re-ran the measurement 
as a distribution over the twelve-capital probe set of §7 at every scale:

| model | median rank | IQR | capitals at argmax |
|---|---|---|---|
| `gpt2`        | 27  | [22, 52] | 0 / 12 |
| `gpt2-medium` | 2   | [1, 3]   | 3 / 12 |
| `gpt2-large`  | 33  | [18, 50] | 0 / 12 |
| `gpt2-xl`     | 0.5 | [0, 1]   | 6 / 12 |

The **non-monotonicity** is real: the population median zigzags the same way (27 → 2 → 33 → 0.5), 
with `gpt2-large` regressing. 
But capacity is clearly **not** irrelevant — by gpt2-xl the median capital *is* the argmax 
(median 0.5, six of twelve winning), so for most subjects scale favours the recall. 

**France→Paris is the outlier**: it sits among the worst capitals (rank 2 at xl while the median is 0), 
which is the §1 data-dilution pattern again. 

<figure>
  <img src="/assets/structure-vs-recall/section_8_median-ranks.png" alt="Top: median rank of the capital token (log y) versus model size (log x) for gpt2, gpt2-medium, gpt2-large, gpt2-xl, with IQR error bars — 27, 2, 33, 0.5, a non-monotonic curve where gpt2-large regresses well above gpt2-medium and gpt2-xl reaches the rank-1 line. Bottom: per-country rank distributions (box plots with points) at each scale, showing the same non-monotonic spread.">
  <figcaption>RUN A — median rank of the capital across the twelve-capital probe set, by scale (IQR (the interquartile range) bars), 
with the per-country distribution below. 
<code>gpt2-large</code> regresses, but by <code>gpt2-xl</code> the median capital is the argmax (6 / 12) — capacity does most of the work across subjects; France is the outlier.</figcaption>
</figure>

<figure>
  <img src="/assets/structure-vs-recall/section_2_plotrank-log-prob-vs-scale.png" alt="Two line plots across gpt2, gpt2-medium, gpt2-large, gpt2-xl. Left: rank of the ' Paris' token on a log axis — 92, 3, 54, 2 — a non-monotonic dip that never reaches rank 1 (dashed line). Right: log-prob of ' Paris' — −6.42, −3.71, −5.93, −3.08 — the mirror-image non-monotonic curve.">
  <figcaption>Rank (left, log axis) and log-prob (right) of the leading-space token <code>·Paris</code> across the GPT-2 family, for the France prompt. The dashed line marks rank 1: for France, `·Paris` never crosses it. The improvement is real but non-monotonic; across the twelve-capital population (table above) most capitals do reach the argmax by gpt2-xl — France is the outlier.</figcaption>
</figure>

### 3.1 Layer-wise emergence by logit lens

Apply the logit lens (nostalgebraist) or, better, a tuned lens (Belrose et al., 2023) across layers to find
*where* `·Paris` is promoted, if at all.

Apply the logit lens (nostalgebraist), or better a tuned lens (Belrose et al., 2023), across layers to find where `·Paris` is promoted, if at all.

*Prediction:* if ROME's localization holds, the `·Paris` logit should jump at specific late mid-layer MLPs in 
the larger models, while in 124M the promotion may never rise above the generic-continuation mass. 
Locating that promotion in medium/large and showing the same step is weak or absent in small would be the 
§2 scale argument run across layers rather than across model sizes.

*Result (gpt2 small):* 
Across all 26 stages (`0_pre … final_post`), `·Paris` hides through the early blocks (rank ~10⁴), 
is promoted through the middle to an internal minimum of rank ≈ 13 around `9_mid`, 
then loses ranks up to `final_post` = rank 92. 
Because the final-layer logit lens (`ln_final` then `W_U` on the last residual) is the model's output, 
that 92 is exactly the §1 number.


<figure>
  <img src="/assets/structure-vs-recall/section_3_logit-lens.png" alt="A line plot, logit-lens rank of the ' Paris' token by stage on a log y-axis, across 26 stages from 0_pre to final_post for gpt2 small. The rank stays around 10^4 for the early stages, declines through the middle, drops steeply to an internal minimum near rank 13 around 9_mid, bumps up slightly, and the final_post stage settles around rank 10^2 — the model's true output rank of 92.">
  <figcaption>Logit-lens rank of the leading-space token <code>·Paris</code> across 26 stages in gpt2 small (log axis). Promoted from rank ~10⁴ to an internal minimum of <strong>rank ≈ 13 around <code>9_mid</code></strong>, then easing back to <code>final_post</code> = rank 92, the model's true output (§1). A lens trajectory — a mid-stack rise and a return to the surface level — suggestive, but a lens read, not a direct measurement of the Paris logit.</figcaption>
</figure>

### 3.2 Layer-wise emergence by tuned lens

A trained **tuned lens** (Belrose et al., 2023) confirms the shape with an independent translator. Its 13 per-stage reads trace the same arc and end at **rank 4** (log-prob −3.43):

| stage | rank | log-prob | | stage | rank | log-prob |
|---|---|---|---|---|---|---|
| 0 | 14 185 | −14.48 | | 7  | 58  | −6.57 |
| 1 | 10 327 | −11.99 | | 8  | 173 | −7.43 |
| 2 | 11 317 | −12.64 | | 9  | 74  | −6.74 |
| 3 | 7 441  | −11.89 | | 10 | 10  | −4.53 |
| 4 | 4 455  | −11.10 | | 11 | 5   | −5.03 |
| 5 | 1 462  | −9.54  | | 12 | **4** | **−3.43** |
| 6 | 1 174  | −9.53  | |    |     |       |

Comparing the two lenses and looking at where they disagree is quite interesting. 
At the final stage, the only one with a known answer, the raw logit lens gives 92 
(exact, by construction) while the tuned lens gives rank 4: it ranks `·Paris` too high. 

By construction the tuned lens (see https://tuned-lens.readthedocs.io/en/latest/) 
replaces the upper layers with one affine map, fit to match the model's output 
on average across text, so it cannot reproduce a suppression specific to one frame. 
Removing `·Paris` here is exactly that kind of input-specific operation (§3–§6): 
the lens applies its average-case mapping, under which the capital is more available, 
and reads rank 4 where the model says 92. The size of that overshoot measures how far this frame 
sits from the text the lens was fit on — the §1 data-dilution point once more.

What both lenses support is modest: `·Paris` rises in the mid-stack reads, and is not the top token at the output. 
The stronger claim — that the name is computed mid-stack and then outcompeted — is a lens inference, not a measurement, 
so I measured it directly (next).

### 3.3 Layer-wise emergence by direct logit attribution

*Direct logit attribution (the lens-free version).* Decompose the real final-position residual 
into per-component contributions, apply the model's own fixed `ln_final` scale, and project each onto 
the `·Paris` − `·now` logit direction. The pieces sum back to the true logit difference — the reconstruction 
check passes to within ≈ 1e-6. 
Two things fall out:

| promotes `·Paris` (vs `·now`) | DLA | | suppresses (writes `·now`) | DLA |
|---|---|---|---|---|
| **L9H8** | **+1.81** | | `L10_mlp`   | −1.17 |
| L11H3 | +0.45 | | `L0_mlp`    | −1.01 |
| L10H0 | +0.38 | | `L7_mlp`    | −0.77 |
| L11H2 | +0.31 | | unembed bias   | −0.67 |
| L8H11 | +0.27 | | L8H10          | −0.30 |
| L9H3  | +0.24 | | `L5_mlp`    | −0.28 |

**Promotion is localized to one head.** A single attention head, **L9H8, writes +1.81** to the `·Paris` − `·now` logit 
— more than three times the next component. 

**Suppression is the MLPs and the unembed bias**, all writing toward the generic continuation.

L9's attention lifts `·Paris` from rank 576 to 69,
`L10_mlp` shoves it back to 107, and the output settles at rank 92.

| step | Δ(`·Paris`−`·now`) | rank |
|---|---|---|
| `L8_mlp`     | −0.06 | 576 |
| **`L9_attn`** | **+1.84** | **69** |
| `L9_mlp`     | −0.26 | 72 |
| `L10_attn`   | +0.31 | **38** |
| `L10_mlp`    | −1.17 | 107 |
| `L11_attn`   | +0.67 | 55 |
| `L11_mlp`    | +0.03 | **92** |

So a specific recall head writes the name, the MLPs (and the bias) write 
the generic continuation more strongly, and the name loses. 

In §6 we talked about a "generic mass"; now we can give a name to that mass, the late MLPs.
Furthermore, this inverts the ROME expectation from §3: the writer is a single attention head — L9H8, 
contributing +1.81 to the `·Paris` − `·now` logit, more than three times the next component — not the mid-layer MLPs, 
and those MLPs here suppress the name (`L10_mlp` −1.17, `L7_mlp` −0.77) rather than store it.

A note: DLA credits only a component's *direct* contribution to the logit, so a head that acts *through* a later 
component is credited to that component instead. 
Path patching (§5) is the test that separates the two, and it confirms L9H8 directly
— while showing that L9H8's own output is then routed *suppressively*. 

### 4. Frame-sensitivity sweep

Hold scale fixed and vary only the syntactic frame, measuring the rank of `·Paris` in each:

- predicate-nominative — `"The capital of France is"`
- appositive — `"The capital of France,"`
- QA — `"Q: What is the capital of France? A:"`
- cloze / definitional — `"The capital of France is the city of"`

*Prediction:* the appositive and QA frames surface `·Paris` much higher — plausibly at argmax — even at 124M. If a frame change alone flips the readout at fixed weights, the knowledge was there and gated by syntax, which is the central claim made directly observable.

*Result.* This is the cleanest evidence in the whole piece. At **fixed weights**, changing only the frame moves `·Paris` from rank 92 to **rank 0 — the argmax** — in two of the four frames:

| frame | prompt | rank | log-prob | argmax |
|---|---|---|---|---|
| predicate-nominative | `"The capital of France is"`        | 92 | −6.42 | no |
| appositive           | `"The capital of France,"`           | **0** | −1.25 | **yes** |
| QA                   | `"Q: What is the capital of France? A:"` | 4 | −3.64 | no |
| cloze / definitional | `"The capital of France is the city of"` | **0** | −2.33 | **yes** |

The appositive (`…France,`) and the cloze (`…is the city of`) both put `·Paris` first; 
the QA frame surfaces it to rank 4. Nothing about the model changed — only the syntax of the slot. 

So `·now` wins the predicate-nominative slot not because the model cannot recall Paris, 
but because this construction favors a generic predicate over the name — the knowledge is *present and gated by frame*.

### 5. Causal test: activation patching

Take Frame 4 where `·Paris` wins, run it, 
and patch its residual-stream vector at the final token position into Frame 1, 
the predicate-nominative frame. Check whether the argmax flips to `·Paris`.

```python
# cache a Paris-surfacing frame, patch its final-pos resid into the predicate-nominative frame
_, cache = model.run_with_cache(appositive_frame)
def patch_resid(resid, hook):
    resid[:, -1, :] = cache[hook.name][:, -1, :]
    return resid
patched = model.run_with_hooks(pn_frame,
    fwd_hooks=[(utils.get_act_name("resid_post", L), patch_resid)])
```

*Prediction:* patching from a Rank-0 frame raises `·Paris` in the predicate-nominative frame, 
and the effect concentrates in a small set of mid-to-late layers.

*Result.* Patching the donor (appositive) frame's final-position `resid_post` into the predicate-nominative 
frame **flips `·Paris` to rank 0** (argmax), with Δ log-prob +5.17 over baseline. 
The effect is **high and nearly flat across all twelve layers** (≈ +5.17 at each) — 
patching at layer 0 helps about as much as patching at layer 11.

<figure>
  <img src="/assets/structure-vs-recall/section_5_per-layer-patch-effect.png" alt="A bar chart, per-layer patch effect. For each patched layer 0 through 11 (resid_post at the final position), the bar shows the change in log-prob of ' Paris' versus baseline. Every bar is the same height, about 5.17.">
  <figcaption>Patching the donor frame's final-position residual into the predicate-nominative frame, one layer at a time. Δ log-prob of `·Paris` is a flat ≈ +5.17 at every depth, and the argmax flips to `·Paris` in all cases.</figcaption>
</figure>

Two caveats keep this from being an independent pillar. First, the donor frame `"The capital of France,"` is just 
the predicate-nominative frame with its final token swapped from `is` to a comma — same subject, same length — so 
the patch largely re-derives §4 rather than adding new causal content.

Second, the flatness: the donor differs from the receiver only at the final token, 
so that difference sits in the final-position residual at every layer — patching the whole `resid_post` therefore 
flips the readout at any injection layer, and the patch localizes nothing.


What the layer-0 end of the flat line *does* sharpen is the §4 reading: injecting an early comma-state into the final position already flips the output, which means the receiver's own downstream layers compute Paris once the copula is gone. The cleaner claim is therefore not "one residual edit away" but that **the `is` token in the final slot is itself the suppressor** — the same point the pos-4 comma made (§"The most telling line"), now from the causal side.

*Component-level patch, with a control.* Running exactly that — patching one component's final-position output at a time (each head's `z`, each layer's `mlp_out`) from the appositive donor, with a non-Paris control alongside — confirms the causal direction and then springs a trap. The control passes cleanly: the appositive donor flips `·Paris` to the argmax, while a different-country donor (`"The capital of Germany is"`) moves it by at most Δ = 0.86, never to the top (best rank 65 vs baseline 92) — **11.5× weaker**. So the flip is real and **donor-specific**, not "any patch saturates the output". But the *localization* half fails, revealingly. The biggest effect is neither the DLA writer `L9H8` (only +0.47 under patching, rank 55) nor a mid-to-late circuit; it is **`L0_mlp`** (Δ = +9.86, the only single component that reaches the argmax alone). The reason is a confound: donor and receiver are a *minimal pair*, differing only in their final token (`,` vs `is`), so patching the earliest token-carrying component swaps the frame at its root and lets the rest of the network recompute appositive-style. The patch is localizing **the frame lever — the final token — not a Paris circuit**: it is the early-layer twin of the full-residual saturation above (flat there because the whole state is injected, concentrated at `L0_mlp` here because that is where the token difference enters). The mid-stack MLP gradient (`L5`–`L10`, Δ ≈ +2 to +3) sits downstream of the same token difference, so it isn't an independent recall circuit either.

| patched component (real donor) | Δ logit(`·Paris`−`·now`) | rank(`·Paris`) |
|---|---|---|
| `L0_mlp` — flips alone | **+9.86** | **0** |
| `L8_mlp` | +3.32 | 3 |
| `L7_mlp` | +3.15 | 5 |
| `L5_mlp` | +2.90 | 5 |
| `L6_mlp` | +2.88 | 8 |
| `L9_mlp` | +2.01 | 20 |
| `L10_mlp` | +1.54 | 18 |
| `L10H0` | +0.67 | 43 |
| `L9H8` (DLA winner) | +0.47 | 55 |

<figure>
  <img src="/assets/structure-vs-recall/section_8_runb.png" alt="Top: two per-head patch heatmaps, layer by head, of the change in the Paris-now logit. Left (real appositive donor) has structure — a strong negative cell at L10H7 and scattered positive cells; right (Germany control donor) is nearly uniform near zero. Bottom: a bar chart of the top component patch effects for the real donor, with L0_mlp far largest (~+9.86), the MLPs dominating the positive side past the dashed line marking the §5 full-residual +5.17, and attention heads small.">
  <figcaption>RUN B — per-component patch. <strong>Heatmaps</strong>: the real donor (left) moves the `·Paris`−`·now` logit in a structured way; the Germany control (right) is nearly flat — the flip is donor-specific. <strong>Bars</strong>: the effect is carried by MLPs, led by <code>L0_mlp</code>, not by a localized recall head (<code>L9H8</code> is small) — because the donor differs only in the final token.</figcaption>
</figure>

*Path patching settles it.* Two donor-free follow-ups pin down what the saturating patch and the confounded donor could not (the reconstruction here closes to 4.8e-7, so these are exact). First, the `L0_mlp` "localization" is a donor artifact: the two frames are a minimal pair — an assert confirms they differ *only* in the final token — and patching the raw token embedding alone (`hook_embed` at the final position) flips `·Paris` to the argmax with Δ = +9.68, essentially all of `L0_mlp`'s +9.86. The patch localized the frame *token*, not a recall circuit. Second, the DLA writer `L9H8` is causally real: ablating only its *direct* path to the logit (downstream frozen) drops the `·Paris` − `·now` logit by −1.80 — exactly its DLA write, the 0.002 gap being the final-LayerNorm nonlinearity — and collapses `·Paris` from rank 92 to **370**. But its *total* effect is small (Δ −0.68, rank 92 → 164 when fully ablated), because its routing through later layers is **suppressive (−1.12)**, cancelling more than half of its own +1.80 direct write — which is why the donor patch saw L9H8 as negligible. And the MLPs that dominated that patch write *nothing* to `·Paris` directly: their direct DLA is near-zero or negative (`L0_mlp` −1.01, `L7_mlp` −0.77, `L10_mlp` −1.17). The MLP stack *suppresses* the name — the §6 generic mass, now confirmed at the component level by an independent method — while a single head writes it.

So **computation, writer, and gate are three different places**: `L9H8` writes `·Paris`; the MLP stack suppresses it directly, and L9H8's own output is routed back against it downstream; and the final-token frame is the lever the activation patch was really moving.

<figure>
  <img src="/assets/structure-vs-recall/section_9_test2.png" alt="A table of the top-8 attention heads by direct logit attribution (L9H8 first at +1.806, about four times the next), and a bar chart for L9H8 comparing its DLA write (+1.81), the support removed by ablating only its direct path (+1.80, nearly identical, rank 92 to 370), and the much smaller support removed by total ablation (+0.68, rank 92 to 164).">
  <figcaption>TEST 2 — path patching <code>L9H8</code>. Its direct-path ablation reproduces its DLA write almost exactly (a real causal writer, +1.80), but its <em>total</em> effect is small (+0.68): the head's output is routed suppressively downstream (−1.12), cancelling half of what it writes.</figcaption>
</figure>

<figure>
  <img src="/assets/structure-vs-recall/section_9_bonus.png" alt="A scatter plot, one point per MLP, of the donor patch effect (y axis, total) against the direct logit attribution to the Paris-minus-now direction (x axis, write). L0_mlp sits at top-left (patch about +9.9, write about −1.0); L7_mlp and L10_mlp also have large patch effects but near-zero or negative write. The MLPs with the biggest patch effects write little or nothing to Paris.">
  <figcaption>BONUS — patch ≠ write. Per MLP, the donor patch effect (total) against the direct write to `·Paris`. The MLPs that dominate the patch (<code>L0</code>, <code>L7</code>, <code>L10</code>) write *negatively* to the name: their patch effect is frame-routing, while their direct contribution suppresses `·Paris`.</figcaption>
</figure>

*Where the routing lands — and what it is.* One thread was left: L9H8's own output is routed *suppressively* (−1.12), but through what? A last-writer decomposition answers exactly — the per-component edges reconstruct the ablated-minus-clean final residual to machine precision (Δ ≈ 3.5e-7; linear total −0.687 vs the true ablation −0.685). The obvious guess is refuted. This *routed* suppression is **not** the MLPs — those suppress `·Paris` *directly* and independently of L9H8 (`L10_mlp`'s routed share is only ~3 %, the MLP stack's ~10 %, and `L11_mlp` even *helps*). It is downstream **attention**: `L10_attn` (48 % of the −1.12) and `L11_attn` (42 %), 90 % between them, concentrated in two heads — **L10H0 (−0.39) and L11H2 (−0.50)**.

And those two heads are themselves `·Paris` writers — the #3 and #4 in the DLA table (+0.38 and +0.31). What L9H8 does is *halve their write*: without L9H8 they would contribute +0.77 and +0.81; with it, +0.38 and +0.31. The dominant Paris-writing head **downregulates the weaker, redundant Paris writers below it** — an *explaining-away* among the name's own writers. That is where more than half of L9H8's +1.80 direct write goes, and why it nets only +0.68: most of it is spent inhibiting L10H0 and L11H2, not feeding the MLPs. So the gate on `·Paris` has **two distinct parts**, not one: the MLP stack writes the generic continuation directly and independently (§6), and on top of it L9H8 suppresses its own redundant downstream echoes. The single distributed suppressor the SAE pass alone suggested was the obvious-but-wrong channel — the kind of miss this whole piece is about.

<figure>
  <img src="/assets/structure-vs-recall/section_10_l9h8.png" alt="A horizontal bar chart, effect on the Paris-minus-now logit for each downstream receiver of L9H8's output (negative = suppresses Paris). L10_attn (about −0.54) and L11_attn (about −0.47) are the two large negative bars; L9_mlp (−0.12), L10_mlp (−0.03) are small, and L11_mlp is slightly positive. Total indirect routing −1.12.">
  <figcaption>Where L9H8's −1.12 suppressive routing is realized, by last-writer decomposition (closes exactly). It is carried by downstream <em>attention</em> — `L10_attn` and `L11_attn`, and within them `L10H0` and `L11H2` — not the MLPs.</figcaption>
</figure>

### 6. SAE feature analysis and causal suppression

Port the suppression methodology directly. At the layers implicated in (3)/(5), check whether an SAE has an interpretable `France` / `capital` / `Paris`-association feature, and whether it fires on this prompt. Then suppress it and confirm `·Paris` drops further; amplify it and check whether `·Paris` surfaces in the predicate-nominative frame. This is the same move as causal suppression of the `whales` feature in the Moby-Dick narrator task, applied to a factual-recall target instead of a narrative one — and it would let the three-regime taxonomy (content-routed recall / heuristic substitution / format fallback) be tested on a fact rather than a literary retrieval.

*Result.* Using the layer-7 residual SAE (`7-res-jb`), I took the top-activating features on the prompt and ablated each one (`scale = 0`), reading the effect on `·Paris` (baseline rank 92). The picture is **distributed, and runs the opposite way to the naive expectation**: most of the strongly-active features are *suppressing* `·Paris` — removing them lifts it — and none is a clean "Paris feature".

The fifteen features that fire most strongly on the prompt, each linked to its Neuronpedia page:

| SAE feature (L7) | activation | Neuronpedia |
|---|---|---|
| 10165 | 6.99 | [10165 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/10165) |
| 12659 | 5.56 | [12659 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/12659) |
| 10888 | 5.55 | [10888 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/10888) |
| 21247 | 5.37 | [21247 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/21247) |
| 18805 | 5.33 | [18805 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/18805) |
| 903   | 4.87 | [903 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/903) |
| 13699 | 3.72 | [13699 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/13699) |
| 2149  | 3.33 | [2149 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/2149) |
| 67    | 3.29 | [67 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/67) |
| 17045 | 3.29 | [17045 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/17045) |
| 13083 | 3.01 | [13083 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/13083) |
| 10142 | 2.98 | [10142 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/10142) |
| 8715  | 2.98 | [8715 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/8715) |
| 19584 | 2.91 | [19584 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/19584) |
| 21349 | 2.55 | [21349 ↗](https://neuronpedia.org/gpt2-small/7-res-jb/21349) |

Ablating each one (`scale = 0`) and re-reading the rank of `·Paris`:

| SAE feature (L7) | activation | rank when ablated | effect on `·Paris` |
|---|---|---|---|
| 17045 | 3.29 | **47** | suppresses (strongest) |
| 12659 | 5.56 | 50 | suppresses |
| 21247 | 5.37 | 53 | suppresses |
| 2149  | 3.33 | 55 | suppresses |
| 903   | 4.87 | 59 | suppresses |
| 13699 | 3.72 | 62 | suppresses |
| 67    | 3.29 | 63 | suppresses |
| 10142 | 2.98 | 70 | suppresses |
| 10888 | 5.55 | 76 | suppresses |
| 18805 | 5.33 | 85 | suppresses (weak) |
| 13083 | 3.01 | 92 | none |
| 21349 | 2.55 | 94 | ~none |
| 19584 | 2.91 | 100 | **supports** (rank drops when removed) |
| 8715  | 2.98 | 108 | **supports** |
| 10165 | 6.99 | 188 | **supports** (the top-activating feature) |

Ablating the strongest suppressor (17045) moves `·Paris` from 92 to 47 — a real lift, but nowhere near the argmax. Conversely the *highest-activating* feature, 10165, is one of the few that *support* `·Paris`: removing it pushes the rank down to 188. So at this layer/position the active features are predominantly generic-continuation promoters competing with the name, rather than a single interpretable France→Paris circuit. That is evidence *against* the clean single-feature suppression story and *for* the distributed "generic mass" account from §3–§4.

### 7. Generalization across the relation

Everything above could be idiosyncratic to France→Paris. Build a small probe set of other `(country → capital)` pairs, then other relation types (`author → notable work`, etc.), and check whether the frame-sensitivity and scale patterns hold subject-to-subject or vary with subject frequency. A structured ground truth — e.g. a knowledge graph used the way the Céline graph anchors the literary work — turns this from a handful of prompts into a measured distribution over subjects, which is what a venue will want.

*Result.* The phenomenon is **not** idiosyncratic to France. Across twelve `(country → capital)` pairs in the predicate-nominative frame, the capital is **never the argmax (0 / 12)** — yet it is recoverable in every case, with a **median rank of 27**:

| subject | capital | rank | log-prob | | subject | capital | rank | log-prob |
|---|---|---|---|---|---|---|---|---|
| Italy   | Rome   | 7  | −4.18 | | China    | Beijing | 31  | −5.58 |
| Greece  | Athens | 10 | −3.95 | | Portugal | Lisbon  | 35  | −5.80 |
| Spain   | Madrid | 11 | −4.33 | | France   | Paris   | 92  | −6.42 |
| Japan   | Tokyo  | 25 | −5.06 | | Canada   | Ottawa  | 219 | −7.46 |
| Egypt   | Cairo  | 27 | −5.42 | | Austria  | Vienna  | 260 | −7.68 |
| Russia  | Moscow | 27 | −5.27 | | Germany  | Berlin  | 27  | −5.19 |

So the `…is ___` construction suppresses the bare capital for *every* subject — the frame effect is general, not a France quirk. What varies, and varies a lot, is *how far down* the name sits: Rome/Athens/Madrid hover near the top (rank 7–11) while Ottawa and Vienna fall past 200. Notably **France→Paris (92) is one of the harder cases**, consistent with §1's data-dilution finding — the "capital of France is" phrasing is unusually appositive-dominated in text, and "Paris" carries many non-capital senses. The spread tracks something subject-specific (plausibly subject/target frequency), which is exactly the measured distribution a follow-up should model.

---

## What the experiments settle

The rhetorical statement — *"a small model follows structure instead of recalling"* — was best treated as a hypothesis with a sign, and the runs above give it one.

**Confirmed: the knowledge is present and frame-dependent, not absent.** `·Paris` is sub-argmax (rank 92) in the predicate-nominative frame (§1), yet changing only the syntax surfaces it to the **argmax** — rank 0 in the appositive and cloze frames (§4), at fixed weights. That single result carries the claim on its own; it needs no lens and no patch. Activation patching points the same way (§5), but it largely re-derives §4 — its donor is the predicate-nominative frame with the final `is` swapped for a comma, so what it really shows is that the **copula in the final slot is the thing doing the suppressing**. And §3's direct logit attribution turns the internal story from inference into measurement: a single head (L9H8) writes `·Paris`, the late MLPs and the unembed bias write the generic continuation more strongly, and the name is outranked — competition, not a gate. Greedy decoding reads out the structural channel; the factual channel is present, just outranked.

**Complicated: capacity helps — unevenly — and France is an outlier.** The original framing implied a clean capacity story: `·Paris` wins once the model is big enough. Run as a distribution over the twelve-capital probe set, capacity *does* mostly win — by gpt2-xl the median capital is the argmax (six of twelve), up from none at gpt2 small (§2, §7). But it wins **non-monotonically** — `gpt2-large` is a real regression — and **France→Paris is the exception that doesn't**: rank 2 even at 1.5B, among the worst capitals at every scale. For this subject the limitation lives in the **construction and the data** — the `…is ___` slot is appositive-dominated and `P(capital | "the capital of X is")` is soft in the training distribution — while for most subjects raw size eventually carries it. And within gpt2 small the suppression is distributed, not a single circuit: no single SAE feature carries the `·Paris` readout — at L7 the strongest active features are generic-continuation promoters, not a France→Paris circuit (§6).

**Open: the parts that didn't resolve.** Three things stay genuinely unexplained, and a faithful account should keep them in view rather than round them off. *Why the scale curve zigzags.* Running the §7 probe set at every scale settled that the dip is **real, not single-prompt noise** — the population median regresses at gpt2-large too (§2). What stays unexplained is *why* a larger model recalls these capitals worse; that is a question about data and tokenization across the released checkpoints, not one more rank. *How L9H8 inhibits the other writers.* The routing is now understood as *explaining-away* (§5): L9H8 halves the `·Paris` write of L10H0 and L11H2. What's left is the *channel* — does L9H8 move those heads' attention pattern away from the Paris-bearing position (QK), or change what they read from it (OV)? A path patch splitting `L9H8 → {L10H0, L11H2}` into their `hook_q`/`hook_k` versus `hook_v` would say which, turning the explaining-away from located to mechanistically explained. *What the suppressing features represent.* §6's strongest live L7 features are continuation-promoters, and the component-level DLA agrees the L7 MLP suppresses `·Paris` (−0.77) — so the suppression is genuinely distributed across the MLP stack, not an artifact of the wrong layer. What those features *mean* (their Neuronpedia labels) is the cheap next look that would turn "generic mass" into named features. None of these is cosmetic; each is a seam where the clean story could still split.

With that owed, the headline. It is not "small models can't recall"; it is that in this frame, at every scale, a structural-continuation prior outranks a present-but-soft factual signal, and the softness is as much in the data as in the model. That is the more interesting half — and, by the lights of the Perse passage, the one still closest to its own lamasery: a clean sentence is exactly the kind of thing that turns out to have a less flattering explanation waiting.

### References

- Geva et al. (2021), *Transformer Feed-Forward Layers Are Key-Value Memories.*
- Meng et al. (2022), *Locating and Editing Factual Associations in GPT* (ROME).
- Belrose et al. (2023), *Eliciting Latent Predictions from Transformers with the Tuned Lens.*
- nostalgebraist (2020), *interpreting GPT: the logit lens.*
