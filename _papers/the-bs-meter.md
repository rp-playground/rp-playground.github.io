---
layout: paper
title: "The BS-meter: A ChatGPT-Trained Instrument to Detect Sloppy Language-Games"
authors: "Trevisan, Giddens, Dillon & Blackwell"
paper_year: 2024
link: https://arxiv.org/abs/2411.15129
date: 2026-07-09
tags: [LLM evaluation, calibration]
summary: "Two classifiers trained on Nature articles vs ChatGPT-4o imitations are turned into a 0–100 'bullshit' scale — a relative similarity index dressed up as an absolute measure."
---

The authors propose a conceptual-philosophical representation of ChatGPT consisting of two components:
the one resulting from the pre-training phase, in which the system absorbs multiple language-games,
and the one resulting from the post-training phase, in which a Dialogue Management System (DMS)
converts the statistical-probabilistic system into a product optimized for commercial purposes,
where the prevailing weight is given to the language-game of
bullshit, understood in a technical sense as:

> a form of linguistic communication characterised by
> "a lack of connection to a concern with truth – [. . . ], indifference to how things really are."

The authors create a dataset composed of Nature articles and articles generated
by ChatGPT-4o, using the original article's title in the prompt.

They build a scale from 0 to 100 based on the confidences produced by two classifiers:

- **XGBoost on TF\*IDF** — classifies based on distinctive word frequencies.
- **Fine-tuned RoBERTa** — classifies based on contextual token embeddings, rather than word counts.

From these, they derive a metric, the MSD metric.

They then test the scale on OOD (out-of-distribution) texts: political manifestos and texts produced in the context of bullshit jobs.
The mean differences between the groups are significant. The BS-meter
is therefore a relative similarity index with respect to the two corpora making up the dataset.

## Doubts

Once the BS-meter is introduced, the risk is to interpret the distances as absolute
(e.g., a score of 49), when the confidences lack calibration.

Two OOD texts can have a score of 49 for totally different reasons. Their
deviations from the two training groups are not necessarily explained in terms
of a single axis. And even the fact that the axis is that of "bullshit" is pure interpretative arbitrariness.

The paper ultimately acknowledges having detected "some patterns of language use", without however establishing to which language
game these patterns belong. A feature analysis could have helped.

On the other hand, despite the modest results and conclusions,
everything else — the name BS-meter, the paper's title, the general framing — seems to promise results that are not there.
