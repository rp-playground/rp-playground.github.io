---
layout: article
title: "The capital of France is ` now`"
subtitle: "Structure vs. Recall in GPT-2 Small"
description: GPT-2 small continues "The capital of France is" with " now", not " Paris". A walk through the tools — logit lens, tuned lens, direct logit attribution, activation and path patching — that test whether the model is continuing a form or failing to retrieve a fact, and where the answer actually lives.
summary: Feed GPT-2 small "The capital of France is" and it answers " now", not " Paris". The tempting reading is language-as-structure over fact-recall; this is the attempt to check that reading with real tools — and the trivial explanation (token frequency and training data) that comes back instead.
date: 2026-06-20
tags: [mech-interp, transformers, interpretability, GPT-2]
permalink: /writing/structure-vs-recall-gpt2/
---

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

## draft - Intro

Feed GPT-2 small (124M) the prompt `"The capital of France is"`, decode greedily, and 
the next token is `·now`. The capital of France is *now*. Cosa esattamente impedisce al modello di 
rispondere Paris e cosa gli fa invece preferire la forma del linguaggio?

The per-position trace shows the same behaviour at every step: each prefix is continued with the 
locally most grammatical token rather than with content.

```
pos 2  '...The capital'            -> ' of'
pos 3  '...The capital of'         -> ' the'
pos 4  '...The capital of France'  -> ','
pos 5  '...The capital of France is' -> ' now'
```

The easy conclusion is that Paris simply isn't there — that the model continues the form at every 
step and never retrieves the fact. Ma è mai possibile che GPT-2 small non abbia,
per quanto piccolo, nessuna idea di Parigi? Allora forse ce l'ha, ma si tratta di un segnale 
troppo debole che non riesce a prevalere mai sulla forma. Ma quanto debole? Il prefisso certo non 
aiuta, così si scrive solo nelle enciclopedie e nei libri di grammatica. E enciclopedie e 
libri di grammatica non compaiono tra i 15 domini che hanno contribuito 
di più in termini di volume di dati a WebText, come si legge nella model card
https://github.com/openai/gpt-2/blob/master/model_card.md .

L'articolo che segue, scritto da un principiante nella materia, si propone di investigare
la materia a fondo e di misurare le ipotesi espresse qui sopra. Nel far questo ci si servirà 
dell'armamentario concettuale e strumentale della mechanistic interpretability.
Si potrebbe anche dire che l'obiettivo principale dell'autore di questo articolo è duplice: 
da una parte di essere in grado di affrontare la questione specifica in termini scientifici, 
dall'altra di introduzione alla mechanistic interpretability.

## A preliminary rumbling

Feed GPT-2 small (124M) the prompt `"The capital of France is"`, decode greedily, and the next token is `·now`. 
The capital of France is *now*. The fragment is *delectable to my palate which I never quite managed to rinse of* 
all that reading I do of Heidegger ("Die Sprache ist das Haus des Seins") and Hölderlin ("Seit ein Gespräch wir sind"), 
and the reading it tempts me into is that the structure of language is the ground a small model is built 
on — the thing learned first and most deeply, what the model is rather than what it stores — and that this 
primacy is what pushes the fact, Paris, out past the form's edge.

I think that reading is a trap. This post is about the tools I need to check a reading like that, 
and what they show when I apply them here.

Here is the kind of trap I mean, and the "very delectable" gets clarified. 
Saint-John Perse, quoted in Archibald MacLeish's "A Note on Alexis Saint-Léger Léger" (*Poetry*, 1942):

> On the threshold of a Mongol hut, in the middle of the Gobi desert, just as I was remounting my horse, 
> someone translated to me the beautiful guttural sentence of a migrant lama of the Great Red Sect: 
> "Man is born in the house, but he dies in the desert…" 
> For days and days, in the course of long silent rides, I thought over and over that phrase, 
> delectable to the palate of an Occidental who can never be sure of having rinsed his mouth sufficiently 
> of all romantic after-taste… until the day when in a lamasery on the border of the desert 
> I was given this trivial explanation: "A dying man must be exposed outside the tent so as not to soil 
> the dwelling place of the living".
>
> A beautiful snub for the incurable associations of ideas of literary culture!

I'm the Occidental in that passage. "The capital of France is now" — language as structure, the model as a machine 
that continues a form rather than retrieving a fact — is the romantic after-taste. 
The lama's sentence had a trivial explanation waiting at the lamasery, and I expect mine does too. 

