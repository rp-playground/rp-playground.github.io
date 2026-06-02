---
layout: article
title: 'Teaching a bear detector to say "I don''t know"'
description: A post-hoc out-of-distribution study on a 3-class bear classifier — MSP vs energy, far-OOD vs near-OOD, and an honest negative result.
date: 2026-06-02
permalink: /writing/ood-detection/
---

*A small OOD-detection study bolted onto the [bear detector](https://rfflpllcn-bear-detector.hf.space)
I deployed as a Hugging Face Space.*

## The setup, and the problem

I was working through [fast.ai lesson 2](https://course.fast.ai/Lessons/lesson2.html),
where the task is to build a bear detector. I built it in pure PyTorch — a
ResNet-18 with a hard-coded softmax over **black**, **grizzly** and **teddy**
bears — and deployed it on a Hugging Face Space with Gradio.

Then I fed it a photo of a human. It said something like **"grizzly, 70%
confident"**.

That's the whole problem. The model reduces the universe (of
all possible images) to exactly three species of bear. It is *structurally
incapable* of saying "none of these". Show it a cat, a car, a coffee mug — it
will still pick a bear. A silent, irritatingly confident failure
the moment it sees out-of-distribution (OOD) data.

So I wanted to see how far I could push it toward "I don't know"
*without retraining the model*, using only the signals already hiding in its
outputs.

## Raw softmax isn't a probability, it's a normalization

The softmax takes the three logits the network produces, applies `exp`, and
divides by their sum. That makes them sum to 1 and *look* like they came out of
a probability distribution. They don't — it's just a normalization.

Still, the **maximum softmax probability (MSP)** isn't useless as a signal.
Hendrycks & Gimpel (2017), *A Baseline for Detecting Misclassified and
Out-of-Distribution Examples in Neural Networks*, put it well:

> "the prediction probability of incorrect and out-of-distribution examples
> tends to be lower than the prediction probability for correct examples.
> Therefore, capturing prediction probability statistics about correct or
> in-sample examples is often sufficient for detecting whether an example is in
> error or abnormal, even though the prediction probability viewed in isolation
> can be misleading."

The deeper issue is calibration. As Guo et al. (2017), *On Calibration of
Modern Neural Networks*, frame it:

> "a network should provide a calibrated confidence measure in addition to its
> prediction. In other words, the probability associated with the predicted
> class label should reflect its ground truth correctness likelihood."

So MSP is the baseline. The plan: reproduce an experiment in the spirit of
Hendrycks & Gimpel §3 — measure how well the model's own confidence separates
real bears from non-bears — and then try a stronger signal.

## A stronger signal: energy

The MSP has an obvious weakness *for this model in particular*: with only **3
classes**, the maximum softmax probability is squeezed into `[1/3, 1]`. There
just isn't much room for the score to move. (And it saturates — more on that
below.)

The **energy score** (Liu et al., 2020, *Energy-based Out-of-distribution
Detection*) sidesteps the normalization entirely. It's computed straight from
the logits:

```
energy = -logsumexp(logits)
```

Low energy means the model is confident the input is in-distribution; high
energy means it isn't. Unlike the softmax, it doesn't get normalized into a
bounded range, so it keeps more of the signal. The paper benchmarks energy
against MSP and generally wins — so I ran both, on my own model.

## The experiment

