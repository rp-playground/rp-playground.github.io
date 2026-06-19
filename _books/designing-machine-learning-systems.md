---
layout: book
title: "Designing Machine Learning Systems"
authors: "Chip Huyen"
book_year: 2022
link: https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/
date: 2026-06-19
pinned: true
tags: [ML systems, deployment, MLOps, model compression]
summary: "Takeaways from Chapter 7 (model deployment) — deploying a model is an engineering problem, not an ML one."
---

*Takeaways from Chapter 7 of the book — on deploying ML models.*

As a reminder of where this chapter sits, Figure 1-1 from the book maps the whole ML system and points each chapter at the piece it covers. Deployment, monitoring, and updating — Chapters 7, 8, and 9 — are the top layer, the part that touches the people actually using the system. This chapter is the first of those three.

<figure>
  <img src="/assets/designing-ml-systems/components-of-an-ml-system.png" alt="Diagram mapping ML system users, business requirements, and developers to the layered components of an ML system, with each book chapter labeling the component it covers.">
  <figcaption>Figure 1-1 from the book: the components of an ML system, with each chapter labeling the piece it covers. Deployment, monitoring, and updating sit in the top layer that touches real users.</figcaption>
</figure>

The claim from this chapter that reshaped how I think about my own work: deploying a model is an engineering problem, not an ML one. Coming from the research side, that's the part I underrate. The model logic — data, features, architecture, metrics — is what I think of as the work, and the chapter's point is that getting that logic to run for real users is a separate discipline with its own failure modes. These are the things I want to remember.

## The deployment myths I was carrying

The chapter opens by debunking four myths, and three of them were mine. They shaped how I designed things.

- **One or two models in production.** Wrong by orders of magnitude. A ride-sharing app needs models for demand, driver availability, ETA, pricing, fraud, churn — and if it runs in 20 countries with ~10 models each, that's 200 models before you account for anything custom. Uber runs thousands. The infrastructure I'd sketch for a single model doesn't survive contact with this.

- **Performance holds if you do nothing.** It doesn't. Software rots, and ML rots faster because of data distribution shift — the production data drifts away from what you trained on. A model is best right after training and decays from there.

- **You won't retrain often.** The author reframes the question from "how often should I update" to "how often can I." Weibo's cycle for some models is 10 minutes. The DevOps comparison lands: Etsy was deploying 50×/day back in 2015. The bottleneck is mostly your own tooling.

The fourth myth — that scale is someone else's problem — applied to me less, but the argument is clean: most engineers work at companies large enough to have real users, so statistically you should care about scale.

## Batch vs. online prediction

This is the decision the chapter treats as fundamental, and the terminology is genuinely muddled, so the author reduces it to three modes worth memorizing:

- Batch prediction — uses only batch features.
- Online prediction using only batch features (e.g. precomputed embeddings).
- Online prediction using both batch and streaming features — also called streaming prediction.

**Online (synchronous):** predictions generated on request, the way you'd hit Google Translate. **Batch (asynchronous):** predictions computed periodically and stored, the way Netflix precomputes recommendations every few hours and serves them on login.

The framing that reorganized this for me is that batch prediction is a workaround, not a goal. It exists because online prediction was either too slow or too expensive. The question it puts directly: why precompute a million predictions and deal with storing and fetching them if you could generate each one as needed at the same cost and speed? As hardware and streaming infra improve, the author expects online to become the default. Batch is legacy, inherited from the MapReduce/Spark era when companies reused their existing batch systems for ML.

**The trade-off that actually bites:** batch prediction makes the model unresponsive to changing behavior. The example is concrete. You've been watching horror on Netflix, you switch to comedy and start browsing, and the recommendations can't update until the next batch runs. That's a mild annoyance for Netflix. For fraud detection, autonomous vehicles, or unlocking your phone with your face, the same latency is the difference between working and not working.

|                   | Batch (asynchronous)                                               | Online (synchronous)                                            |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Frequency**     | Periodical, e.g. every four hours                                  | As soon as requests come                                       |
| **Useful for**    | Accumulated data, no immediate result needed (recommender systems) | Predictions needed the moment a sample appears (fraud detection) |
| **Optimized for** | High throughput                                                    | Low latency                                                    |

These aren't mutually exclusive. A common hybrid is to precompute popular queries and serve the long tail online — DoorDash batches restaurant recommendations but generates food-item recommendations online once you click in.

**The cost argument I hadn't considered:** online prediction means you don't compute for users who never show up. If 2% of users log in daily and you batch-predict for everyone, 98% of that compute is wasted.

