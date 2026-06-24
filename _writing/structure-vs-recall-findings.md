---
layout: article
title: "Structural vs. Factual Recall in GPT-2 Small"
subtitle: "Syntactic vs. factual retrieval in a small model"
description: A synthesis of structural experiments on GPT-2 Small — the capital of France sits at rank 92 under the "is ___" frame 
  yet jumps to argmax under an appositive or cloze, factual recall gated by syntax, with the attention heads and MLPs fighting over the output.
summary: GPT-2 Small knows Paris — it sits at rank 92, not absent. Change the grammatical frame and it jumps to rank 0. 
  A synthesis of the structure-vs-recall experiments — the syntax gate, the writer head L9H8 against the late-layer MLP suppressors, 
  and why France stays a scaling outlier.
date: 2026-06-23
tags: [mech-interp, transformers, interpretability, GPT-2, DLA]
published: true
permalink: /writing/structure-vs-recall-findings/
---

**Background** 

This is my first practical application of mechanistic interpretability tools. It builds on my earlier project,  
[Replicating a GPT-2 Transformer Block from the Residual Stream](/writing/replicating-gpt2-block/), 
where I manually rebuilt GPT-2’s first block to understand exactly how its internal components function.

**The Investigation**

While playing with GPT-2 Small, I've noticed that it is quite sensitive to the prompt. 
Even minor variations are decisive in making it either adhere to grammar rules or focus on factual recall. 
Here, I will examine more closely why the model favors one over the other, 
and how its internal circuitry retrieves facts when prompted the right way.

The analysis consists of two parts:

* The Zero-Shot Case: First, I examine the model's behavior under a weak syntactic frame. 
In this scenario, late-layer suppressors overpower the model's factual knowledge, forcing it to output generic, 
grammatical continuations.

* The Few-Shot Case: Second, I explore the consequent activation of specific internal circuits when the model 
is given a strong pattern. These circuits allow the model to bypass the grammatical suppressors 
and successfully retrieve targeted factual knowledge.


**Findings**

The most important findings are:
* the role of the L9H8 attention head as a factual writer 
* the function of late-layer MLPs as generic suppressors

