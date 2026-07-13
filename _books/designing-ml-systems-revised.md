---
layout: book
title: "Designing Machine Learning Systems: An Iterative Process for Production-Ready Applications"
authors: "Chip Huyen"
book_year: 2022
link: https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/
date: 2026-06-19
pinned: true
tags: [ML systems, deployment, MLOps, model compression]
summary: "Takeaways from Chapter 7 (model deployment): deploying a model is an engineering problem, not an ML one."
---

*Takeaways from Chapter 7 of the book: on deploying ML models.*

<div class="toc" markdown="1">

**Contents**

- **[Chapter 7 · Model deployment](#ch7)**: deploying a model is an engineering problem, not an ML one
  - [The deployment myths I was carrying](#ch7-myths)
  - [Batch vs. online prediction](#ch7-batch)
  - [The two-pipeline bug](#ch7-two-pipeline)
  - [Model compression](#ch7-compression)
  - [Cloud vs. edge](#ch7-cloud-edge)
  - [Compiling models to hardware](#ch7-compiling)
  - [ML in browsers](#ch7-browsers)
  - [What I'm taking from it](#ch7-takeaways)

</div>

## Chapter 7 · Model deployment {#ch7}

Figure 1-1 from the book maps the whole ML system and points each chapter at the piece it covers. Deployment, monitoring, and updating (Chapters 7, 8, and 9) are the top layer, the part that touches the people actually using the system.

<figure>
  <img src="/assets/designing-ml-systems/components-of-an-ml-system.png" alt="Diagram mapping ML system users, business requirements, and developers to the layered components of an ML system, with each book chapter labeling the component it covers.">
  <figcaption>Figure 1-1 from the book: the components of an ML system, with each chapter labeling the piece it covers. Deployment, monitoring, and updating sit in the top layer that touches real users.</figcaption>
</figure>

Deploying a model is an engineering problem, not an ML one. That claim reshaped how I think about my own work. Coming from the research side, I tend to consider the model logic as the real work: the data, the features, the architecture, and the metrics. Getting that logic to run for real users is a separate discipline with its own specific failure modes.

### The deployment myths I was carrying {#ch7-myths}

The chapter debunks four myths about deployment. I believed three of them.

- **One or two models in production.** A ride-sharing app needs models for demand, driver availability, estimated times of arrival, pricing, fraud, and churn. If it runs in 20 countries with about 10 models each, that equals 200 models before accounting for anything custom. Uber runs thousands.
- **Performance holds if you do nothing.** Software decays, and ML decays faster because of data distribution shift. The production data drifts away from the training data. A model decays immediately after training.
- **You won't retrain often.** The bottleneck is mostly internal tooling, not technical necessity. Weibo updates some models every 10 minutes. Etsy released updates 50 times a day back in 2015.

### Batch vs. online prediction {#ch7-batch}

The chapter treats this as the fundamental placement decision. The author defines three operating modes:

- Batch prediction uses only batch features.
- Online prediction uses only batch features (e.g. precomputed embeddings).
- Online prediction uses both batch and streaming features.

Online prediction generates results on request, like Google Translate. Batch prediction computes recommendations periodically and stores them, like Netflix updating recommendations every few hours.

Batch prediction is a workaround for online prediction being too slow or expensive. It isolates the model from changing user behavior. For Netflix, a delay in updating recommendations is tolerable. For fraud detection or autonomous vehicles, that same delay makes the system useless.

|                   | Batch (asynchronous)                                               | Online (synchronous)                                            |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Frequency** | Periodical, e.g. every four hours                                  | As soon as requests come                                       |
| **Useful for** | Accumulated data, no immediate result needed (recommender systems) | Predictions needed the moment a sample appears (fraud detection) |
| **Optimized for** | High throughput                                                    | Low latency                                                    |

Many platforms use hybrids. DoorDash batches restaurant recommendations but generates predictions for specific food items online.

I encountered this when working on an app where users ask open-ended questions about a book using Claude Opus. Initially, I planned to batch these answers. However, generating an answer to an unpredictable user text requires online prediction. The practical approach is to cache answers to the most common questions and serve them from storage, while maintaining online generation for the less common creative queries.

### The two-pipeline bug {#ch7-two-pipeline}

The same feature is often computed in two different ways, causing quiet disagreements between the training and serving environments.

During training, you have a month of logged historical data. You load it into a static table and compute a metric like average speed in bulk. During inference, data arrives live. You calculate the average speed over a sliding five-minute window that advances continuously. Because these are separate code paths, they drift. The model learns on one dataset and predicts on another. Uber and Weibo unified their pipelines with stream processors like Apache Flink or used feature stores to resolve this.

### Model compression {#ch7-compression}

If a model is too slow, you can use a smaller model. Compression often increases speed as a side effect.

#### Quantization

Quantization reduces the bits per parameter, moving from 32-bit floats to 16-bit or 8-bit integers. It halves the memory footprint and speeds up computation directly.

The trade-off is rounding error. Using fewer bits restricts the representable range. Small rounding errors can cause significant performance drops.

#### The other three

- **Low-rank factorization** replaces high-dimensional tensors with lower-dimensional ones. It is strictly tied to the network architecture and requires specific design knowledge.
- **Knowledge distillation** trains a small student model to mimic a large teacher model. It requires an already trained large teacher, which carries a high training cost.
- **Pruning** zeroes out the least useful weights in the network. It can eliminate over 90% of nonzero parameters while maintaining accuracy.

The field lacks a consensus on why pruning works. Liu et al. argue the success comes from the pruned architecture itself, and they recommend retraining it from scratch. Zhu et al. demonstrated the opposite result experimentally. Their large sparse pruned model outperformed the retrained dense version.

#### The Roblox case study

Roblox applied quantization to BERT to handle over a billion daily requests on CPUs. Moving from 32-bit floats to 8-bit integers reduced latency by a factor of seven and increased throughput by a factor of eight. The case study does not report the output-quality changes after this step. Optimizing for speed without measuring the accuracy cost invalidates the latency gain.

### Cloud vs. edge {#ch7-cloud-edge}

The cloud is easy to start with, but the costs accumulate as usage grows.

Network latency is often the real system bottleneck. You can reduce inference time from 30 ms to 20 ms, but network round-trips can take seconds. Optimizing inference time while ignoring network packet transit time is a misallocation of effort. Edge computing runs on the device, solving connectivity issues and easing privacy compliance, but it requires the local hardware to have the memory and battery to support the computation.

### Compiling models to hardware {#ch7-compiling}

Adapting a framework to new hardware requires manual effort. PyTorch took over two years to support public TPUs. The industry uses intermediate representations (IR) to bridge frameworks and hardware backends.

A Stanford DAWN study found that standard NumPy or TensorFlow workloads ran 23 times slower on a single thread compared to hand-optimized code. To automate optimization, tools like autoTVM use machine learning to explore the computational graph, predict runtimes, and train a cost model. After about 70 trials, autoTVM outperforms the hand-tuned heuristics of cuDNN.

### ML in browsers {#ch7-browsers}

Running models in the browser via WebAssembly (WASM) provides portability across roughly 93% of devices. The performance cost is measurable. A study showed WASM applications ran 45% slower on Firefox and 55% slower on Chrome compared to native execution. Broad distribution requires a direct cut to performance.

### What I'm taking from it {#ch7-takeaways}

A deployed model is the start of the problems, not the end. The choices that determine whether the infrastructure works are engineering choices. Whether to use batch or online prediction, whether to run on the cloud or at the edge, and the unmeasured impact of quantization on output quality all dictate the system's success. I need to focus on deployment dynamics much more than I have previously.
