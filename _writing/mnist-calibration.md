---
layout: article
title: "Past 99%: where a confident MNIST model is wrong"
description: The confidence-calibration angle on the MNIST × MLflow project — reliability/ECE says how confidently the model is wrong, a UMAP of its features says where, with Colah's t-SNE visualization as the ancestor.
summary: Reliability/ECE tells you how confidently the model is wrong; a UMAP of its features tells you where — the two halves of going past 99% accuracy.
date: 2026-06-06
tags: [calibration, ECE, UMAP, t-SNE, MNIST]
published: true
---

*The confidence-calibration angle on the [MNIST × MLflow + Optuna](/writing/mnist-mlflow/)
project: go past the "99% accuracy" headline and ask **where** and **how
confidently** the model is wrong.*

## The remaining "1%"

The champion `conv_net` hits ~99% test accuracy; here I focus on the other 1% —
the test digits the model still gets wrong, and what they have in common.

A reliability diagram, the obvious first tool, can't tell you that (the figure
below shows why), so the rest of this is about the geometry of where the mistakes
fall.

<figure class="narrow">
  <img src="/assets/mnist/reliability_diagram_conv_net.png" alt="Reliability diagram for the champion conv net, with a confidence histogram">
  <figcaption>Reliability diagram with a count histogram. The curve sits almost on the diagonal (ECE ≈ 0.002), and the histogram shows why: nearly all predictions pile into the top confidence bin — and there they're right.</figcaption>
</figure>

The ECE of **~0.002** looks excellent, but it's a flattered number: the model is so
confident-and-correct that almost all the mass lands in the last bin, leaving very
little low-confidence mass to be miscalibrated *about*. The reliability diagram
tells you the model isn't wildly overconfident, but it can't tell you *where* the
residual errors live. For that I have to look at the geometry.

## The geometric approach