These results align closely with existing mechanistic interpretability literature — see the 
[Discussion](#discussion-alignment-with-the-literature) after the experiments for the full comparison.

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## 1. The Zero-Shot

Feeding GPT-2 Small (124M) the zero-shot prompt "The capital of France is" 
results in the prediction `·now` instead of `·Paris`.

If you let the model predict greedily at every position, not just the last one, 
it does the same thing each time — it picks 
the word that fits the grammar, not a word that adds a fact:

```
pos 2  '...The capital'            -> ' of'
pos 3  '...The capital of'         -> ' the'
pos 4  '...The capital of France'  -> ','
pos 5  '...The capital of France is' -> ' now'
```

I see a promise of Paris at pos 4, after the predicted comma. 
It appears to me the comma like setting up the phrase 
"The capital of France, Paris, is…"—an intuition that is confirmed by our frame-sensitivity experiments below.

For now, it is important to note that the model's failure to return Paris is not due to a lack of knowledge.
The factual token `·Paris` is
not absent; it sits at Rank 92 (log-prob −6.42) in the final distribution 
(see [Experiment 1](#experiment-1-locate-paris-in-the-distribution)). It 
is simply outcompeted by a "generic mass" of continuation words (`·now`, `·a`, `·the`)—a 
suppression that persists across larger model scales, where `·Paris` 
improves non-monotonically but never wins the argmax (see [Experiment 2](#experiment-2-the-scale-curve)).

This suppression is not unique to France. Across a 12-country probe set, the capital 
is never the top prediction in the ...is frame (median rank 27) (see [Experiment 3](#experiment-3-the-scale-curve-over-twelve-capitals)). The model 
prioritizes grammatical continuation over specific 
factual lookups.


### Experiment 1: Locate `·Paris` in the distribution

The first thing to settle empirically is whether `·Paris` is sub-argmax or genuinely suppressed. Report its rank and log-prob in the final-position distribution, for both the leading-space token `·Paris` and the bare `Paris`, and check the BPE segmentation so nothing is missed.

```python
last = model(model.to_tokens(prompt))[0, -1]
logprobs = last.log_softmax(-1)
for s in (" Paris", "Paris"):
    tid = model.to_single_token(s)
    rank = (logprobs > logprobs[tid]).sum().item()
    print(f"{s!r:9s} rank={rank:5d}  logprob={logprobs[tid]:.2f}")
```

*Result.* The leading-space token `·Paris` sits at **rank 92** (log-prob −6.42) — present and clearly sub-argmax, not buried. The bare `Paris` (the wrong tokenization after a trailing space) is far down at rank 12 973; both are single tokens.

| token | segmentation | rank | log-prob | multitoken |
|---|---|---|---|---|
| `" Paris"` | `[" Paris"]` | 92 | −6.42 | False |
| `"Paris"`  | `["Paris"]`  | 12 973 | −14.57 | False |

Rank 92 out of ~50 k shows clearly that recall is there — the open question is what holds it down.

### Experiment 2: The scale curve

Run the same measurement across `gpt2` (124M) → `gpt2-medium` (355M) → `gpt2-large` (774M) → `gpt2-xl` (1.5B) and track the rank/log-prob of `·Paris` and whether it eventually wins the argmax.

*Result.* `·Paris` improves sharply but **non-monotonically**, and it **never wins the argmax** — not even at 1.5B:

| model | params | rank of `·Paris` | log-prob | argmax? |
|---|---|---|---|---|
| `gpt2`        | 124M | 92 | −6.42 | no |
| `gpt2-medium` | 355M | 3  | −3.71 | no |
| `gpt2-large`  | 774M | 54 | −5.93 | no |
| `gpt2-xl`     | 1.5B | 2  | −3.08 | no |


Two things contradict the capacity-limited prediction **for France**. 
First, the curve is non-monotonic: `gpt2-medium` 
pulls `·Paris` to rank 3, but `gpt2-large` regresses to 54 before `gpt2-xl` recovers to rank 2. 
Second, the winning token shifts (`·now` → `·the` → `·a`) but stays generic; at gpt2-xl `·Paris` actually 
outscores `·now` (logit diff +1.26) but loses to `·a` — so for France, `·Paris` is *never* the argmax, at any scale here.

### Experiment 3: The scale curve over twelve capitals

Re-ran the measurement in [Experiment 2](#experiment-2-the-scale-curve)
as a distribution over the twelve-capital probe set at every scale:

| model | median rank | IQR | capitals at argmax |
|---|---|---|---|
| `gpt2`        | 27  | [22, 52] | 0 / 12 |
| `gpt2-medium` | 2   | [1, 3]   | 3 / 12 |
| `gpt2-large`  | 33  | [18, 50] | 0 / 12 |
| `gpt2-xl`     | 0.5 | [0, 1]   | 6 / 12 |

The **non-monotonicity** is real: the population median zigzags the same way (27 → 2 → 33 → 0.5), 
with `gpt2-large` regressing. 
But capacity is clearly **not** irrelevant — by gpt2-xl the median capital *is* the argmax 
(median 0.5, six of twelve winning), so for most subjects scale favours the recall. 

#### The limits of scale

While scaling the model resolves this issue for most subjects, France remains a stubborn outlier 
due to training data distributions.

Moving from GPT-2 Small (124M) to GPT-2 XL (1.5B) pushes the median capital prediction to Rank 0.5 
across the 12-country probe set. However, for France, `·Paris` only reaches Rank 2 at 1.5B. This indicates 
a deep data-dilution issue: the specific string "The capital of France is" is likely rarely followed by "Paris" 
in the training corpus, often preceding a description instead (e.g., in appositives).

The phrasing "the capital of France is ___", with the name straight after the verb, 
belongs to encyclopedias and grammar books and almost nowhere else. 
And encyclopedias and grammar books are not among the fifteen domains that contributed 
the most data by volume to WebText, as the model card records.


### Experiment 4: The syntax gate: frame-sensitivity

Factual knowledge in this model is gated by grammatical framing. At entirely 
fixed weights, altering only the prompt's syntax completely changes the result.

Changing the prompt to an appositive ("The capital of France,") or a cloze 
("The capital of France is the city of") immediately elevates `·Paris` from Rank 92 
to Rank 0 (the argmax). The model knows the fact, but the predicate-nominative
(is ___) frame suppresses it in favor of structural modifiers.

Hold scale fixed and vary only the syntactic frame, measuring the rank of `·Paris` in each:

- predicate-nominative — `"The capital of France is"`
- appositive — `"The capital of France,"`
- QA — `"Q: What is the capital of France? A:"`
- cloze / definitional — `"The capital of France is the city of"`

*Result.* At **fixed weights**, changing only the frame moves `·Paris` from rank 92 to **rank 0 — the argmax** — in two of the four frames:

| frame | prompt | rank | log-prob | argmax |
|---|---|---|---|---|
| predicate-nominative | `"The capital of France is"`        | 92 | −6.42 | no |
| appositive           | `"The capital of France,"`           | **0** | −1.25 | **yes** |
| QA                   | `"Q: What is the capital of France? A:"` | 4 | −3.64 | no |
| cloze / definitional | `"The capital of France is the city of"` | **0** | −2.33 | **yes** |

The appositive (`…France,`) and the cloze (`…is the city of`) both put `·Paris` first; 
the QA frame surfaces it to rank 4. Nothing about the model changed — only the syntax of the slot. 

So `·now` wins the predicate-nominative slot not because the model cannot recall Paris, 
but because this construction favors a generic predicate over the name — the knowledge is *present and gated by frame*.


### Experiment 5: The internal circuitry in the Zero-Shot case

Without a strong structural cue, the zero-shot run becomes a direct competition between opposing components:

The Writer: Direct Logit Attribution (DLA) reveals that a single attention head (L9H8) acts
as the primary factual writer, pushing +1.81 to the `·Paris` logit.

The Suppressors: L9H8's factual write is ultimately drowned out by the late-layer MLPs (e.g., 
`L10_mlp` writes −1.17 against `·Paris`) and the unembed bias, which heavily favor generic continuations.

Routing: Path patching shows that L9H8's output is routed suppressively downstream, halving its 
own effectiveness by inhibiting other potential Paris-writing heads.

*Direct logit attribution (the lens-free version).* Decompose the real final-position residual 
into per-component contributions, apply the model's own fixed `ln_final` scale, and project each onto 
the `·Paris` − `·now` logit direction. The pieces sum back to the true logit difference — the reconstruction 
check passes to within ≈ 1e-6. 
Two things fall out:

| promotes `·Paris` (vs `·now`) | DLA | | suppresses (writes `·now`) | DLA |
|---|---|---|---|---|
| **L9H8** | **+1.81** | | `L10_mlp`   | −1.17 |
| L11H3 | +0.45 | | `L0_mlp`    | −1.01 |
| L10H0 | +0.38 | | `L7_mlp`    | −0.77 |
| L11H2 | +0.31 | | unembed bias   | −0.67 |
| L8H11 | +0.27 | | L8H10          | −0.30 |
| L9H3  | +0.24 | | `L5_mlp`    | −0.28 |


## 2. The Few-Shot

When given a structural pattern ("The capital of Italy is Rome... France is"), the network operates 
differently, utilizing an assembly line to bypass the suppressors:

Gathering: Early and mid-layer "Gathering Heads" (Layers 4-7) scan the context. They pay disproportionately
high attention to context tokens like `·Rome`, `·Berlin`, and `·capital`.

<figure>
  <img src="/assets/structure-vs-recall-findings/the-few-shot-1.png" alt="Attention-pattern visualization for layer 7 on the few-shot prompt '<|endoftext|>The capital of Italy is Rome. The capital of Germany is Berlin. The capital of France is'. A head selector shows all twelve heads; Head 7 is locked and its attention map is enlarged on the left. With the final ' is' token selected as destination, attention concentrates back on the earlier capital-name source tokens ' Rome' and ' Berlin', which are highlighted in the token strip.">
  <figcaption>Layer 7, <code>Head 7</code> on the few-shot prompt. With the final <code>·is</code> as the destination token, the head attends back to the in-context capital names (<code>·Rome</code>, <code>·Berlin</code>) — the "gathering" step that scrapes the pattern and signals that a city name is required next.</figcaption>
</figure>

<figure>
  <img src="/assets/structure-vs-recall-findings/the-few-shot-2.png" alt="The same layer-7 attention-pattern visualization for the few-shot prompt, now with Head 11 locked and enlarged. With the final ' is' token as destination, the head attends back to the in-context capital names ' Rome', ' Berlin' and ' France', which are highlighted in the token strip.">
  <figcaption>The same layer with <code>Head 11</code> selected. Gathering is not the work of a single head: <code>Head 11</code> shows the same back-attention from <code>·is</code> to the capital names (<code>·Rome</code>, <code>·Berlin</code>, <code>·France</code>), reinforcing the "city required" cue passed to the mid-layer MLPs.</figcaption>
</figure>

<figure>
  <img src="/assets/structure-vs-recall-findings/the-few-shot-3.png" alt="The same layer-7 attention-pattern visualization for the few-shot prompt, now with Head 8 locked and enlarged. With the final ' is' token as destination, most attention collapses onto the leading '<|endoftext|>' token — a dark column on the far left of the attention map — but a weaker secondary share lands on the schema word ' capital' rather than on the capital names ' Rome' / ' Berlin'.">
  <figcaption><code>Head 8</code> gathers a different cue. Most of <code>·is</code>'s attention goes to the leading <code>&lt;|endoftext|&gt;</code> sink, but its secondary share lands on the schema word <code>·capital</code> — not on the answer names. Where <code>Head 7</code> and <code>Head 11</code> scrape the in-context capitals (<code>·Rome</code>, <code>·Berlin</code>), <code>Head 8</code> attends to the structural token that says "a capital is being named". Whether that share is functional would need an ablation or DLA on the head's output; attention weight alone can't settle it.</figcaption>
</figure>

Pattern Injection: These heads push a structural signal into the residual stream indicating that a city 
name is required next.

Factual Overwrite: Mid-layer MLPs (like Layer 8) read this combined signal ("France" + "City required"). 
Acting as a Key-Value memory, they violently inject the mathematical representation of `·Paris` into the 
residual stream, spiking its probability to near 100%.

### Steering the capital-city features (quick check)

A quick causal probe — not a full analysis, just a reference for future work: 
if these capital/city features are what carries the factual answer, suppressing them should remove `·Paris`. 
Using Neuronpedia's steering on the few-shot circuit, I negatively steered (−5.0×) the features that fire 
on the city slot — `City Names` (L22), `European locations` (L21), and `city centers, capitals` (L2):

<figure>
  <img src="/assets/structure-vs-recall-findings/steering-capitals-1.png" alt="Neuronpedia 'Features to Steer' panel on the few-shot prompt 'The capital of Italy is Rome. The capital of France is'. Three capital/city features are listed — 'City Names' (Layer 22, index 9335, activation 42.17 at the final ' is'), 'European locations' (Layer 21, index 14331, activation 29.94 at ' is'), and 'city centers, capitals' (Layer 2, index 11838, activation 12.84 at ' capital') — with per-token sliders all set to −5.0× to negatively steer the features across every position.">
  <figcaption>The steering setup: the capital/city features (<code>City Names</code> L22, <code>European locations</code> L21, <code>city centers, capitals</code> L2) negatively steered at −5.0× across all positions.</figcaption>
</figure>

<figure>
  <img src="/assets/structure-vs-recall-findings/steering-capitals-2.png" alt="Side-by-side 'Results' comparison. Default Output: 'The capital of Italy is Rome. The capital of France is Paris. The capital of the United States is Washington'. Steered Output: 'The capital of Italy is Rome. The capital of France is at the top of the is at the top of'.">
  <figcaption>Impact: with the capital/city features suppressed, the answer flips from <code>·Paris</code> (default) to the generic filler "<code>at the top of</code>" (steered). Knocking out those features removes the factual recall and the model falls back to grammatical continuation — consistent with the "factual overwrite" story above. This is only a quick steering check; a proper ablation/DLA pass is left to future analysis.</figcaption>
</figure>

---

## Conclusion

The experiments on GPT-2 Small reveal that the model's failure to retrieve `·Paris` is (unsurprisingly) not due to absent knowledge; 
rather, factual recall is deeply entangled with and gated by syntactic priors. 
The model continually balances competing priorities, with structural continuation often overpowering 
factual retrieval unless explicitly cued.  

This dynamic is defined by a clear mechanical contrast between zero-shot suppression and few-shot activation:

* Zero-Shot Suppression: Under weak syntactic frames (e.g., the predicate-nominative "is ___"), the model retains 
the latent fact—with ·Paris explicitly present in the distribution—but it is heavily penalized.
Late-layer MLPs and unembed biases act as aggressive suppressors, overpowering the network's dedicated factual 
writer heads (such as L9H8) in favor of generic grammatical continuations like `·now`.  

* The Syntax Gate: Factual retrieval can be unlocked instantly by altering the grammatical frame. 
Simply using an appositive or cloze construction completely bypasses the late-layer suppressors, 
elevating the target fact directly to the argmax.  

* The Few-Shot Assembly Line: When provided with a strong structural pattern via in-context examples, 
the network utilizes a coordinated circuit to actively bypass grammatical suppressors. Early and mid-layer 
"Gathering Heads" (Layers 4-7) scan the context, paying disproportionate attention to previous answers (like `·Rome` or `·Berlin`) 
and structural schema words.  

* Targeted Factual Overwrite: These gathering heads push a definitive signal into the residual stream indicating that 
a specific entity type (a city) is required next. Mid-layer MLPs (such as Layer 8) read this combined structural 
and contextual signal, operating as a Key-Value memory to violently inject the mathematical representation of the correct
fact into the stream, spiking its probability to near 100%.  

Ultimately, GPT-2 Small demonstrates that its factual knowledge is highly accessible. However, whether that knowledge 
surfaces depends entirely on an internal routing battle: default late-layer circuits will stubbornly prioritize generic grammar, 
whereas strong syntactic frames or in-context few-shot patterns empower early and mid-layer circuits to execute a definitive 
factual overwrite.

---

## Discussion: alignment with the literature

These results align closely with existing mechanistic interpretability literature. 
Independent studies have similarly documented these exact components balancing factual recall 
and grammatical constraints within GPT-2 Small. For instance, [Lv et al. (2024)](#ref-lv-2024) explicitly identified 
L9H8 as an "Argument Passer" capable of mapping country names to capitals, while also noting a universal 
anti-overconfidence mechanism in the final MLP layers that prefers "safe" grammatical predictions over specific facts. 
Furthermore, [recent work by other researchers (2026)](#ref-beyond-importance-2026) corroborates the early-versus-late routing dynamic, 
finding that early transformer channels transport relation-frame content, while late attention transports 
subject-retrieval content—specifically refining at the head granularity to the known L9H8 head. 

## Moving forward

The immediate next task for this project will be to thoroughly study these cited articles to conduct a proper, 
formal comparison, mapping my independent circuit-level observations directly against these established published benchmarks.

## References

* <a name="ref-lv-2024"></a>Lv, A., Chen, Y., Zhang, K., Wang, Y., Liu, L., Wen, J.-R., Xie, J., & Yan, R. (2024). 
Interpreting Key Mechanisms of Factual Recall in Transformer-Based Language Models. 
arXiv:[2403.19521](https://arxiv.org/abs/2403.19521).

* <a name="ref-beyond-importance-2026"></a>Guo, Y., Du, J.-H., & Chen, X. (2026). Beyond Importance: 
Interchange-Sobol Sensitivity Reveals Task-Specific Content Channels in Transformer Components (June 2026). 
arXiv:[2606.20678](https://arxiv.org/abs/2606.20678).
