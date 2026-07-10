---
layout: article
title: "Convolutions"
subtitle: "fast.ai · Practical Deep Learning for Coders — Chapter 13"
course: "Practical Deep Learning for Coders"
lesson: 13
source: https://github.com/fastai/fastbook/blob/master/13_convolutions.ipynb
date: 2026-07-09
published: false
tags: [CNN, convolutions, computer vision, fast.ai]
description: "Notes from chapter 13 of fastbook — how convolutions work and why they suit images."
---

*Notes from [chapter 13 of fastbook](https://github.com/fastai/fastbook/blob/master/13_convolutions.ipynb).*

<div class="toc" markdown="1">

**Contents**

- [The magic of convolutions](#magic)
- [Our first convolutional neural network](#first-cnn)
- [Improving training stability](#stability)
- [What I'm taking from it](#takeaways)

</div>

## The magic of convolutions {#magic}

It starts from the idea of features on a tabular dataset and then ask the equivalent on images. an image of number 7 is characterized by two edges... a convolution helps to extract edges from an image.
How does it achieve it?
By applying a kernel (a matrix) across the image (a matrix). 
in specific, to detect a horizontal edge, it identifies significant changes in pixel brightness along the vertical axis.
A standard 3 x 3 kernel achieves it by subtracting the pixel values above from the pixel values below the center row.

an horizontal edge detection kernel is then the matrix [[-1, -1, -1], [0, 0, 0], [1, 1, 1]]
following the same principle, a vertical edge detection kernel would be [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]]


why pytorch requires rank-4 tensors for input images and filters: because pytorch can apply same convolution to multiple images at the same time and multiple kernel at the same time.



## Our first convolutional neural network {#first-cnn}

def conv(ni, nf, ks=3, act=True):
    res = nn.Conv2d(ni, nf, stride=2, kernel_size=ks, padding=ks//2)
    if act: res = nn.Sequential(res, nn.ReLU())
    return res
     

simple_cnn = sequential(
    conv(1 ,4),            #14x14
    conv(4 ,8),            #7x7
    conv(8 ,16),           #4x4
    conv(16,32),           #2x2
    conv(32,2, act=False), #1x1
    Flatten(),
)
When we use a stride-2 convolution, we often increase the number of features because we're decreasing the number of 
activations in the activation map by a factor of 4; we don't want to decrease the capacity of a layer by too much at a time.

the number of parameters in the first conv2d is kernel-height x kernel-width x number of kernels + number of biases = 3 x 3 x 4 + 4 = 40
at the same time the stride 2 halved the grid size. with padding 1 and stride 2, a kernel covers a 28 x 28 image in 14 steps 
the bias can be considered part of the filter, that's why +4

note: a convolution is applied on all pixels in an image, that's why the Conv2d signature does not require the image size.
note: enough stride-2 convolutions to reduce final layer to size 1
note: When we use a stride-2 convolution, we often increase the number of features at the same time. This is because 
      we're decreasing the number of activations in the activation map by a factor of 4; we don't want to decrease the capacity of a layer by too much at a time.

"what a neural net learns" from the Zeiler and Fergus paper.

## Improving training stability {#stability}

Here is the complete set of techniques from the "Improving Training Stability" section, including the setup choices that precede the four named subsections.

**Setup / baseline choices**

1. **Normalize the input** — `batch_tfms=Normalize()` in the DataBlock.
2. **Larger first-layer kernel (5×5 instead of 3×3)**
A 3 x 3 kernel looks at 9 pixel values at each position and produces 1 number, 8 output filters produce 8 values.
So the first layer would compute 8 values from 9 input pixels, almost identity filtering, no pressure to compress.
Compression is what forces a layer to extract features rather than memorize inputs.
With a 5×5 kernel the patch is 5×5×1 = 25 values, so the mapping becomes 25 → 8,
forcing the layer to find useful features. The general principle stated: layers only learn useful features when the number 
of outputs is significantly smaller than the number of inputs.
Note this reasoning applies specifically to the first layer of a grayscale network. For an RGB input the same 3×3 kernel already 
sees 3×3×3 = 27 values, and in deeper layers a 3×3 kernel over, say, 16 channels sees 144 values, so the input count is comfortably
larger than the output count without enlarging the kernel.

3. **Double the filter count after each stride-2 layer** — the channel progression 8→16→32→64 compensates for the spatial downsampling.
4. **Diagnose before fixing** — use the `ActivationStats` callback (`with_hist=True`) and inspect training with `plot_layer_stats(idx)` 
(mean, std, and % of near-zero activations per layer) and `color_dim(idx)` (log-histogram of activations per batch, stacked over time). 
Signs of bad training: unstable mean/std, a high fraction of near-zero activations (which propagate zeros to later layers and compound 
toward the end of the network), and the cycle of exponential activation growth followed by collapse visible in `color_dim`.

**The four named stability techniques**

5. **Increase batch size** (64 → 512) — larger batches give more accurate gradient estimates. Trade-off: fewer weight updates per epoch. In the chapter this alone did not fix the near-zero activation problem.
6. **1cycle training** (`fit_one_cycle` instead of `fit`) — learning rate warms up from low to a maximum, then anneals back down (fastai uses cosine annealing rather than Smith's original linear schedule). Rationale: random initial weights make a high starting LR likely to diverge, and a high final LR would skip over the minimum, but high LR in the middle trains faster (super-convergence) and regularizes by skipping sharp minima in favor of flatter, better-generalizing regions. Tunable parameters: `lr_max`, `div`, `div_final`, `pct_start`, `moms`.
7. **Cyclical momentum** (part of 1cycle) — momentum moves inversely to the learning rate: high momentum at low LR, low momentum at high LR. Controlled by the `moms` tuple.
8. **Batch normalization** — append `nn.BatchNorm2d(nf)` after the ReLU in each conv block. It normalizes activations using batch statistics (running statistics at validation time) and adds learnable `gamma` and `beta` so each layer can still produce any mean and variance, decoupled from the previous layer's output statistics. This eliminated the activation crashes in `color_dim` and also acts as a regularizer: batch-to-batch variation in the normalization statistics adds noise the model must become robust to, which tends to improve generalization.
9. **Raise the learning rate and train longer once batchnorm is in place** — the final run uses `fit(5, lr=0.1)`, up from 0.06, exploiting the batchnorm paper's claim that it permits much higher learning rates.

One ordering point the chapter makes implicitly: batch size and 1cycle each helped partially, but batchnorm was the change that produced smooth activations from the start; the other techniques then compound with it (higher LR, more epochs).

## What I'm taking from it {#takeaways}