Most of the rest of this document is the attempt to find it. 
The explanation that comes back is partly about token frequency and partly about what the training data actually 
contains, not about language being the house of Being.

## The observation

Feeding GPT-2 small (124M) the prompt `"The capital of France is"` and decoding greedily, the next token is `·now`. (Tokens are written in code with a middot for the leading space, so `·now` is the BPE token *␣now* and `·Paris` is *␣Paris* — distinct from the bare `Paris`.) The per-position trace shows the same behaviour at every step: each prefix is continued with the locally most grammatical token rather than with content.

```
pos 2  '...The capital'            -> ' of'
pos 3  '...The capital of'         -> ' the'
pos 4  '...The capital of France'  -> ','
pos 5  '...The capital of France is' -> ' now'
```

The easy conclusion is that Paris simply isn't there — that the model continues the form at every step and never retrieves
the fact. That is almost right.

## Correcting the naive reading

Greedy decoding reports only the **argmax** — the single most probable token. So the trace shows that `·now` beats every other token for *first place*; it does **not** show that `·Paris` is absent from the distribution. Tokens like `·now`, `·a`, `·home`, `·one` are generic post-copula continuations that are valid across essentially every topic in the corpus. For `·Paris` to take the top slot it has to outscore that entire mass of generic continuations, and at 124M it doesn't.

Recall is most likely present but sub-argmax — pushed down, not missing.

## Two reasons structure wins here

Two forces make the generic continuation win.

The first is distributional frequency. `is now / is a / is home to` is extremely high-frequency everywhere in text, whereas `·Paris` is a rarer token that only pays off under one specific subject–attribute association. Absent a sharp signal, the model defaults to the high-frequency continuation.

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
`P(Paris | this prefix)` is softer than it feels. 
The dominant construction must be the appositive, with Paris named before the verb.

## The mechanistic picture

This is the recall-vs-structure split in miniature, and the two channels have different mechanistic signatures.

Grammatical continuation is learned early and is robust — roughly high-order n-gram competence that pervades all text and is cheap to represent. Factual recall is a specific stored lookup. In the key–value-memory view of MLPs (Geva et al., 2021), the subject representation accumulates attribute information across mid layers, and a later attention head moves the object token to the final position. Causal tracing (Meng et al., 2022, ROME) localizes the decisive step to mid-layer MLPs at the *last subject token*. To whatever extent that machinery exists in a 124M model, it is weak: the France→Paris write isn't sharp enough to promote `·Paris` past the generic continuation.

## The most telling line is pos 4, not pos 5

At `"The capital of France"` the argmax is a comma. The most natural reading of that comma is that the model is setting up an **appositive**: *"The capital of France, Paris, is…"*. That is precisely the construction in which the model most wants to name Paris.

The prompt's trailing `"…is"` forecloses the appositive and forces a predicate-nominative slot — and that slot is exactly where the generic continuation wins. The same logic runs through the whole trace: pos 3 `"The capital of"` → `·the` (a determiner, not a country), pos 4 → comma (appositive setup), pos 5 → `·now` (generic predicate). At every position the model takes the locally grammatical continuation and never commits to content.

The upshot is that the knowledge isn't simply missing; it is **more accessible under one syntactic frame than another**. Recall here is *frame-sensitive*. That is a cleaner and stronger claim than "small models don't recall," and it is falsifiable.

## The defensible headline

> For this subject, under greedy decoding, in the predicate-nominative frame, the structural-continuation prior outranks a weak-but-present factual signal — at every scale tested, never losing even at 1.5B, and by a margin that widens as the cue weakens.

Structure and recall are separable, and greedy decoding simply happens to read out the structural channel. The original one-liner survives, but only in this narrower and more precise form — and note it is *not* a small-model story: the prior wins at every size here, just most starkly at the bottom.

---

## Experiments

The argument above is mostly analytical; the claims it rests on are measurable. Each experiment below pairs the original *prediction* with the *result* from running it, roughly in order of effort-to-payoff:

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

Rank 92 out of ~50 k is exactly the "outcompeted, not absent" regime: top hundred, not rank 0, and nowhere near ≫ 1000. Recall is there — the open question is what holds it down, which is what (4) and (5) test.

### 2. The scale curve

This is the load-bearing experiment for the whole framing. Run the same measurement across `gpt2` (124M) → `gpt2-medium` (355M) → `gpt2-large` (774M) → `gpt2-xl` (1.5B) and track the rank/log-prob of `·Paris` and whether it eventually wins the argmax.

