---
layout: article
title: 'The bear detector that thought I was a grizzly'
description: A post-hoc out-of-distribution study on a 3-class bear classifier — MSP vs energy, far-OOD vs near-OOD, and the negative result I didn't see coming.
summary: I tried to teach a 3-class bear classifier to say "I don't know" without retraining it. Far-OOD was easy. Near-OOD humbled me — and the fancy energy score lost to the plain baseline.
date: 2026-06-02
tags: [PyTorch, OOD detection, calibration]
permalink: /writing/ood-detection/
---

*A small OOD-detection study bolted onto the [bear detector](https://rfflpllcn-bear-detector.hf.space)
I deployed as a Hugging Face Space — and the negative result that turned out to be
the interesting part.*

## A model that cannot say no

I was working through [fast.ai lesson 2](https://course.fast.ai/Lessons/lesson2.html),
where the homework is a bear detector. I built mine in pure PyTorch — a ResNet-18
with a hard-coded softmax over **black**, **grizzly** and **teddy** bears — pushed
it to a Hugging Face Space with Gradio, and felt briefly pleased with myself.

Then I uploaded a photo of my own face. The model thought about it for a few
milliseconds and announced: **"grizzly, 70% confident."**

I want to be clear that this is not a bug. It's the design working exactly as
specified, which is worse. The model collapses the entire visual universe — every
photo that has ever existed or could exist — down to three species of bear. It is
*structurally* incapable of the answer "that's not a bear." Show it a cat, a
car, a sunset, my face: it will confidently hand back a bear. The failure is
silent, instant, and delivered with the serene self-assurance of someone who has
never once been wrong.

That confidence is the whole problem, and it's also the only thing I had to work
with. So I set myself a constraint: get this model closer to "I don't know"
**without retraining it**, using only the numbers it already produces. No new
data, no new weights — just whatever signal is already hiding in the outputs.

## Softmax is a costume, not a probability

Here's the uncomfortable truth the softmax hides. It takes the three logits the
network spits out, applies `exp`, and divides by the sum. The outputs now add to
1 and *look* exactly like a probability distribution. They are not one. It's a
normalization wearing a probability costume.

That said, the costume isn't worthless. The **maximum softmax probability (MSP)**
really does carry signal — Hendrycks & Gimpel (2017), *A Baseline for Detecting
Misclassified and Out-of-Distribution Examples in Neural Networks*, said it best:

> "the prediction probability of incorrect and out-of-distribution examples
> tends to be lower than the prediction probability for correct examples.
> Therefore, capturing prediction probability statistics about correct or
> in-sample examples is often sufficient for detecting whether an example is in
> error or abnormal, even though the prediction probability viewed in isolation
> can be misleading."

The deeper issue underneath is calibration. As Guo et al. (2017), *On Calibration
of Modern Neural Networks*, put it:

> "a network should provide a calibrated confidence measure in addition to its
> prediction. In other words, the probability associated with the predicted
> class label should reflect its ground truth correctness likelihood."

So MSP is my baseline — the honest, dumb, hard-to-beat thing every fancier method
has to justify itself against. The plan: reproduce an experiment in the spirit of
Hendrycks & Gimpel §3 — measure how well the model's own confidence separates real
bears from non-bears — and then try to beat it with something cleverer.

## The cleverer thing: energy

MSP has a specific weakness *for this model in particular*. With only **3
classes**, the maximum softmax probability is trapped in `[1/3, 1]`. There's
barely any room for the score to move — it's like trying to measure temperature
with a thermometer that only goes from lukewarm to lukewarm.

The **energy score** (Liu et al., 2020, *Energy-based Out-of-distribution
Detection*) skips the normalization entirely and reads straight off the logits:

```
energy = -logsumexp(logits)
```

Low energy means "I'm sure this is in-distribution"; high energy means "this is
strange." Crucially, energy isn't squeezed into a bounded range, so it keeps more
of the raw signal. On the standard benchmarks the paper shows energy beating MSP
fairly consistently. So I ran both, on my own weights, and waited to watch energy
win.

## The experiment

Everything runs on the **real** deployed weights (`bear_detector.pth`), reusing
the exact architecture and preprocessing from the serving code — no idealized
re-train, the actual thing in production. The full evaluation lives in
[`calibrate_threshold.py`](https://github.com/rp-playground/play-pytorch/blob/main/course.fast.ai/lesson2/app/serving/calibrate_threshold.py).

- **In-distribution:** my held-out `bear_test/` set (99 real bear photos).
- **Metric:** FPR at TPR 95 — fix a threshold so 95% of real bears get accepted,
  then measure what fraction of non-bears *also* sneak through. Lower is better.
  The threshold is pinned by the in-dist bears alone; the OOD sets only measure
  leakage.
- **Two OOD regimes, because difficulty is not one number:**
  - **far-OOD** — [DTD](https://huggingface.co/datasets/tanganke/dtd), the
    Describable Textures Dataset. Pure textures, no object semantics. The gimme.
  - **near-OOD** — [Oxford-IIIT Pet](https://www.robots.ox.ac.uk/~vgg/data/pets/):
    37 cat and dog breeds. Furry quadruped mammals sitting visually right next to
    bears but — crucially — containing **no actual bears** (so real bears can't
    leak in and quietly corrupt the metric). This is the case I actually care about.

First, what the two signals look like on real bears:

| signal | min | mean | max |
|--------|-----|------|-----|
| energy | -5.58 | -3.49 | -1.57 |
| MSP    | 0.536 | **0.952** | 0.9997 |

Sit with that MSP mean of **0.95** for a second, because it's the calibration
problem made concrete. On held-out bears the network is, on average, 95% confident
— and these are the *easy* in-distribution cases. When your floor is already this
high, there's no headroom left to separate real bears from impostors. Concretely:

* A cat that scores, say, 0.85 lands *inside* the bears' own range. There's no
  clean line that keeps the bears in and the cat out — the two crowds mingle at
  the top of the scale.
* The confidence is systematically higher than the model's actual competence
  justifies. This is just what modern nets do (Guo et al.), and a 3-class softmax
  trained on a few hundred images makes it dramatically worse.
* The entire premise of MSP detection is that OOD inputs look *less* confident
  than in-distribution ones. But if the in-distribution bears are pinned at 0.95+,
  the model has already spent all its confidence — there's no quiet, low-confidence
  region left for weird inputs to fall into.
* Energy, at least, has no ceiling. It runs −5.58 to −1.57, unbounded by design,
  so in *principle* it has more room for OOD inputs to peel away. Hold that
  thought — near-OOD is about to take it out behind the shed.

Calibrated thresholds at TPR 95:

```
energy = -1.9841   (flag OOD if energy > thr)
msp    =  0.8034   (flag OOD if msp    < thr)
```

## Results

FPR at TPR 95 — fraction of non-bears that bypass the filter (lower is better):

| OOD set | regime | energy | MSP |
|---------|--------|--------|-----|
| DTD  | far-OOD  | **7.13%**  | 12.61% |
| Pets | near-OOD | 28.75% | **17.33%** |

Two things fell out of this table. The first I expected. The second is why I
bothered writing it up.

**1. Far-OOD is easy, and energy wins it.** On textures, energy leaks 7% against
MSP's 13%. Good — the textbook holds, and the pipeline isn't broken. A relief, and
a sanity check, in that order.

**2. Near-OOD breaks everything — and MSP, the dumb baseline, *beats* energy.**
Against cats and dogs, energy leaks a brutal **28.75%**: better than one pet in
four strolls past the filter wearing a "bear" badge. Worse, the supposedly-superior
energy score does *worse* than plain old softmax (17.33%) on the exact case I built
this for.

That is the opposite of the result I went in expecting. Energy's advantage on the
big benchmarks — ImageNet-scale models, hundreds of classes — simply does **not**
survive the trip down to a tiny 3-class head fine-tuned on a few hundred bears. And
here's the honest reading, the one that took me a minute to accept: the answer is
*not* "use energy instead of MSP." Both scores are just scalars squeezed out of
the same three logits. On near-OOD inputs those logits are already fooled — the cat
genuinely lights up the bear neurons — and no formula computed downstream can
recover a distinction the network never learned in the first place. You cannot
arithmetic your way out of a perception problem.

## Looking the failures in the eye

Let me show you what slipped past the energy filter. Both of these are false
positives the model confidently filed under "bear," with energy scores sitting
comfortably below the −1.98 threshold. The images are shown exactly as the model
saw them: resized, cropped, normalized.

| near-OOD (Oxford Pet), energy −3.05 | far-OOD (DTD), energy −3.29 |
|---|---|
| ![A cat the model is sure is a bear](/assets/ood/near-ood-cat-energy-3.05.png) | ![A texture the model is sure is a bear](/assets/ood/far-ood-texture-energy-3.29.png) |

Once you see them, the failure stops being mysterious and starts being almost
reasonable. The model has learned to track fur and lumpy brown texture — and a
ginger cat in profile and a pile of pumpkins push on the *same* channels as a
brown bear. From the model's point of view, these really do look like bears. It's
not hallucinating; it's pattern-matching exactly what we taught it to.

## Choosing a threshold

Picking the threshold is a tug-of-war: too strict and you start rejecting real
bears, too loose and the impostors waltz in. Here's the trade-off for energy:

```
  TPR     thresh       DTD      Pets
  ------------------------------------
  0.80    -2.4739     1.65%     8.75%
  0.90    -2.2377     3.72%    15.67%
  0.95    -1.9841     7.13%    28.75%   <- default
  0.97    -1.9690     7.61%    29.71%
  0.99    -1.8306    12.34%    38.38%
```

Even if I get aggressive and throw away **one real bear in five** (TPR 0.80),
~9% of pets still leak. There is no row in this table where the near-OOD problem
politely goes away. You can move the pain around; you can't make it disappear.

> Try it live: the [Hugging Face Space](https://rfflpllcn-bear-detector.hf.space)
> exposes this exact trade-off — drag the TPR slider and watch the threshold,
> the verdict, and the leakage move in real time.

## Verdict, and what's next

- A closed-set softmax classifier fails silently and confidently on OOD input.
  This is structural, not a tuning issue.
- You *can* recover a usable OOD signal post-hoc, straight from the logits.
- On **far-OOD** it works fine, and **energy > MSP**, as advertised.
- On **near-OOD** — the only case I actually cared about — it's weak, and on this
  small model **MSP > energy**, flatly contradicting the standard result.

The lesson I'm taking away isn't "pick a better scalar." It's that the fix has to
come from more *information*, not a cleverer summary of the same three numbers.
The natural next steps both add information rather than re-squeezing it:

- **Outlier exposure** (Hendrycks et al., 2019) — fine-tune the model to push
  energy up on known non-bears, so "not a bear" becomes something it has actually
  seen.
- **Temperature scaling / proper calibration** (Guo et al.) — at least stop the
  model from spending all its confidence before the test even starts.

## Reproduce it

```bash
cd app/serving
# compares MSP vs energy on far-OOD (DTD) + near-OOD (Pets),
# auto-downloads both, and dumps a sample of the false positives
MODEL_PATH=../../bear_detector.pth python calibrate_threshold.py \
    --ood-dataset dtd pets --save-fp ./fp_samples
```

---

### References

- Hendrycks & Gimpel (2017). *A Baseline for Detecting Misclassified and
  Out-of-Distribution Examples in Neural Networks.*
- Liu, Wang, Owens & Li (2020). *Energy-based Out-of-distribution Detection.*
- Guo, Pleiss, Sun & Weinberger (2017). *On Calibration of Modern Neural
  Networks.*
- Hendrycks, Mazeika & Dietterich (2019). *Deep Anomaly Detection with Outlier
  Exposure.*
- Cimpoi et al. (2014). *Describing Textures in the Wild* (DTD).
- Parkhi et al. (2012). *Cats and Dogs* (Oxford-IIIT Pet).
</content>
</invoke>
