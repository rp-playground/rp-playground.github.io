---
layout: article
title: "Past 99%: where a confident MNIST model is wrong"
description: The confidence-calibration angle on the MNIST × MLflow project — reliability/ECE says how confidently the model is wrong, a UMAP of its features says where, with Colah's t-SNE visualization as the ancestor.
summary: Reliability/ECE tells you how confidently the model is wrong; a UMAP of its features tells you where — the two halves of going past 99% accuracy.
date: 2026-06-06
tags: [calibration, ECE, UMAP, t-SNE, MNIST]
published: false  # draft — excluded from the build for now
---

*The confidence-calibration angle on the [MNIST × MLflow + Optuna](/writing/mnist-mlflow/)
project: go past the "99% accuracy" headline and ask **where** and **how
confidently** the model is wrong.*

## "99%" is an average, and averages hide

The champion `conv_net` hits ~99% test accuracy. That number says nothing about
the remaining 1% — whether those mistakes are confident or hesitant, scattered
or structured. Calibration is the first half of the answer: *how confidently* is
it wrong?

<figure class="narrow">
  <img src="/assets/mnist/reliability_diagram_conv_net.png" alt="Reliability diagram for the champion conv net, with a confidence histogram">
  <figcaption>Reliability diagram with a count histogram. The curve sits almost on the diagonal (ECE ≈ 0.002), and the histogram shows why: nearly all predictions pile into the top confidence bin — and there they're right.</figcaption>
</figure>

The ECE of **~0.002** looks excellent, but it's a flattered number: the model is
so confident-and-correct that almost all the mass lands in the last bin, leaving
very little low-confidence mass to be miscalibrated *about*. The reliability
diagram tells you the model isn't wildly overconfident — but it can't tell you
*where* the residual errors live. For that you have to look at the geometry.

## The other half: where, via a feature projection