*Prediction:* `·Paris` climbs monotonically with scale and crosses into first place at some size. A clean monotone curve is the actual evidence that this is **capacity-limited recall** rather than impossibility — it converts a single anecdote into a claim about where the recall circuit sharpens enough to beat the structural prior.

*Result.* The curve does **not** behave as predicted. `·Paris` improves sharply but **non-monotonically**, and it **never wins the argmax** — not even at 1.5B:

| model | params | rank of `·Paris` | log-prob | argmax? |
|---|---|---|---|---|
| `gpt2`        | 124M | 92 | −6.42 | no |
| `gpt2-medium` | 355M | 3  | −3.71 | no |
| `gpt2-large`  | 774M | 54 | −5.93 | no |
| `gpt2-xl`     | 1.5B | 2  | −3.08 | no |

<small>(Nominal totals, matching the first mention above. `cfg.n_params` reports the lower non-embedding counts — 85M / 302M / 708M / 1.475B — which is what the run printed.)</small>

Two things break the clean capacity-limited story **for France**. First, the curve is non-monotonic: `gpt2-medium` pulls `·Paris` to rank 3, but `gpt2-large` regresses to 54 before `gpt2-xl` recovers to rank 2. Second, the winning token shifts (`·now` → `·the` → `·a`) but stays generic; at gpt2-xl `·Paris` actually outscores `·now` (logit diff +1.26) yet still lands second, losing to ` a` — so for France, `·Paris` is *never* the argmax, at any scale here.

But four ranks on one prompt can't carry a claim about capacity, so I re-ran the measurement as a distribution over the twelve-capital probe set of §7 at every scale:

| model | median rank | IQR | capitals at argmax |
|---|---|---|---|
| `gpt2`        | 27  | [22, 52] | 0 / 12 |
| `gpt2-medium` | 2   | [1, 3]   | 3 / 12 |
| `gpt2-large`  | 33  | [18, 50] | 0 / 12 |
| `gpt2-xl`     | 0.5 | [0, 1]   | 6 / 12 |

This both sharpens the story and corrects it. The **non-monotonicity is real, not a single-prompt artifact**: the population median zigzags the same way (27 → 2 → 33 → 0.5), with `gpt2-large` a genuine regression. But capacity is clearly **not** irrelevant — by gpt2-xl the median capital *is* the argmax (median 0.5, six of twelve winning), so for most subjects scale does eventually carry the recall. **France→Paris is the outlier**: it sits among the worst capitals (rank 2 at xl while the median is 0), exactly the §1 data-dilution signature. So the honest split is that capacity does most of the work across subjects — unevenly, with a real mid-scale regression — while for *this* subject the construction-and-data penalty keeps the name down at every scale. The clean "capacity-limited recall" prediction is wrong in both directions: too pessimistic for the population, too optimistic for France.

<figure>
  <img src="/assets/structure-vs-recall/section_8_median-ranks.png" alt="Top: median rank of the capital token (log y) versus model size (log x) for gpt2, gpt2-medium, gpt2-large, gpt2-xl, with IQR error bars — 27, 2, 33, 0.5, a non-monotonic curve where gpt2-large regresses well above gpt2-medium and gpt2-xl reaches the rank-1 line. Bottom: per-country rank distributions (box plots with points) at each scale, showing the same non-monotonic spread.">
  <figcaption>RUN A — median rank of the capital across the twelve-capital probe set, by scale (IQR bars), with the per-country distribution below. The dip is real, not single-prompt noise: <code>gpt2-large</code> regresses. But by <code>gpt2-xl</code> the median capital is the argmax (6 / 12) — capacity does most of the work across subjects; France is the outlier.</figcaption>
</figure>

<figure>
  <img src="/assets/structure-vs-recall/section_2_plotrank-log-prob-vs-scale.png" alt="Two line plots across gpt2, gpt2-medium, gpt2-large, gpt2-xl. Left: rank of the ' Paris' token on a log axis — 92, 3, 54, 2 — a non-monotonic dip that never reaches rank 1 (dashed line). Right: log-prob of ' Paris' — −6.42, −3.71, −5.93, −3.08 — the mirror-image non-monotonic curve.">
  <figcaption>Rank (left, log axis) and log-prob (right) of the leading-space token <code>·Paris</code> across the GPT-2 family, for the France prompt. The dashed line marks rank 1: for France, `·Paris` never crosses it. The improvement is real but non-monotonic; across the twelve-capital population (table above) most capitals do reach the argmax by gpt2-xl — France is the outlier.</figcaption>
