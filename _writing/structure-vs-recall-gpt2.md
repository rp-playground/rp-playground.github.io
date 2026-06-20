---
layout: article
title: "The capital of France is ` now`"
subtitle: "Structure vs. Recall in GPT-2 Small"
description: GPT-2 small continues "The capital of France is" with " now", not " Paris". A walk through the tools — logit lens, per-position traces, token frequency — that test whether the model is continuing a form or failing to retrieve a fact, and what they actually show.
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

## A preliminary rumbling

Feed GPT-2 small (124M) the prompt `"The capital of France is"`, decode greedily, and the next token is ` now`. 
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

Feeding GPT-2 small (124M) the prompt `"The capital of France is"` and decoding greedily, the next token is ` now`. The per-position trace shows the same behaviour at every step: each prefix is continued with the locally most grammatical token rather than with content.

```
pos 2  '...The capital'            -> ' of'
pos 3  '...The capital of'         -> ' the'
pos 4  '...The capital of France'  -> ','
pos 5  '...The capital of France is' -> ' now'
```

The easy conclusion is that Paris simply isn't there — that the model continues the form at every step and never retrieves
the fact. That is almost right.

## Correcting the naive reading

Greedy decoding reports only the **argmax** — the single most probable token. So the trace shows that ` now` beats every other token for *first place*; it does **not** show that ` Paris` is absent from the distribution. Tokens like ` now`, ` a`, ` home`, ` one` are generic post-copula continuations that are valid across essentially every topic in the corpus. For ` Paris` to take the top slot it has to outscore that entire mass of generic continuations, and at 124M it doesn't.

Recall is most likely present but sub-argmax — pushed down, not missing.

## Two reasons structure wins here

Two forces make the generic continuation win.

The first is distributional frequency. `is now / is a / is home to` is extremely high-frequency everywhere in text, whereas ` Paris` is a rarer token that only pays off under one specific subject–attribute association. Absent a sharp signal, the model defaults to the high-frequency continuation.

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

Grammatical continuation is learned early and is robust — roughly high-order n-gram competence that pervades all text and is cheap to represent. Factual recall is a specific stored lookup. In the key–value-memory view of MLPs (Geva et al., 2021), the subject representation accumulates attribute information across mid layers, and a later attention head moves the object token to the final position. Causal tracing (Meng et al., 2022, ROME) localizes the decisive step to mid-layer MLPs at the *last subject token*. To whatever extent that machinery exists in a 124M model, it is weak: the France→Paris write isn't sharp enough to promote ` Paris` past the generic continuation.

## The most telling line is pos 4, not pos 5

At `"The capital of France"` the argmax is a comma. The most natural reading of that comma is that the model is setting up an **appositive**: *"The capital of France, Paris, is…"*. That is precisely the construction in which the model most wants to name Paris.

The prompt's trailing `"…is"` forecloses the appositive and forces a predicate-nominative slot — and that slot is exactly where the generic continuation wins. The same logic runs through the whole trace: pos 3 `"The capital of"` → ` the` (a determiner, not a country), pos 4 → comma (appositive setup), pos 5 → ` now` (generic predicate). At every position the model takes the locally grammatical continuation and never commits to content.

The upshot is that the knowledge isn't simply missing; it is **more accessible under one syntactic frame than another**. Recall here is *frame-sensitive*. That is a cleaner and stronger claim than "small models don't recall," and it is falsifiable.

## The defensible headline

> For this subject, under greedy decoding, in the predicate-nominative frame, the structural-continuation prior dominates a weak-but-present factual signal — and that dominance grows as the model shrinks or the cue weakens.

Structure and recall are separable. Greedy on a small model simply happens to read out the structural channel. The original one-liner survives, but only in this narrower and more precise form.

---

## Experiments

The argument above is mostly analytical; the claims it rests on are measurable. Each experiment below pairs the original *prediction* with the *result* from running it, roughly in order of effort-to-payoff:

### 1. Locate ` Paris` in the distribution

The first thing to settle empirically is whether ` Paris` is sub-argmax or genuinely suppressed. Report its rank and log-prob in the final-position distribution, for both the leading-space token ` Paris` and the bare `Paris`, and check the BPE segmentation so nothing is missed.

```python
last = model(model.to_tokens(prompt))[0, -1]
logprobs = last.log_softmax(-1)
for s in (" Paris", "Paris"):
    tid = model.to_single_token(s)
    rank = (logprobs > logprobs[tid]).sum().item()
    print(f"{s!r:9s} rank={rank:5d}  logprob={logprobs[tid]:.2f}")
```