A personal example helped me get the distinction right, partly by getting it wrong first. I have in mind an app where users ask questions about a specific book — a passage, an interpretation, an open-ended creative prompt — with settings to shape the reply, such as answering as an academic teaching a classroom. For that I would want Claude Opus, because nothing else matches it on this kind of literary work. My first thought was that I would batch these answers. By the chapter's definitions that is the wrong label: generating an answer when the question arrives is online prediction, and that is what this app does. It has to. Like the English-to-French translator the chapter uses as an example, I cannot anticipate every question a user might ask, so I cannot compute the answers in advance.

Where the instinct was right is the hybrid. Opus is slow and expensive, and that cost is the reason to cache answers to common questions and serve those from storage, while less common creative questions are still generated online. The hard part, which I am setting aside here, is that a common question is not an exact match. Deciding when a new question is close enough to reuse a stored answer, and when a stored answer is out of date, is the real engineering problem.

## The two-pipeline bug

This is the most useful warning in the chapter for the kind of work I do, because it's a bug class, not a one-off. The same feature often gets computed two different ways — once for training, once for serving — and the two computations can quietly disagree.

The chapter's Google Maps example makes the distinction concrete. Say you want a feature like the average speed of all the cars in your path over the last five minutes. At training time you have a month of logged historical data sitting at rest, so you load it into a dataframe and compute the feature for many trips at once — it's one bulk operation over a static table, and you can look at any point in that month and read off the five minutes around it directly. That's the batch computation: the whole dataset is already there, and you process it in aggregate.

At inference time there is no table. Data is arriving live as the trip happens, so the same feature has to be recomputed continuously over a *sliding window* — a moving five-minute span that advances with the clock, recalculated from the stream of speed readings as each new one lands. Same definition, "average speed over the last five minutes," but one version reads it out of stored data in bulk and the other maintains it incrementally on a window of streaming data. Training computes it in batch; inference computes it as a stream.

Because those are two separate code paths, they can drift. A change made in one isn't mirrored in the other, and training and inference end up extracting different features from what should be the same definition — the model learns on one thing and predicts on another. It's worst when two teams own the two paths, which is the normal arrangement: the ML team owns the batch pipeline for training, the deployment team owns the stream pipeline for inference. The fix companies converge on is unifying the pipelines with a stream processor like Apache Flink, or using a feature store to keep the batch features used in training consistent with the streaming features used in prediction. Uber and Weibo both did major infra overhauls for exactly this.

## Model compression

If a model is too slow, there are three levers: faster inference, a smaller model, or faster hardware. Compression is the smaller-model lever, and it often makes things faster as a side effect. Four techniques are worth knowing, but they're not equal in practice.

### Quantization

Quantization is the technique I'd reach for first, and the case study backs that up. The chapter is direct that it's the most general and commonly used method. It reduces the bits per parameter — 32-bit float down to 16-bit, or to 8-bit integers ("fixed point"), or in the extreme to 1 bit. A 100M-parameter model at 32 bits is 400 MB; halve the bits, halve the footprint. It also speeds up compute directly: adding two 16-bit numbers takes half the per-bit time of two 32-bit numbers.

**The caveat that costs you:** fewer bits means a smaller representable range, so you round and scale, and rounding errors can cause large performance changes, with under/overflow risking values collapsing to zero. The chapter says small rounding errors can lead to big performance changes, and I take that seriously. It's cheap to apply (a few lines in TF Lite, PyTorch Mobile, or TensorRT) which makes it tempting to apply without measuring.

### The other three

- **Low-rank factorization** — replace high-dimensional tensors with lower-dimensional ones. Compact filters in SqueezeNet hit AlexNet accuracy with 50× fewer parameters. But it's architecture-specific and needs real design knowledge, so it's not broadly applicable.

- **Knowledge distillation** — train a small student to mimic a large teacher. DistilBERT keeps 97% of BERT's language understanding at 60% faster and 40% smaller. The catch is the dependency on a teacher; no pretrained teacher means training one first, which is expensive. Hasn't found wide production use.

- **Pruning** — either remove nodes (changing architecture) or, more commonly, zero out the least useful weights, making the network sparse. Can cut nonzero parameters by over 90% without hurting accuracy much.

**The pruning result I found genuinely unsettled:** there's an open disagreement about why it even works. Liu et al. argue the value isn't in the inherited "important weights" at all but in the pruned architecture, which you should retrain from scratch. Zhu et al. found the opposite — the large sparse pruned model beat the retrained dense one. So the technique works, and the field doesn't agree on the mechanism. That's the kind of result I'd lead a reading group with.