Everything runs on the **real** deployed weights (`bear_detector.pth`), reusing
the exact architecture and preprocessing from the serving code — no mock model,
no train/serve skew. The full harness is
[`calibrate_threshold.py`](https://github.com/rp-playground/play-pytorch/blob/main/course.fast.ai/lesson2/app/serving/calibrate_threshold.py).

- **In-distribution:** my held-out `bear_test/` set (99 real bear photos).
- **Metric:** FPR at TPR 95 — calibrate a threshold so 95% of real bears are
  accepted, then measure what fraction of non-bears *also* sneak through. Lower
  is better. The threshold is fixed by the in-dist bears alone; the OOD sets
  only measure leakage.
- **Two OOD regimes:**
  - **far-OOD** — [DTD](https://huggingface.co/datasets/tanganke/dtd), the
    Describable Textures Dataset. Textures, no object semantics. The easy case.
  - **near-OOD** — [Oxford-IIIT Pet](https://www.robots.ox.ac.uk/~vgg/data/pets/):
    37 cat and dog breeds. Furry quadruped mammals, visually adjacent to bears
    but — crucially — containing **no bears** (so real bears can't leak in and
    corrupt the metric).

First, what the two signals look like on real bears:

| signal | min | mean | max |
|--------|-----|------|-----|
| energy | -5.58 | -3.49 | -1.57 |
| MSP    | 0.536 | **0.952** | 0.9997 |

That MSP mean of **0.95** is a concrete example of the calibration problem: on
held-out bears, the network already outputs 95% confidence on average. An
overconfident model leaves the OOD detector very little room to work with.

For further clarification:
* When a cat comes in and scores, say, 0.85, that's inside the bears' own range 
— there's no clean threshold that keeps the bears in and the cat out. 
The detector is trying to separate two groups that overlap heavily near the top.

* The confidence is systematically too high for what the model actually knows. 
The number isn't reporting genuine certainty; it's the network's habitual overconfidence. 
Modern nets do this (Guo et al.), and a 3-class softmax with a small training set does it especially hard.

* The whole premise of MSP-based detection is that OOD inputs get lower confidence than in-distribution ones. 
But if in-distribution bears are pinned at 0.95+, the model has already spent its confidence — there's 
no headroom for OOD inputs to look distinctively less confident, because everything looks confident.

* Energy doesn't have this ceiling. It runs −5.58 to −1.57, unbounded by construction, so in principle 
it has more dynamic range for OOD inputs to separate out. That's the theoretical reason to prefer 
it — and exactly the expectation the near-OOD result below then violates.

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

Two things jumped out, and the second one wasn't what I expected.

**1. Far-OOD is the easy case, and energy wins it.** On textures, energy leaks
7% vs MSP's 13%. Good — and a sanity check that the pipeline works.

**2. Near-OOD breaks everything — and here MSP actually beats energy.** Against
cats and dogs, energy leaks a brutal **28.75%**: more than one pet in four
strolls past the filter labelled "bear". And the supposedly-better energy score
is *worse* than the plain softmax baseline (17.33%) on exactly the case I care
about most.

That's the opposite of the textbook takeaway. Energy being superior on the
standard benchmarks (big models, ImageNet-scale) does **not** transfer to a
tiny 3-class head fine-tuned on a few hundred bears. The honest conclusion 
isn't "use energy instead of MSP." Both are scalars computed from the same three logits, 
and on near-OOD inputs those logits are already fooled — no formula over them can recover 
a distinction the model never learned. The fix has to come from more information, not a better scalar.

## Looking at the failures

It helps to look at *what* leaks. These are real false positives — non-bears
the energy filter waved through — shown exactly as the model saw them
(resized, cropped, normalized, then de-normalized back to something viewable).
The filename energy sits comfortably below the −1.98 threshold — the model is
confidently filing both of these under "bear".

| near-OOD (Oxford Pet), energy −3.05 | far-OOD (DTD), energy −3.29 |
|---|---|
| ![A cat the model is sure is a bear](/assets/ood/near-ood-cat-energy-3.05.png) | ![A texture the model is sure is a bear](/assets/ood/far-ood-texture-energy-3.29.png) |

The pattern is unsubtle once you see it: **fur and soft, lumpy texture.** A
ginger cat in profile and a pile of bumpy gourds both trip the same wire that
brown fur trips. The model never learned "bear" — it learned "brown furry
blob", and at inference time that's all it has to go on.

## Choosing a threshold, consciously

The threshold is a dial, not a constant. Loosen it (accept fewer false bears)
and you start rejecting real bears too. Here's the trade-off for the energy
signal:

```
  TPR     thresh       DTD      Pets
  ------------------------------------
  0.80    -2.4739     1.65%     8.75%
  0.90    -2.2377     3.72%    15.67%
  0.95    -1.9841     7.13%    28.75%   <- default
  0.97    -1.9690     7.61%    29.71%
  0.99    -1.8306    12.34%    38.38%
```

Even if I get aggressive and reject **one real bear in five** (TPR 0.80), ~9%
of pets still leak. There's no setting on this dial that makes the near-OOD
problem go away.

> Try it live: the [Hugging Face Space](https://rfflpllcn-bear-detector.hf.space)
> exposes this exact trade-off — drag the TPR slider and watch the threshold,
> the verdict, and the leakage move in real time.

## Verdict, and what's next

- A closed-set softmax classifier fails silently and confidently on OOD input.
  That part is real and reproducible.
- You *can* recover a usable OOD signal post-hoc from the logits, and it's free.
- On **far-OOD** it works fine; **energy > MSP**, as advertised.
- On **near-OOD** — the case that matters — it's weak, and on this small model
  **MSP > energy**, contradicting the standard result. 

The fix isn't a better scalar; it's more information. The natural next steps:

- **Outlier exposure** (Hendrycks et al., 2019) — fine-tune the model to push
  energy up on known non-bears. I already have a head start: the leaked cats,
  dogs and textures above are exactly the hard negatives to train on.
- **Temperature scaling / proper calibration** (Guo et al.) so the 0.95 mean
  confidence stops lying.
- **ODIN, Mahalanobis distance** and other feature-space detectors that don't
  rely on a single output scalar.
- The blunt-but-honest option: add a background / "none of these" class, or
  simply surface the energy score in the UI and let the app *abstain* instead
  of always committing to a bear.

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