*Prediction:* ` Paris` lands in the top tens of tokens but not at rank 0. If it's genuinely far down (rank ≫ 1000), the "present but outcompeted" story weakens and the data-dilution explanation gets relatively more weight.

*Result.* The leading-space token ` Paris` sits at **rank 92** (log-prob −6.42) — present and clearly sub-argmax, not buried. The bare `Paris` (the wrong tokenization after a trailing space) is far down at rank 12 973; both are single tokens.

| token | segmentation | rank | log-prob | multitoken |
|---|---|---|---|---|
| `" Paris"` | `[" Paris"]` | 92 | −6.42 | False |
| `"Paris"`  | `["Paris"]`  | 12 973 | −14.57 | False |

Rank 92 out of ~50 k is exactly the "outcompeted, not absent" regime: top hundred, not rank 0, and nowhere near ≫ 1000. Recall is there — the open question is what holds it down, which is what (4) and (5) test.

### 2. The scale curve

This is the load-bearing experiment for the whole framing. Run the same measurement across `gpt2` (124M) → `gpt2-medium` (355M) → `gpt2-large` (774M) → `gpt2-xl` (1.5B) and track the rank/log-prob of ` Paris` and whether it eventually wins the argmax.

*Prediction:* ` Paris` climbs monotonically with scale and crosses into first place at some size. A clean monotone curve is the actual evidence that this is **capacity-limited recall** rather than impossibility — it converts a single anecdote into a claim about where the recall circuit sharpens enough to beat the structural prior.

*Result.* The curve does **not** behave as predicted. ` Paris` improves sharply but **non-monotonically**, and it **never wins the argmax** — not even at 1.5B:

| model | params | rank of ` Paris` | log-prob | argmax? |
|---|---|---|---|---|
| `gpt2`        | 124M | 92 | −6.42 | no |
| `gpt2-medium` | 355M | 3  | −3.71 | no |
| `gpt2-large`  | 774M | 54 | −5.93 | no |
| `gpt2-xl`     | 1.5B | 2  | −3.08 | no |

<small>(Nominal totals, matching the first mention above. `cfg.n_params` reports the lower non-embedding counts — 85M / 302M / 708M / 1.475B — which is what the run printed.)</small>

Two things break the clean capacity-limited story. First, the curve is non-monotonic: `gpt2-medium` already pulls ` Paris` to rank 3, but `gpt2-large` regresses to 54 before `gpt2-xl` recovers to rank 2. Second, and more telling, the predicate-nominative frame keeps a *generic* continuation on top at **every** scale — even gpt2-xl puts ` Paris` second, never first. Scale clearly sharpens recall (rank 92 → single digits; log-prob −6.4 → −3.1), but it does not, on its own, overturn the structural prior of the `…is ___` slot. That shifts weight toward **frame-sensitivity and data-dilution** over raw capacity — precisely what the frame swap (4) and activation patching (5) are built to isolate.

<figure>
  <img src="/assets/structure-vs-recall/section_2_plotrank-log-prob-vs-scale.png" alt="Two line plots across gpt2, gpt2-medium, gpt2-large, gpt2-xl. Left: rank of the ' Paris' token on a log axis — 92, 3, 54, 2 — a non-monotonic dip that never reaches rank 1 (dashed line). Right: log-prob of ' Paris' — −6.42, −3.71, −5.93, −3.08 — the mirror-image non-monotonic curve.">
  <figcaption>Rank (left, log axis) and log-prob (right) of the leading-space token <code>· Paris</code> across the GPT-2 family. The dashed line marks rank 1: ` Paris` never crosses it. The improvement is real but non-monotonic, and the predicate-nominative frame keeps a generic continuation on top at every scale.</figcaption>
</figure>

### 3. Layer-wise emergence (logit / tuned lens)

Apply the logit lens (nostalgebraist) or, better, a tuned lens (Belrose et al., 2023) across layers to see *where* ` Paris` gets promoted, if it does.

*Prediction:* in the larger models the ` Paris` logit jumps at specific late mid-layer MLPs, consistent with the ROME localization; in 124M the promotion may never cross the generic-continuation mass. Pinning the layer of promotion in medium/large and showing the corresponding step is weak-or-absent in small is the within-family version of the scale argument.

*Result (gpt2 small).* The promotion happens — and then it settles, it doesn't collapse. Reading the logit lens across all 26 stages (`0_pre … final_post`), ` Paris` stays buried through the early blocks (rank ~10⁴), is promoted from the middle of the stack, reaches an **internal minimum of rank ≈ 13 around `9_mid`**, and then eases back up to **`final_post` = rank 92**. Because the final-layer logit lens (`ln_final` then `W_U`, applied to the last residual) *is* the model's output, that 92 is exactly the §1 number — asserted in code, not a lens estimate.