### The Roblox case study

Roblox scaled BERT to over a billion daily requests on CPUs, needing 25,000+ inferences/second under 20 ms. They went baseline BERT → DistilBERT → dynamic shape inputs → quantization. The biggest single jump was quantization: 32-bit float to 8-bit int cut latency 7× and raised throughput 8×.

**Why I don't take the numbers at face value:** the author flags it directly, and it's the right instinct — there's no mention of output-quality changes after each step. A latency win with an unmeasured accuracy cost isn't a clean win. Same reason the chapter warns against over-reading MLPerf: a popular model running fast on some hardware can just mean it was over-optimized for it.

## Cloud vs. edge

The other placement decision: where computation happens. Cloud is easy to start with and how most companies first ship, but the downsides stack up.

- **Cost.** Compute is expensive and cloud bills run from $50K to $2M+ a year for small and mid-size companies, into the hundreds of millions for the big ones. A mishandled cloud setup has bankrupted startups.

- **Network latency, often the real bottleneck.** The point that reframed this for me: you can shave ResNet-50 inference from 30 ms to 20 ms, but network round-trips can run to seconds. Optimizing inference while ignoring the network is solving the wrong problem.

- **Connectivity.** Edge runs where the cloud can't — unreliable or absent internet, or clients with strict no-internet policies.

- **Privacy and regulation.** Keeping data on-device eases GDPR-style compliance and shrinks the breach surface (nearly 80% of companies reported a cloud breach in 18 months). It doesn't eliminate the risk — sometimes an attacker just walks off with the device.

The catch with edge is hardware: the device needs the compute, memory, and battery to run the model. Running full-size BERT on a phone, if it runs at all, drains it fast.

## Compiling models to hardware

This was the densest section and the one furthest from my comfort zone, so I'm keeping the core idea and the vocabulary.

A framework only runs on a hardware backend if the vendor supports it — PyTorch didn't run on TPUs until September 2020, over two years after TPUs went public. Supporting every framework-hardware pair by hand doesn't scale, because backends differ in memory layout and compute primitive (CPU scalar, GPU vector, TPU tensor). The fix is a middleman: an **intermediate representation**. Frameworks lower to the IR, hardware vendors support the IR, and compilers generate hardware-native code through a series of high- and low-level IRs. The author is careful that this is *lowering*, not translation — there's no one-to-one mapping.

### Optimization, and using ML to do it

Generated code runs but not necessarily fast. Optimization happens locally (single operators) or globally (the whole graph). The common local techniques: **vectorization**, **parallelization**, **loop tiling** (reorder access for the cache — and notably, a good access pattern on CPU is a bad one on GPU), and **operator fusion** (collapse multiple ops into one loop to cut redundant memory access).

**The number that stuck:** a Stanford DAWN study found typical NumPy/pandas/TensorFlow workloads ran 23× slower single-threaded than hand-optimized code. The cross-framework seams are where the time goes, even when each library is individually optimized.

Hand-tuned heuristics are how vendors optimize popular models (NVIDIA tuning ResNet-50 on their own servers), but they're non-optimal and non-adaptive — and if you invent a new architecture, no vendor has tuned it for you yet. So the move is to use ML: autoTVM breaks the graph into subgraphs, predicts runtimes, searches each, and trains a cost model from real runtime data, which lets it adapt to any hardware. The cost is real — the search can take hours or days — but it's a one-time, cacheable operation. In the figure it takes ~70 trials for autoTVM to beat cuDNN.

## ML in browsers

Last idea, and a neat one. Instead of compiling to a specific backend, compile to the browser and run anywhere a browser runs — MacBook, Chromebook, phone, whatever the chip. JavaScript tools exist (TensorFlow.js and others) but JS is slow. The more promising path is **WebAssembly**: compile your scikit-learn / PyTorch / TF model to WASM, get an executable you call from JS, supported on ~93% of devices as of late 2021.

**The limitation, stated plainly:** WASM runs in the browser, so it's slow. Faster than JS, but a study measured WASM apps running 45% slower than native on Firefox and 55% slower on Chrome. Portability buys you a real performance cut.

## What I'm taking from it

The chapter's own summary is that these are hardware-limited problems, and the author bets ML systems move toward on-device online prediction as hardware improves. That's the optimistic read. The practical one, for me, is shorter: a deployed model is the start of the problems, not the end. The choices that decide whether it works — batch vs. online, cloud vs. edge, whether the two pipelines agree, what quantization quietly did to output quality — are engineering choices. I have more to learn on that side than on the modeling side I came in with.
