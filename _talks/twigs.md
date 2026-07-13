---
layout: talk
published: false
title: "Diffusion Twigs with Loop Guidance: Giangiacomo Mercatali at ETH Zurich"
speaker: "Giangiacomo Mercatali"
event: "ETH Zurich · Fin & Ins Math Seminar"
talk_date: 2026-07-02
date: 2026-07-07
link: https://arxiv.org/abs/2410.24012
link_label: "Diffusion Twigs with Loop Guidance (arXiv 2410.24012) ↗"
tags: [diffusion, graph generation, molecular design, guidance, generative-models]
summary: "Notes on Mercatali's Twigs: a diffusion model that splits structure and properties into a trunk and stems, and lets them negotiate through loop guidance instead of pinning the property on as a fixed label."
---

Notes from Giangiacomo Mercatali's talk in ETH Zurich's Financial and Insurance Mathematics seminar. 
Mercatali reviewed results from several of his papers; here I will focus on the paper I find most interesting: 
Diffusion Twigs with Loop Guidance for Conditional Graph Generation (NeurIPS 2024).


## Draft notes

https://neurips.cc/media/neurips-2024/Slides/94177.pdf
https://medium.com/@baicenxiao/understand-classifier-guidance-and-classifier-free-guidance-in-diffusion-model-via-python-e92c0c46ec18

Notes from Giangiacomo Mercatali's talk in ETH Zurich's Financial and Insurance Mathematics seminar. 
 Mercatali reviewed results from several of his papers; here I will focus on the paper I find most interesting: 
 Diffusion Twigs with Loop Guidance for Conditional Graph Generation (NeurIPS 2024).
 
 Task: generate a graph with certain desired properties.
 Fundamental problem for: design of new drugs and materials.
 
 Existing Guiding diffusion procedures:
 - Classifier Guidance
 - Classifier-free Guidance
 
The forward process of a diffusion model: from image to noise 
The backward process of a diffusion model: from noise to image

To control the generated images: introduce conditional controls 

Feature//	Classifier-Guided//	Classifier-Free Guidance
Need to train another model?//	Yes, a classifier needs to be trained using noisy images.//	Not really, for example, CLIP can be used directly for text-to-image tasks.
Need to retrain the diffusion model?//	No, pre-trained diffusion models are usable as is.//	Yes, diffusion needs to be retrained using this method.
Control over final output//	Can control the generated category. The number of classes the classifier can identify is the number of classes you can control in generation.//	Any (almost) condition can be controlled.

## The problem

You want a new molecule with a specific property: a target drug-likeness score,
a strong binding affinity to some protein. There are astronomically many possible
molecules, so searching through them is hopeless. What you want instead is a model
that generates molecules on demand: you name the property, it produces molecules
that actually have it.

Molecules are graphs, atoms are nodes, bonds are edges, so this is *conditional
graph generation*: generate a graph given a condition (the desired property).

## The tool it builds on

A diffusion model runs in two stages. In the forward process you take a real
example and gradually add random noise, step by step, until nothing is left but
static: trivial, because adding noise is easy. Then you train a network to undo
one step of noise at a time, the reverse process. Once the network can reverse
noise, you generate something new by starting from pure noise and running the
reverse process until a realistic molecule appears.

To make the output have a *desired* property rather than just any valid molecule,
you need guidance: a way to steer the reverse process. Two standard methods
exist. One trains a separate predictor that estimates the property from a noisy
sample and nudges generation toward increasing it. The other trains the diffusion
model to run both with and without the condition, then blends the two. The paper's
complaint is that both treat the property as a fixed tag you attach to the
process, which is a blunt way to handle it.

## What Twigs does differently

The name comes from a tree analogy. There is one main diffusion process, the
**trunk**, which handles the graph structure: the atoms and bonds. Then, for each
property you care about, there is a separate smaller process, a **stem**, that
handles that one property. All of them run at the same time and influence each
other. The math is set up with stochastic differential equations: a forward SDE
for the diffusion and its corresponding reverse SDE for conditional generation.

The mechanism connecting trunk and stems is **loop guidance**. In each step of
generation the structure is denoised first; the updated structure is used to
denoise the properties; the updated properties are fed back to further denoise the
structure. This back-and-forth repeats at every step, which is where "loop" comes
from. Structure and properties get to negotiate continuously, instead of the
property sitting on the side as a fixed label.

The design is deliberately **asymmetric**: the trunk (structure) is primary, the
stems (properties) are secondary. Earlier work that used multiple diffusion flows
gave every flow the same role; Twigs does not.

## What they tested

Three kinds of experiments:

- **QM9**, a standard dataset of small molecules with known quantum properties.
  They generated molecules targeting specific properties and measured how close
  the result came to the target.
- **ZINC250K**, generating molecules meant to bind well to five target proteins.
- Generic network graphs with target structural properties like density and
  clustering.

Across almost all of these, Twigs produced molecules whose properties landed
closer to the requested target than the competing methods did, and it also scored
well on separate measures of chemical validity and stability. It was not
universally best (for one protein target an older method edged it out), but it
won most of the comparisons.

## The catch

Two limitations, both acknowledged in the paper. Every property you add is another
diffusion process to train, so more properties mean more computation and longer
training, though they show the added time is modest. And the method assumes the
properties are independent of each other once the structure is fixed. That
assumption keeps the math tractable, but it will not hold perfectly for properties
that are genuinely correlated, which could limit accuracy in those cases.

## What I take from it

The idea I keep coming back to is treating the condition as a *process that
co-evolves* with the thing you're generating, rather than a label bolted onto the
side. Loop guidance is a small architectural change with a clear intuition
(denoise structure, use it to denoise properties, feed those back), and it's the
part that pays off for inverse molecular design, where you start from the
properties you want and let the model draw the molecule that fits. The
independence assumption is the weak point they don't hide, and it's exactly where
I'd want to see the next version push.