<figure>
  <img src="/assets/structure-vs-recall/section_3_logit-lens.png" alt="A line plot, logit-lens rank of the ' Paris' token by stage on a log y-axis, across 26 stages from 0_pre to final_post for gpt2 small. The rank stays around 10^4 for the early stages, declines through the middle, drops steeply to an internal minimum near rank 13 around 9_mid, bumps up slightly, and the final_post stage settles around rank 10^2 — the model's true output rank of 92.">
  <figcaption>Logit-lens rank of the leading-space token <code>· Paris</code> across 26 stages in gpt2 small (log axis). Promoted from rank ~10⁴ to an internal minimum of <strong>rank ≈ 13 around <code>9_mid</code></strong>, then easing back to <code>final_post</code> = rank 92, the model's true output (§1). Present internally, gated out at the surface.</figcaption>
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

The two lenses agree on the *trajectory* — buried, promoted mid-stack, then near-top — but not on the absolute *level*: the tuned lens closes at rank 4, the raw logit lens at 92. That divergence is the point. A tuned lens applies learned per-layer translators, so it *should* read the same final residual differently from the raw unembed, and here it does — the story no longer rests on a single lens's approximation. Either way the cautious half of the prediction is wrong: the recall machinery is present even at 124M, ` Paris` is sharply promoted mid-stack (the kind of late-layer write ROME localizes), and what it *can't* do is survive to the output — computed internally, then demoted toward the surface, gated out by the construction.

### 4. Frame-sensitivity sweep

Hold scale fixed and vary only the syntactic frame, measuring the rank of ` Paris` in each:

- predicate-nominative — `"The capital of France is"`
- appositive — `"The capital of France,"`
- QA — `"Q: What is the capital of France? A:"`
- cloze / definitional — `"The capital of France is the city of"`

*Prediction:* the appositive and QA frames surface ` Paris` much higher — plausibly at argmax — even at 124M. If a frame change alone flips the readout at fixed weights, the knowledge was there and gated by syntax, which is the central claim made directly observable.

*Result.* This is the cleanest evidence in the whole piece. At **fixed weights**, changing only the frame moves ` Paris` from rank 92 to **rank 0 — the argmax** — in two of the four frames:

| frame | prompt | rank | log-prob | argmax |
|---|---|---|---|---|
| predicate-nominative | `"The capital of France is"`        | 92 | −6.42 | no |
| appositive           | `"The capital of France,"`           | **0** | −1.25 | **yes** |
| QA                   | `"Q: What is the capital of France? A:"` | 4 | −3.64 | no |
| cloze / definitional | `"The capital of France is the city of"` | **0** | −2.33 | **yes** |

The appositive (`…France,`) and the cloze (`…is the city of`) both put ` Paris` first; the QA frame surfaces it to rank 4. Nothing about the model changed — only the syntax of the slot. So the knowledge is unambiguously *present and gated by frame*: ` now` wins the predicate-nominative slot not because the model can't recall Paris, but because that specific construction routes around the name. The central claim is now directly observable, not inferred.

### 5. Causal test: activation patching

Frames 1 and 4 give a clean patching setup. Take a frame where ` Paris` surfaces, run it, and patch its final-position residual (then, to localize, individual layers/components) into the predicate-nominative frame. Check whether the argmax flips to ` Paris`.

```python
# sketch: cache a Paris-surfacing frame, patch its final-pos resid into the PN frame
_, cache = model.run_with_cache(appositive_frame)
def patch_resid(resid, hook):
    resid[:, -1, :] = cache[hook.name][:, -1, :]
    return resid
patched = model.run_with_hooks(pn_frame,
    fwd_hooks=[(utils.get_act_name("resid_post", L), patch_resid)])
```

*Prediction:* patching from a Paris-surfacing frame flips, or sharply raises, ` Paris` in the predicate-nominative frame, and the effect concentrates in a small set of mid-to-late layers. This is what distinguishes "knowledge present but frame-gated" from "knowledge absent" — the difference the greedy trace alone can't see.

*Result.* Patching the donor (appositive) frame's final-position `resid_post` into the predicate-nominative frame **flips ` Paris` to rank 0** (argmax), with Δ log-prob +5.17 over baseline. The flip half of the prediction holds outright. The *localization* half does not: the effect is **high and nearly flat across all twelve layers** (≈ +5.17 at each) — patching at layer 0 helps about as much as patching at layer 11.