To see *where* the mistakes happen, project the model's representation to 2D.
This is an old idea: in 2014 Chris Olah's
[*Visualizing MNIST*](https://colah.github.io/posts/2014-10-Visualizing-MNIST/)
used **t-SNE** to flatten MNIST into a picture and watch the digit classes pull
apart. t-SNE has since aged — slow, wobbly between runs, and indifferent to
global layout — so the contemporary tool is **UMAP** (McInnes et al., 2018):
same "keep neighbours together" spirit, but faster, more stable with a fixed
seed, and far better at preserving the overall arrangement. It's what you'd reach
for today where Colah reached for t-SNE.

One difference from Colah: he projected the **raw pixels**. I project the conv
net's **penultimate-layer activations** — the 128-d representation just before the
classifier, read off the trained [champion](/projects/mnist-mlflow/) via a
forward hook (no retraining). That's the space the model actually decides in.

<figure>
  <img src="/assets/mnist/umap_penultimate_conv_net.png" alt="UMAP of the conv net's penultimate-layer activations: ten clean clusters by class, with misclassifications at the cluster edges">
  <figcaption>UMAP of the conv net's penultimate-layer activations. <strong>Left:</strong> coloured by true class — ten clean, well-separated clusters. <strong>Right:</strong> coloured by confidence (viridis, almost entirely high — note the colorbar), with the 134 misclassifications marked as red ✕.</figcaption>
</figure>

## Where it's wrong, and why that's the honest 1%

Two things line up with the calibration story:

**The classes are cleanly disentangled.** Ten tight, well-separated islands — the
geometric reason the model is high-confidence almost everywhere, and the reason
the reliability histogram is so top-heavy. And it's *earned*, in a way you can
watch accrue rung by rung: run the **same** UMAP — same parameters, same seed —
on the raw 784-d pixels, then on the middle-rung MLP's penultimate features, then
on the conv net's. The pixels (à la Colah) touch and bleed; the MLP starts
pulling the classes apart but leaves them loose and overlapping; the conv net
carves clean islands.

<figure>
  <img src="/assets/mnist/umap_ladder_conv_net.png" alt="Three-panel UMAP of the same MNIST test set: raw pixels with overlapping bleeding clusters, MLP penultimate features partly separated, conv penultimate features in ten clean islands">
  <figcaption>The same UMAP on three input spaces, all coloured by true class — the complexity ladder made geometric. <strong>Left:</strong> raw pixels — digit clouds overlap and leak into each other. <strong>Middle:</strong> the MLP's penultimate features — clusters forming but still loose and touching. <strong>Right:</strong> the conv net's penultimate features — ten tight, separated islands. Same data, same projection: separation climbs monotonically with model class, the geometric echo of the ECE that halves at each rung. The separation on the right is something the network <em>built</em>, not a property MNIST hands you for free.</figcaption>
</figure>

**The errors sit on the borders.** The 134 misclassifications aren't scattered at
random — they cluster at the **edges** of the islands and in the thin bridges
between them. That's exactly where an ambiguous digit lands: a sloppy `4`
drifting toward the `9` island, a `5` leaning into `3`. And this isn't just
eyeballing the picture: the geometry and the confusion matrix are two independent
views that agree. Rank all 45 digit-pairs by how close their UMAP clusters sit
and by how often they get confused, and the two orderings correlate (Spearman
**ρ ≈ 0.49**, *p* < 0.001). The headline coincides exactly — `3↔5` is *both* the
single most-confused pair (15 errors) *and* the closest pair of clusters in the
whole projection; `7↔9` and `2↔7` are likewise top-confused and among the
nearest. The agreement isn't perfect, and that's the useful part: `5↔6` confuses
often yet isn't especially close in 2D, while `2↔9` sit close but never confuse.
UMAP's 2D squeeze loses what the raw counts keep — which is exactly why holding
*both* views beats trusting either alone.

<figure class="narrow">
  <img src="/assets/mnist/confusion_geometry_conv_net.png" alt="Scatter of all 45 digit-pairs: UMAP centroid distance on the x-axis (closer to the right) against how often the pair is confused on the y-axis, trending up-right, with 3–5 circled in the top-right corner">
  <figcaption>Each point is one of the 45 digit-pairs: how close its clusters sit in UMAP (x, closer to the right) against how often the two digits are confused (y). The cloud trends up-right — close pairs confuse more — and <code>3–5</code> (circled) anchors the corner as both the nearest and the most-confused pair. The off-trend points are the honest exceptions: <code>5–6</code> confuses despite sitting far apart, <code>2–9</code> sit close but never confuse.</figcaption>
</figure>

**And they lean toward their confuser.** It's tempting to read more into the
picture — that each error is *pulled* toward the digit it gets mistaken for, like
a charge drifting to the opposite pole. UMAP doesn't preserve global directions
faithfully, so I checked it rather than eyeballed it. Mark each error with two
classes — **fill = predicted, ring = true** — and link it to its predicted-class
centroid:

<figure>
  <img src="/assets/mnist/umap_error_polarization_conv_net.png" alt="Misclassifications, each marker filled by predicted class and ringed by true class, linked to the predicted-class centroid">
  <figcaption>Each marker is a misclassification: <strong>fill = predicted class, ring = true class</strong> (match both to the coloured centroids), with a faint line to the predicted centroid. The marker sits at the sample's <em>learned representation</em>, not its label — and that representation is what drove the (wrong) prediction, so it's already pulled toward the predicted side. A green-filled, red-ringed marker is a `3` the model read as a `2`; if it's drifted all the way into the `2` cloud, it's a `3` read as a `2` <em>confidently</em>.</figcaption>
</figure>

The pull is measurable. Place each error on the axis from its true-class centroid
(0) to its predicted-class centroid (1): errors land on average at **0.40** along
that axis, versus **0.00** for correctly-classified points of the same class, and
**84%** lean further toward the confuser than their class baseline does. The
extreme cases are the strongest tell — **39%** drift *past the midpoint*, all the
way into the predicted cluster (those are the markers whose fill matches the cloud
they're sitting in but whose ring doesn't: a non-`2` confidently absorbed into the
`2` island). And the drift tracks confidence: how far an error sits along that
axis correlates with its softmax confidence (**r ≈ 0.41**) — the ones that drift
all the way in average **85%** confidence versus **69%** for those left near the
border. The deeper into the wrong cluster, the surer the model is it's right. So
it's not just "errors at the edges": each error is *polarized*, displaced toward
the specific digit the model mistook it for. The metaphor survives the check.

Put the two halves together and you get the honest reading of "99%": the model
isn't 99%-accurate *uniformly*. Its 1% is concentrated in specific, interpretable
places — the genuine overlap between visually similar digits — and that's a
residue calibration can't scrub away, because at the border the inputs really are
ambiguous. A good place to stop trusting a single accuracy number.

## The bottom rung, and why it's worse calibrated

The UMAP is the conv net's interpretability object. The `logistic` rung has a
simpler one: with a single linear layer, the `(10, 784)` weight matrix *is* the
explanation — each row, reshaped to 28×28, is the per-class template the model
matches an input against.

<figure>
  <img src="/assets/mnist/weight_templates_logistic.png" alt="The logistic model's ten per-class weight templates, reshaped to 28x28">
  <figcaption>The `logistic` model's per-class weight templates (red pushes <em>toward</em> the class, blue <em>against</em>). Display-smoothed with a Gaussian blur — the raw per-pixel weights are noisier, since a linear model has no spatial prior. You can still make out a ring for `0`, the stroke of `2`, the loop of `6`.</figcaption>
</figure>

These templates are blurry and overlap heavily — a single linear stamp can't
capture the many ways a `4` or an `8` is drawn, so visually similar digits get
near-identical templates. That smudginess is the interpretable cause of the
`logistic` rung's worse separation **and its worse calibration**: where the conv
net carves ten clean islands and earns its confidence, the linear model decides
with overlapping stamps and pays for it with a higher ECE.

And the middle rung lands exactly where you'd hope — the calibration story isn't
two anecdotes at the extremes but a monotone trend, with ECE roughly **halving at
each step up the ladder**:

| rung        | test accuracy | test ECE |
|-------------|:-------------:|:--------:|
| `logistic`  | 92.2%         | 0.0101   |
| `mlp_relu`  | 96.9%         | 0.0050   |
| `conv_net`  | 98.7%         | 0.0023   |

The MLP's geometry tells the same in-between story (middle panel above): clusters
forming but still loose, the visual midpoint between the linear model's smudge and
the conv net's clean islands. Same complexity ladder, one continuous calibration
curve — and two different ways to *see* what each model learned.

## Reproduce it

```bash
uv run python -m mnist.embedding         # conv net: forward-hook + UMAP of penultimate features
uv run python -m mnist.pixel_embedding   # the ladder: same UMAP on pixels -> MLP -> conv features
uv run python -m mnist.templates         # logistic: recover the weight matrix as per-class templates
```

`embedding` loads the champion by registry alias, captures the penultimate
activations over the test set with a forward hook, runs UMAP, and logs both UMAP
figures plus the error-polarization metric onto the conv net's MLflow run;
`pixel_embedding` runs the same UMAP on raw pixels, the MLP's penultimate
features, and the conv net's, for the three-panel ladder; `templates` reads the
logistic run's weight matrix and logs the template grid (raw + smoothed).

---

### References

- Olah (2014). *[Visualizing MNIST: An Exploration of Dimensionality
  Reduction](https://colah.github.io/posts/2014-10-Visualizing-MNIST/).*
- van der Maaten & Hinton (2008). *Visualizing Data using t-SNE.*
- McInnes, Healy & Melville (2018). *UMAP: Uniform Manifold Approximation and
  Projection for Dimension Reduction.*
- Guo, Pleiss, Sun & Weinberger (2017). *On Calibration of Modern Neural
  Networks.*