To see *where* the mistakes happen, I project the model's representation down to 2D.
It's an old idea: in 2014 Chris Olah's
[*Visualizing MNIST*](https://colah.github.io/posts/2014-10-Visualizing-MNIST/)
used **t-SNE** to flatten MNIST into a picture and watch the digit classes pull
apart. I use **UMAP** (McInnes et al., 2018) instead of t-SNE — see
[Performance Comparison of Dimension Reduction Implementations](https://umap-learn.readthedocs.io/en/latest/benchmarking.html)
for why it's the better choice.

A second difference from Colah: he projected the **raw pixels**. I project the conv
net's **penultimate-layer activations** — the 128-d representation just before the
classifier, where the model actually makes its decision.

<figure>
  <img src="/assets/mnist/umap_penultimate_conv_net.png" alt="UMAP of the conv net's penultimate-layer activations: ten clean clusters by class, with misclassifications at the cluster edges">
  <figcaption>UMAP of the conv net's penultimate-layer activations. <strong>Left:</strong> coloured by true class — ten clean, well-separated clusters. <strong>Right:</strong> coloured by confidence (viridis, almost entirely high — note the colorbar), with the 134 misclassifications marked as red ✕.</figcaption>
</figure>

## Where it's wrong

**The classes are cleanly separated.** Ten well-separated clusters — the geometric
reason the model is confident almost everywhere. And that separation comes from the
model, not the data. To see it, run the same UMAP — same parameters, same seed — on
the raw 784-d pixels, then on the MLP's penultimate features, then on the conv
net's. The raw pixels (à la Colah) overlap heavily; the MLP starts pulling the
classes apart but leaves them touching; the conv net produces clean, separated
clusters.

<figure>
  <img src="/assets/mnist/umap_ladder_conv_net.png" alt="Three-panel UMAP of the same MNIST test set: raw pixels with overlapping bleeding clusters, MLP penultimate features partly separated, conv penultimate features in ten clean clusters">
  <figcaption>The same UMAP on three input spaces, all coloured by true class — the complexity ladder made geometric. <strong>Left:</strong> raw pixels — digit clouds overlap and leak into each other. <strong>Middle:</strong> the MLP's penultimate features — clusters forming but still loose and touching. <strong>Right:</strong> the conv net's penultimate features — ten tight, separated clusters. The data and projection are identical across the three panels; separation increases with model class, matching the ECE that roughly halves at each rung.</figcaption>
</figure>


**The errors sit on the borders.** The 134 misclassifications aren't scattered at
random — they sit at the edges of the clusters, and a few fall into the neighbouring
cluster they get confused with. That's where an ambiguous digit lands: a sloppy `4`
near the `9` cluster, a `5` near the `3`. The geometry and the confusion matrix are
two independent views, and they agree. Rank
all 45 digit-pairs by how close their UMAP clusters sit and by how often they get
confused, and the two orderings correlate (Spearman **ρ ≈ 0.49**, *p* < 0.001).
`3↔5` is *both* the single most-confused pair (15 errors) *and* the closest pair of
clusters in the whole projection; `7↔9` and `2↔7` are likewise top-confused and
among the nearest. The agreement isn't perfect: `5↔6` confuses often yet isn't
especially close in 2D, while `2↔9` sit close but never confuse.

<figure class="narrow">
  <img src="/assets/mnist/confusion_geometry_conv_net.png" alt="Scatter of all 45 digit-pairs: UMAP centroid distance on the x-axis (closer to the right) against how often the pair is confused on the y-axis, trending up-right, with 3–5 circled in the top-right corner">
  <figcaption>Each point is one of the 45 digit-pairs: how close its clusters sit in UMAP (x, closer to the right) against how often the two digits are confused (y). <code>3–5</code> (circled) is the nearest and the most-confused pair. <code>5–6</code> confuses despite sitting far apart, <code>2–9</code> sit close but never confuse.</figcaption>
</figure>

[//]: # (**And they lean toward their confuser.** It's tempting to read more into the)

[//]: # (picture — that each error is *pulled* toward the digit it gets mistaken for, like)

[//]: # (a charge drifting to the opposite pole. UMAP doesn't preserve global directions)

[//]: # (faithfully, so I checked it rather than eyeballed it. Mark each error with two)

[//]: # (classes — **fill = predicted, ring = true** — and link it to its predicted-class)

[//]: # (centroid:)

[//]: # ()
[//]: # (<figure>)

[//]: # (  <img src="/assets/mnist/umap_error_polarization_conv_net.png" alt="Misclassifications, each marker filled by predicted class and ringed by true class, linked to the predicted-class centroid">)

[//]: # (  <figcaption>Each marker is a misclassification: <strong>fill = predicted class, ring = true class</strong> &#40;match both to the coloured centroids&#41;, with a faint line to the predicted centroid. The marker sits at the sample's <em>learned representation</em>, not its label — and that representation is what drove the &#40;wrong&#41; prediction, so it's already pulled toward the predicted side. A green-filled, red-ringed marker is a `3` the model read as a `2`; if it's drifted all the way into the `2` cloud, it's a `3` read as a `2` <em>confidently</em>.</figcaption>)

[//]: # (</figure>)

[//]: # (The pull is measurable. Place each error on the axis from its true-class centroid)

[//]: # (&#40;0&#41; to its predicted-class centroid &#40;1&#41;: errors land on average at **0.40** along)

[//]: # (that axis, versus **0.00** for correctly-classified points of the same class, and)

[//]: # (**84%** lean further toward the confuser than their class baseline does. The)

[//]: # (extreme cases are the strongest tell — **39%** drift *past the midpoint*, all the)

[//]: # (way into the predicted cluster &#40;those are the markers whose fill matches the cloud)

[//]: # (they're sitting in but whose ring doesn't: a non-`2` confidently absorbed into the)

[//]: # (`2` island&#41;. And the drift tracks confidence: how far an error sits along that)

[//]: # (axis correlates with its softmax confidence &#40;**r ≈ 0.41**&#41; — the ones that drift)

[//]: # (all the way in average **85%** confidence versus **69%** for those left near the)

[//]: # (border. The deeper into the wrong cluster, the surer the model is it's right. So)

[//]: # (it's not just "errors at the edges": each error is *polarized*, displaced toward)

[//]: # (the specific digit the model mistook it for. The metaphor survives the check.)

[//]: # ()
[//]: # (Put the two halves together and you get the honest reading of "99%": the model)

[//]: # (isn't 99%-accurate *uniformly*. Its 1% is concentrated in specific, interpretable)

[//]: # (places — the genuine overlap between visually similar digits — and that's a)

[//]: # (residue calibration can't scrub away, because at the border the inputs really are)

[//]: # (ambiguous. A good place to stop trusting a single accuracy number.)

## The bottom rung, and why it's worse calibrated

The logistic model is simple enough to read directly: with a single linear layer,
its (10, 784) weight matrix is the explanation. Reshape each row to 28×28 and you
get one per-class template.

The templates are blurry and overlap a lot: one linear template can't capture all
the ways a 4 or an 8 is written, so similar digits get near-identical templates.
That overlap is why the linear model both separates the classes worse and is worse
calibrated.

<figure>
  <img src="/assets/mnist/weight_templates_logistic.png" alt="The logistic model's ten per-class weight templates, reshaped to 28x28">
  <figcaption>The `logistic` model's per-class weight templates (red pushes <em>toward</em> the class, blue <em>against</em>). Display-smoothed with a Gaussian blur: the model learns one independent weight per pixel, with nothing tying neighbouring pixels together, so the raw weights look speckled. You can still make out a ring for `0`, the stroke of `2`, the loop of `6`.</figcaption>
</figure>

Calibration improves steadily — ECE roughly halves at each step up the ladder:

| rung        | test accuracy | test ECE |
|-------------|:-------------:|:--------:|
| `logistic`  | 92.2%         | 0.0101   |
| `mlp_relu`  | 96.9%         | 0.0050   |
| `conv_net`  | 98.7%         | 0.0023   |

The MLP's geometry tells the same in-between story (middle panel above): clusters
forming but still loose, midway between the linear model's smudge and the conv net's
clean separation. Same complexity ladder, one calibration curve, and two ways to
see what each model learned.

## Reproduce it

```bash
uv run python -m mnist.embedding         # conv net: forward-hook + UMAP of penultimate features
uv run python -m mnist.pixel_embedding   # the ladder: same UMAP on pixels -> MLP -> conv features
uv run python -m mnist.templates         # logistic: recover the weight matrix as per-class templates
```

`embedding` loads the champion by registry alias, captures the penultimate
activations over the test set with a forward hook, runs UMAP, and logs both UMAP
figures plus the error-polarization metric onto the conv net's MLflow run;
`pixel_embedding` runs the same UMAP on raw pixels, the MLP's penultimate features,
and the conv net's, for the three-panel ladder; `templates` reads the logistic
run's weight matrix and logs the template grid (raw + smoothed).

---

### References

- Olah (2014). *[Visualizing MNIST: An Exploration of Dimensionality
  Reduction](https://colah.github.io/posts/2014-10-Visualizing-MNIST/).*
- van der Maaten & Hinton (2008). *Visualizing Data using t-SNE.*
- McInnes, Healy & Melville (2018). *UMAP: Uniform Manifold Approximation and
  Projection for Dimension Reduction.*
- Guo, Pleiss, Sun & Weinberger (2017). *On Calibration of Modern Neural
  Networks.*
</content>