<figure>
  <img src="/assets/structure-vs-recall/section_5_per-layer-patch-effect.png" alt="A bar chart, per-layer patch effect. For each patched layer 0 through 11 (resid_post at the final position), the bar shows the change in log-prob of ' Paris' versus baseline. Every bar is the same height, about 5.17.">
  <figcaption>Patching the donor frame's final-position residual into the predicate-nominative frame, one layer at a time. Δ log-prob of ` Paris` is a flat ≈ +5.17 at every depth, and the argmax flips to ` Paris` in all cases.</figcaption>
</figure>

The flatness is itself a caveat: patching the *whole* final-position residual carries enough of the donor state to flip the readout no matter where it's injected — quite possibly saturating it — so this patch localizes nothing. Pinning the responsible step needs finer interventions — individual components (specific MLPs / attention heads) rather than the full `resid_post` — plus a negative control (patching from a *non*-Paris frame should leave the rank unchanged). What this run does establish is the causal direction: the predicate-nominative state is one residual edit away from naming Paris.

### 6. SAE feature analysis and causal suppression

Port the suppression methodology directly. At the layers implicated in (3)/(5), check whether an SAE has an interpretable `France` / `capital` / `Paris`-association feature, and whether it fires on this prompt. Then suppress it and confirm ` Paris` drops further; amplify it and check whether ` Paris` surfaces in the predicate-nominative frame. This is the same move as causal suppression of the `whales` feature in the Moby-Dick narrator task, applied to a factual-recall target instead of a narrative one — and it would let the three-regime taxonomy (content-routed recall / heuristic substitution / format fallback) be tested on a fact rather than a literary retrieval.

*Result.* Using the layer-7 residual SAE (`7-res-jb`), I took the top-activating features on the prompt and ablated each one (`scale = 0`), reading the effect on ` Paris` (baseline rank 92). The picture is **distributed, and runs the opposite way to the naive expectation**: most of the strongly-active features are *suppressing* ` Paris` — removing them lifts it — and none is a clean "Paris feature".

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

Ablating each one (`scale = 0`) and re-reading the rank of ` Paris`:

| SAE feature (L7) | activation | rank when ablated | effect on ` Paris` |
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

Ablating the strongest suppressor (17045) moves ` Paris` from 92 to 47 — a real lift, but nowhere near the argmax. Conversely the *highest-activating* feature, 10165, is one of the few that *support* ` Paris`: removing it pushes the rank down to 188. So at this layer/position the active features are predominantly generic-continuation promoters competing with the name, rather than a single interpretable France→Paris circuit. That is evidence *against* the clean single-feature suppression story and *for* the distributed "generic mass" account from §3–§4.

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

**Confirmed: the knowledge is present and gated by frame, not absent.** ` Paris` is sub-argmax (rank 92) in the predicate-nominative frame (§1), yet changing only the syntax surfaces it to the **argmax** — rank 0 in the appositive and cloze frames (§4) — and patching a single residual from a Paris-surfacing frame flips the predicate-nominative readout to ` Paris` (§5). The logit lens shows the same arc inside the stack: the name is promoted to rank 3 by layer 9, then demoted by the final layers (§3). Greedy decoding on a small model simply reads out the structural channel; the factual channel is there the whole time.

**Complicated: capacity is not the binding constraint.** The original framing implied a capacity story — ` Paris` would win once the model is big enough. It doesn't. From `gpt2` to `gpt2-xl` the rank improves but **non-monotonically, and never reaches the argmax even at 1.5B** (§2); the predicate-nominative frame keeps a generic continuation on top at every scale. The suppression is distributed across many features rather than a single clean circuit (§6), and it is not a France quirk — the bare capital is sub-argmax for all twelve countries tested, *never* the argmax (§7), with France→Paris among the harder cases. So the limitation lives partly in the **construction and the data** — the `…is ___` slot is appositive-dominated and `P(capital | "the capital of X is")` is soft in the training distribution — not in raw model size.

That second half is the more interesting finding, and the one to lead with. The headline is not "small models can't recall"; it is that in this frame, at every scale, a structural-continuation prior outranks a present-but-soft factual signal, and the softness is as much in the data as in the model.

### References

- Geva et al. (2021), *Transformer Feed-Forward Layers Are Key-Value Memories.*
- Meng et al. (2022), *Locating and Editing Factual Associations in GPT* (ROME).
- Belrose et al. (2023), *Eliciting Latent Predictions from Transformers with the Tuned Lens.*
- nostalgebraist (2020), *interpreting GPT: the logit lens.*
