---
layout: article
title: "Convolutions"
subtitle: "fast.ai · Practical Deep Learning for Coders — Chapter 13"
course: "Practical Deep Learning for Coders"
lesson: 13
source: https://github.com/fastai/fastbook/blob/master/13_convolutions.ipynb
date: 2026-07-10
published: true
tags: [CNN, convolutions, computer vision, fast.ai]
description: "My replication of the fast.ai results from the 'Improving Training Stability' section of [chapter 13 of fastbook](https://github.com/fastai/fastbook/blob/master/13_convolutions.ipynb), reimplemented in pure PyTorch (no fastai library) on MNIST."
---

<div class="toc" markdown="1">

My replication of the fast.ai results from the 'Improving Training Stability' section of [chapter 13 of fastbook](https://github.com/fastai/fastbook/blob/master/13_convolutions.ipynb), reimplemented in pure PyTorch (no fastai library) on MNIST.

**Contents**
{:.no_toc}
* TOC
{:toc}

</div>


## A Simple Baseline

### CNN

```python 
def conv(ni, nf, ks=3, act=True):
    res = nn.Conv2d(ni, nf, stride=2, kernel_size=ks, padding=ks//2)
    if act: res = nn.Sequential(res, nn.ReLU())
    return res
     

def simple_cnn():
    return sequential(
        conv(1, 8, ks=5),         #14x14
        conv(8, 16),              #7x7
        conv(16, 32),             #4x4
        conv(32, 64),             #2x2
        conv(64, 10, act=False),  #1x1
        Flatten(),
    )
```


### Notes on CNN

* **Larger first-layer kernel (5×5 instead of 3×3)**. 
A 3 x 3 kernel looks at 9 pixel values at each position and produces 1 number, 8 output filters produce 8 values.
So the first layer would compute 8 values from 9 input pixels, almost identity filtering, no pressure to compress.
Compression is what forces a layer to extract features rather than memorize inputs.
With a 5×5 kernel the patch is 5×5×1 = 25 values, so the mapping becomes 25 → 8,
forcing the layer to find useful features. Layers only learn useful features when the number 
of outputs is significantly smaller than the number of inputs.
Note that this reasoning applies specifically to the first layer of a grayscale network. 
For an RGB input the same 3×3 kernel already 
sees 3×3×3 = 27 values, and in deeper layers a 3×3 kernel over, say, 16 channels sees 144 values, so the input count is comfortably
larger than the output count without enlarging the kernel.

* **Double the filter count after each stride-2 layer**. The channel progression 8→16→32→64 compensates for the spatial downsampling.

* **Other**
  -  a convolution is applied on all pixels in an image, that's why the Conv2d signature does not require the image size.
  - enough stride-2 convolutions to reduce final layer to size 1

### Execution command


```python 
 uv run python fastbook13.py baseline --outdir out-baseline
```

### Output

Our results:

```python
(play-pytorch) (base) rp@rp-ubuntu:~/course.fast.ai/lesson13$ uv run python fastbook13.py baseline --outdir assets
device: cuda  seed: 42

baseline: accuracy 0.1032  valid_loss 2.3049  (3s)   fastai: 0.1135
```

fastai results on baseline:
<figure>
  <img src="/assets/fastbook-13-convolutions/baseline-fastai.png" alt="">
  <figcaption></figcaption>
</figure>


### fastai 0.1135 is not chance 

fastai 0.1135 is the frequency of the most common test class: a fully collapsed net predicting a constant '1'

  - total number of images = 78×128 + 16 = 10000 ✓ (no drop_last on the validation)                                                                                                                                                                                                                                                                         
  - total number of "1" = 1135 ✓                                                                                                                                                                                                                                                                                             
  - accuracy on "1" = 1135 / 10000 = 0.1135 ✓  

### Output Plots

Almost 50% of activations near zero on the first layer.

*Activations near zero are particularly problematic, because it means we have computation in the model that's doing nothing at all (since multiplying by zero gives zero).*

<figure>
  <img src="/assets/fastbook-13-convolutions/baseline_layer_stats_0.png" alt="">
  <figcaption></figcaption>
</figure>

The problem gets worse towards the end of the network.

*As expected, the problems get worse towards the end of the network, as the instability and zero activations compound over layers.*


<figure>
  <img src="/assets/fastbook-13-convolutions/baseline_layer_stats_-2.png" alt="">
  <figcaption></figcaption>
</figure>

## Increase Batch Size

### Execution command


```python 
 uv run python fastbook13.py batch-size --outdir assets
```

### Output

Our results:

```python
(play-pytorch) (base) rp@rp-ubuntu:~/course.fast.ai/lesson13$ uv run python fastbook13.py batch-size --outdir assets
device: cuda  seed: 42

batch-size: accuracy 0.8766  valid_loss 0.3889  (2s)   fastai: 0.1135
```

### Output Plots

<figure>
  <img src="/assets/fastbook-13-convolutions/bs512_layer_stats_-2.png" alt="">
  <figcaption>Our stats on layer -2.</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/bs512_layer_stats_-2_fastai.png" alt="">
  <figcaption>Fastai stats on layer -2.</figcaption>
</figure>

### Why the divergence: fastai stays at 0.1135, ours recovers to ~0.88

From fastai: 

*Larger batches have gradients that are more accurate, since they're calculated from more data.*

But on its own it does **not** rescue an unnormalized net — fastai
stays collapsed at 0.1135. Here the same `bs=512` usually **does** train
(0.8766 above).

Same recipe, different outcome. Same architecture. What
we cannot match is:

1. **Weight initialization** — PyTorch and fastai init the conv layers
   differently.
2. **RNG / batch order** — the DataLoader shuffle.

With `bs=512` the gradient is averaged over 8× more samples than `bs=64`, so the
optimization steps are much less noisy even at the high `lr=0.06`. Whether the
net then trains or collapses comes down entirely to *where it starts* (init) and
*the order it sees the data* (RNG).

Seed ablation:

```
bs=64    0.1135, 0.1028, 0.0980, 0.1032   <- always collapses, like the book
bs=512   0.1135, 0.9294, 0.9126, 0.7901   <- the book stays at 0.1135
         (seed 0) (seed 1)(seed 2)(seed 42)
```

## 1cycle Training

### Execution command


```python 
 uv run python fastbook13.py one-cycle --outdir assets
```

### Output

```python
(play-pytorch) (base) rp@rp-ubuntu:~/course.fast.ai/lesson13$ uv run python fastbook13.py one-cycle --outdir assets
device: cuda  seed: 42

one-cycle: accuracy 0.9776  valid_loss 0.0717  (2s)   fastai: 0.9743
```

### Output Plots

<figure>
  <img src="/assets/fastbook-13-convolutions/1cycle_sched.png" alt="">
  <figcaption>Our plot schedule</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/1cycle_sched-fastai.png" alt="">
  <figcaption>Fastai plot schedule.</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/1cycle_layer_stats_-2.png" alt="">
  <figcaption>Our stats on layer -2</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/1cycle_layer_stats_-2-fastai.png" alt="">
  <figcaption>Fastai plot schedule.</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/1cycle_color_dim_-2.png" alt="">
  <figcaption>Our colorful dimension on layer -2</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/1cycle_color_dim_-2-fastai.png" alt="">
  <figcaption>Fastai colorful dimension on layer -2.</figcaption>
</figure>

## Batch Normalization

### Execution command


```python 
 uv run python fastbook13.py batchnorm --outdir assets
```

### Output

```python
(play-pytorch) (base) rp@rp-ubuntu:~/course.fast.ai/lesson13$ uv run python fastbook13.py batchnorm --outdir assets
device: cuda  seed: 42

batchnorm 1ep: accuracy 0.9856  valid_loss 0.0580  (2s)   fastai: 0.9864
```

### Output Plots

<figure>
  <img src="/assets/fastbook-13-convolutions/batchnorm_layer_stats_-4.png" alt="">
  <figcaption>Our stats on layer -4.</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/batchnorm_color_dim_-4.png" alt="">
  <figcaption>Our colorful dimension on layer -4.</figcaption>
</figure>

<figure>
  <img src="/assets/fastbook-13-convolutions/batchnorm_color_dim_-4-fastai.png" alt="">
  <figcaption>Fastai colorful dimension on layer -4.</figcaption>
</figure>


## Appendix A. My code

[My code](https://github.com/rp-playground/play-pytorch/blob/main/course.fast.ai/lesson13/fastbook13.py) is private.

## Appendix B. Note sparse

### Implementation of ActivationStats
from the source:

*we can look inside our models while they're training in order to try to find ways to make them train better. 
To do this we use the ActivationStats callback, which records the mean, standard deviation, and histogram of 
activations of every trainable layer* 

### batch number on the x-axis

number of batches (len(train_dl)) = 937. 937 batches of 60 images each = 59968 (not 60000 because drop_last=True)

### What the plots measure

the plot of mean, std and "% near zero"  vs batch measure
e.g. the mean plot measures how the mean of the activations for a given layer changes during training 