</figure>

### 3. Layer-wise emergence (logit lens, tuned lens, direct logit attribution)

Apply the logit lens (nostalgebraist) or, better, a tuned lens (Belrose et al., 2023) across layers to see *where* `·Paris` gets promoted, if it does.

*Prediction:* in the larger models the `·Paris` logit jumps at specific late mid-layer MLPs, consistent with the ROME localization; in 124M the promotion may never cross the generic-continuation mass. Pinning the layer of promotion in medium/large and showing the corresponding step is weak-or-absent in small is the within-family version of the scale argument.

*Result (gpt2 small).* The promotion happens — and then it settles, it doesn't collapse. Reading the logit lens across all 26 stages (`0_pre … final_post`), `·Paris` stays buried through the early blocks (rank ~10⁴), is promoted from the middle of the stack, reaches an **internal minimum of rank ≈ 13 around `9_mid`**, and then eases back up to **`final_post` = rank 92**. Because the final-layer logit lens (`ln_final` then `W_U`, applied to the last residual) *is* the model's output, that 92 is exactly the §1 number — asserted in code, not a lens estimate.

<figure>
  <img src="/assets/structure-vs-recall/section_3_logit-lens.png" alt="A line plot, logit-lens rank of the ' Paris' token by stage on a log y-axis, across 26 stages from 0_pre to final_post for gpt2 small. The rank stays around 10^4 for the early stages, declines through the middle, drops steeply to an internal minimum near rank 13 around 9_mid, bumps up slightly, and the final_post stage settles around rank 10^2 — the model's true output rank of 92.">
  <figcaption>Logit-lens rank of the leading-space token <code>·Paris</code> across 26 stages in gpt2 small (log axis). Promoted from rank ~10⁴ to an internal minimum of <strong>rank ≈ 13 around <code>9_mid</code></strong>, then easing back to <code>final_post</code> = rank 92, the model's true output (§1). A lens trajectory — a mid-stack rise and a return to the surface level — suggestive, but a lens read, not a direct measurement of the Paris logit.</figcaption>
</figure>

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

The two lenses agree on the *shape* — buried, then rising through the mid stack — but not on the *level*, and the disagreement is the more instructive part. At the one stage with an answer key, the final one, the raw logit lens gives 92 (exact, by construction) while the tuned lens reads rank 4: it **overshoots** `·Paris` exactly where it can be checked. So between the two, trust the raw lens here, and discount the tuned lens's sharper mid-stack numbers as the same optimism applied earlier rather than extra promotion. (That overshoot even cuts toward the thesis: a tuned lens trained on average text expects `·Paris` more available than this adversarial frame delivers — the gap is a signature of how atypical the input is, the §1 data-dilution point from another angle.)

What both lenses genuinely support is modest: `·Paris` rises in the mid-stack reads and is not at the top at the output. The stronger sentence — that the name is *computed* mid-stack and then *outcompeted* — is a lens inference, not yet a measurement, so I measured it directly (next).

*Direct logit attribution (the lens-free version).* Decompose the real final-position residual into per-component contributions, apply the model's own fixed `ln_final` scale, and project each onto the `·Paris` − `·now` logit direction. The pieces sum back to the true logit difference — the reconstruction check passes to within ≈ 1e-6, and that is the whole point: every number here is a fact about the model, not a lens read. Two things fall out, and they are the competition story, now measured:

| promotes `·Paris` (vs `·now`) | DLA | | suppresses (writes `·now`) | DLA |
|---|---|---|---|---|
| **L9H8** | **+1.81** | | `L10_mlp`   | −1.17 |
| L11H3 | +0.45 | | `L0_mlp`    | −1.01 |
| L10H0 | +0.38 | | `L7_mlp`    | −0.77 |
| L11H2 | +0.31 | | unembed bias   | −0.67 |
| L8H11 | +0.27 | | L8H10          | −0.30 |
| L9H3  | +0.24 | | `L5_mlp`    | −0.28 |

**Promotion is localized to one head.** A single attention head, **L9H8, writes +1.81** to the `·Paris` − `·now` logit — more than three times the next component. **Suppression is the MLPs and the unembed bias**, all writing toward the generic continuation. The faithful per-step trajectory shows the duel directly: L9's attention lifts `·Paris` from rank 576 to 69, `L10_mlp` shoves it back to 107, and the output settles at rank 92.

| step | Δ(`·Paris`−`·now`) | rank |
|---|---|---|
| `L8_mlp`     | −0.06 | 576 |
| **`L9_attn`** | **+1.84** | **69** |
| `L9_mlp`     | −0.26 | 72 |
| `L10_attn`   | +0.31 | **38** |
| `L10_mlp`    | −1.17 | 107 |
| `L11_attn`   | +0.67 | 55 |
| `L11_mlp`    | +0.03 | **92** |

So "computed mid-stack, then outranked toward the surface" is no longer a lens inference — it is the measured behaviour: a specific recall head writes the name, the MLPs (and the bias) write the generic continuation more strongly, and the name loses. The mechanism at the output is **competition, not a dedicated suppressor circuit**, and §6's "generic mass" has a face — the late MLPs. (Note this already inverts the §3 prediction's ROME expectation: the writer is a single *attention head*, not the mid-layer MLPs, and the MLPs here *suppress* the fact rather than store it.)

Two honest corrections come with it. First, the DLA-faithful trajectory — which differs from §3's logit lens *only* by using the final fixed scale instead of per-layer scales — bottoms at **rank 38** (at `L10_attn`), not ~13: the deeper dip the logit lens showed was partly a per-layer-scale artifact, and the direction-only internal best is shallower. Second, DLA credits only the *direct* path component → logit, so a head acting *through* a later component would be miscredited to that component; the clean complement is the path patching of §5, which confirms it directly — and shows L9H8's own output is then routed *suppressively*. The shape, though, is now a fact: lifted to the 60s by L9H8 (a low of rank 38 by `L10_attn`), then pushed back to 92 by the late MLPs.

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

The appositive (`…France,`) and the cloze (`…is the city of`) both put `·Paris` first; the QA frame surfaces it to rank 4. Nothing about the model changed — only the syntax of the slot. So the knowledge is unambiguously *present and gated by frame*: `·now` wins the predicate-nominative slot not because the model can't recall Paris, but because that specific construction routes around the name. The central claim is now directly observable, not inferred.

### 5. Causal test: activation patching

Frames 1 and 4 give a clean patching setup. Take a frame where `·Paris` surfaces, run it, and patch its final-position residual (then, to localize, individual layers/components) into the predicate-nominative frame. Check whether the argmax flips to `·Paris`.

```python
# sketch: cache a Paris-surfacing frame, patch its final-pos resid into the PN frame
_, cache = model.run_with_cache(appositive_frame)
def patch_resid(resid, hook):
    resid[:, -1, :] = cache[hook.name][:, -1, :]
    return resid
patched = model.run_with_hooks(pn_frame,
    fwd_hooks=[(utils.get_act_name("resid_post", L), patch_resid)])
```

*Prediction:* patching from a Paris-surfacing frame flips, or sharply raises, `·Paris` in the predicate-nominative frame, and the effect concentrates in a small set of mid-to-late layers. This is what distinguishes "knowledge present but frame-gated" from "knowledge absent" — the difference the greedy trace alone can't see.

*Result.* Patching the donor (appositive) frame's final-position `resid_post` into the predicate-nominative frame **flips `·Paris` to rank 0** (argmax), with Δ log-prob +5.17 over baseline. The flip half of the prediction holds outright. The *localization* half does not: the effect is **high and nearly flat across all twelve layers** (≈ +5.17 at each) — patching at layer 0 helps about as much as patching at layer 11.

<figure>
  <img src="/assets/structure-vs-recall/section_5_per-layer-patch-effect.png" alt="A bar chart, per-layer patch effect. For each patched layer 0 through 11 (resid_post at the final position), the bar shows the change in log-prob of ' Paris' versus baseline. Every bar is the same height, about 5.17.">
  <figcaption>Patching the donor frame's final-position residual into the predicate-nominative frame, one layer at a time. Δ log-prob of `·Paris` is a flat ≈ +5.17 at every depth, and the argmax flips to `·Paris` in all cases.</figcaption>
</figure>

Two caveats keep this from being an independent pillar. First, the donor frame `"The capital of France,"` is just the predicate-nominative frame with its final token swapped from `is` to a comma — same subject, same length — so the patch largely re-derives §4 rather than adding new causal content. Second, the flatness: patching the *whole* final-position residual carries enough of the donor state to flip the readout no matter where it's injected — quite possibly saturating it — so this patch localizes nothing. Pinning the responsible step needs finer interventions (specific MLPs / attention heads, not the full `resid_post`) plus a negative control (a *non*-Paris donor should leave the rank unchanged) — both run below.

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
