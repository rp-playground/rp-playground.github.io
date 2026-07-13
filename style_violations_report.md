# Style Guide Violations Report

Review of `_papers`, `_talks`, `_writing`, `_courses`, `_books` against `docs/writing-style-guide.md`.

Severity legend: **clear** = unambiguous violation of a named rule; **borderline** = defensible either way, flagged for a human call.

**Status (2026-07-13): all *clear* fixes have been applied to the source files**, including the corrupted table cells / blockquote lines and a second `>:` artifact found in `_talks/biology-of-an-llm.md:65`. *Borderline* findings are untouched. Also fixed while applying: 8 files had unquoted YAML front-matter `description`/`summary` values containing `: ` (the same dash-replacement artifact), which made Jekyll silently drop `structure-vs-recall-findings` and `transformers` from the built site; all 8 are now quoted and the build is clean. Left for the author: the borderline items, the voice conversion of `dante-lemma-bm25-routing.md`, the LeCun quote's original punctuation, the Moby-Dick/Céline dangling references, the MSD acronym expansion, and the fastbook channel/batch-size numeric inconsistencies.

A pattern worth naming up front: across several files, banned em dashes appear to have been mechanically replaced with colons, commas, or bare hyphens instead of restructured. This keeps the dash cadence the ban targets and in many cases produces ungrammatical sentences ("measured against: including", "suppressors: so", "input-including my face-as"). Those are flagged individually below as "dash-substitute punctuation". The same replacement also hit non-prose content, which violates the guide's "every number, table, code block … byte-for-byte unchanged" checklist item: table cells that used an em dash as a placeholder now read `|: |` (`_writing/dante-lemma-bm25-routing.md:119`, `_writing/transformers.md:64`), a blockquote attribution line became `>:` (`_writing/transformers.md:56`), and a speaker quote in `_talks/yann-lecun-world-models-eth.md:53` had its internal dash swapped for a colon.

---

## _books/designing-ml-systems-revised.md

- **Line 74** — decorative metaphor / anthropomorphizing — *borderline*
  - Quote: "The same feature is often computed in two different ways, causing quiet disagreements between the training and serving environments."
  - Fix: "The same feature is often computed in two different ways, so the training and serving environments produce different values without raising any error."
- **Line 102** — colloquial intensifier — *clear*
  - Quote: "The cloud is easy to start with but accumulates massive costs."
  - Fix: "The cloud is easy to start with, but the costs accumulate as usage grows." (Or state the figure if the book gives one.)
- **Line 114** — aphoristic punch-line — *borderline*
  - Quote: "Broad distribution requires a direct cut to performance."
  - Fix: delete (the 45%/55% figures in the previous sentence already state the trade-off), or fold in plainly: "That slowdown is the cost of the roughly 93% device coverage."
- **Line 118** — mechanical triplet — *borderline*
  - Quote: "Whether to use batch or online prediction, whether to run on the cloud or at the edge, and the unmeasured impact of quantization on output quality all dictate the system's success."
  - Fix: break the rhythm: "Whether to use batch or online prediction and whether to run on the cloud or at the edge dictate the system's success. So does the unmeasured impact of quantization on output quality."

Checked and judged compliant: "like Google Translate" / "like Netflix" (line 58) are literal examples, not similes; "Deployment, monitoring, and updating" (lines 33, 37) is a factual enumeration of Chapters 7–9; "an engineering problem, not an ML one" (lines 19, 40) is a plain contrastive claim the guide's own ✓ examples permit.

## _courses/fastbook-13-convolutions.md

- **Lines 59–60** — colloquial intensifier — *borderline*
  - Quote: "so the input count is comfortably larger than the output count without enlarging the kernel."
  - Fix: "so the input count is already much larger than the output count without enlarging the kernel."
- **Line 160** — filler verb/metaphor — *borderline*
  - Quote: "But on its own it does **not** rescue an unnormalized net: fastai stays collapsed at 0.1135."
  - Fix: "But on its own it does **not** make an unnormalized net train: fastai stays collapsed at 0.1135."
- **Lines 164–165** — aphoristic punch-line / drumroll cadence (mirrors the guide's banned "Same data, same projection: …") — *borderline*
  - Quote: "Same recipe, different outcome. Same architecture. What we cannot match is:"
  - Fix: "The recipe and the architecture match the book's, but the outcome differs. What we cannot match is:"

Checked and judged compliant: italic passages on lines 105, 114, 158, 279–281 are quotations from fastbook (source voice, exempt); "fastai 0.1135 is the frequency of the most common test class: …" (line 95) is an explanatory colon, not a drumroll; short fragments are acceptable notes style.

Out-of-scope technical notes (not style, flagged in passing):
- Line 62 states the channel progression as "8→16→32→64", but the code block at lines 37–44 shows 4→8→16→32 (with a final conv to 2).
- Line 285 says "937 batches of 60 images each = 59968"; 937 × 64 = 59968, so the batch size should presumably be 64.

## _papers/baseline-detecting-ood.md

- **Line 20** — dash-substitute colon (ungrammatical) — *clear*
  - Quote: "It is the reference point every later OOD method is measured against: including the energy score I compared it to on my own [bear detector](/writing/ood-detection/)."
  - Fix: "It is the reference point every later OOD method is measured against, including the energy score I compared it to on my own [bear detector](/writing/ood-detection/)."

## _papers/calibration-modern-neural-networks.md

No violations. The only prose is the placeholder "*On the reading list: notes to come.*", which is functional.

## _papers/papers-to-read.md

- **Lines 31–33** — dash-substitute colon (ungrammatical) — *clear*
  - Quote: "…land on **temperature scaling**: dividing the logits by a single learned scalar before the softmax: which recalibrates remarkably well while leaving accuracy untouched."
  - Fix: "…land on **temperature scaling** (dividing the logits by a single learned scalar before the softmax), which recalibrates remarkably well while leaving accuracy untouched."
- **Lines 35–36** — dash-substitute punctuation (spaced hyphens as em dashes) — *borderline*
  - Quote: "if I want to treat a model's outputs as real probabilities - for thresholds, abstention, selective prediction, or any downstream decision - calibration is the property that makes that valid"
  - Fix: "if I want to treat a model's outputs as real probabilities (for thresholds, abstention, selective prediction, or any downstream decision), calibration is the property that makes that valid"
- **Line 95** — dash-substitute punctuation — *borderline*
  - Quote: "**Companion paper: *On the Biology of a Large Language Model*** -" before the link.
  - Fix: use the "·" separator already used in the citation lines, or a period.
- **Lines 58–59** — dash-substitute colons, twice in one sentence (second is ungrammatical) — *clear*
  - Quote: "it names the exact components I bumped into independently in my [Structure vs. Recall findings](/writing/structure-vs-recall-findings/): the L9H8 writer head and the late-layer MLP suppressors: so it's the benchmark I need to read closely…"
  - Fix: "it names the exact components I bumped into independently in my [Structure vs. Recall findings](/writing/structure-vs-recall-findings/) (the L9H8 writer head and the late-layer MLP suppressors), so it's the benchmark I need to read closely…"
- **Line 70** — dash-substitute colon (ungrammatical) — *clear*
  - Quote: "early channels transport relation-frame content while late attention transports subject-retrieval content: refining at head granularity down to the known **L9H8** head."
  - Fix: "…while late attention transports subject-retrieval content, refining at head granularity down to the known **L9H8** head." (The first colon on line 69, "routing split: early channels…", is a legitimate explanatory colon.)
- **Line 86** — dash-substitute colon — *clear*
  - Quote: "…shows how to trace, step by step, the computation a model actually performs on a given prompt: then validate those circuits with intervention experiments."
  - Fix: "…the computation a model actually performs on a given prompt, then validate those circuits with intervention experiments."
- **Lines 90–91** — Frankensentence ("not just X but Y") + editorializing casual quotes — *clear*
  - Quote: "it's the closest thing to a practical, reproducible recipe for mechanistic interpretability at frontier scale: not just \"features exist\" but \"here is the wiring diagram for this behaviour, and here's how we checked it.\""
  - Fix: "it's the closest thing to a practical, reproducible recipe for mechanistic interpretability at frontier scale. It goes beyond identifying features to producing the wiring diagram for a specific behaviour, with intervention experiments to check it."
- **Line 28** — mechanical triplet — *borderline*
  - Quote: "the gap widens with depth, width, and the removal of regularization."
  - Fix (if the three factors are the paper's own list, leave it): "the gap widens with depth and width, and with the removal of regularization."
- **Line 119** — mechanical triplet — *borderline*
  - Quote: "it's the map for turning the methods above into actual practice: what to learn, in what order, and when to stop reading and start running experiments."
  - Fix: "it's the map for turning the methods above into actual practice: what to learn in what order, and when to stop reading and start running experiments."

## _papers/the-bs-meter.md

- **Line 23** — jargon without unpacking — *borderline*
  - Quote: "the pre-training phase, in which the system absorbs multiple language-games" ("language-games" recurs on lines 26–27 and 55–56, never glossed).
  - Fix: gloss on first use: "absorbs multiple language-games (Wittgenstein's term for the distinct, rule-governed ways language is used in different practices)".
- **Line 41** — jargon without unpacking (+ redundancy) — *clear*
  - Quote: "From these, they derive a metric, the MSD metric."
  - Fix: "From these confidences they derive a single score, the MSD metric", plus a one-phrase expansion of what MSD stands for, taken from the paper.
- **Line 52** — colloquial intensifier — *clear*
  - Quote: "Two OOD texts can have a score of 49 for totally different reasons."
  - Fix: "Two OOD texts can have a score of 49 for unrelated reasons."
- **Line 54** — colloquial intensifier / performed emphasis — *borderline*
  - Quote: "And even the fact that the axis is that of \"bullshit\" is pure interpretative arbitrariness."
  - Fix: "And labeling that axis \"bullshit\" is an interpretative choice, not something the data establishes."
- **Line 59** — dash-substitute commas producing a garden-path sentence (+ triplet) — *clear*
  - Quote: "everything else, the name BS-meter, the paper's title, the general framing, seems to promise results that are not there."
  - Fix: "everything else (the name BS-meter, the paper's title, the general framing) seems to promise results that are not there." Or, breaking the triplet: "everything else, from the name BS-meter to the general framing, promises results that are not there."
- **Line 67** — dash-substitute punctuation (bare hyphens creating false compounds) — *clear*
  - Quote: "so it would label any out-of-distribution input-including my face-as a type of bear."
  - Fix: "so it would label any out-of-distribution input, including my face, as a type of bear."

Checked and judged compliant: "It might not be detecting \"bullshit\" so much as a superficial \"ChatGPT style.\"" (line 65) is a substantive contrast using the paper's own terms, not the banned scaffolding; the foregrounded criticism throughout is what the guide asks for.

## _papers/toread.md

- **Line 3** — ungrammatical colon + typo ("seams") — *borderline* (reads as a private scratch jotting, no front matter; would presumably be rewritten before publication)
  - Quote: "it seams to me like: a guy is autistic and a company offers to his family to translate the sounds he produces."
  - Fix: "It seems to me like a guy is autistic and a company offers his family to translate the sounds he produces."

## _talks/biology-of-an-llm.md

Talk notes: conversational first-person, fragments, and bolding are correct here; findings below are "Don't"-rule violations only.

- **Line 37** — dash-substitute colons (three in one sentence, ungrammatical) — *clear*
  - Quote: "Models do remarkable things: his example: in-context learning beating years of bespoke NLP for Circassian, a low-resource language, just by stuffing a translation list into the context *(~00:02:49–00:03:59)*: but also fail bizarrely…"
  - Fix: "Models do remarkable things (his example: in-context learning beating years of bespoke NLP for Circassian, a low-resource language, just by stuffing a translation list into the context *(~00:02:49–00:03:59)*), but they also fail bizarrely…"
- **Line 37** — dash-substitute colon + aphoristic punch clause — *clear*
  - Quote: "…the weirdness has simply migrated to the edges of capability where you've stopped checking: precisely the regime where you've delegated trust and can no longer verify"
  - Fix: "…the weirdness has simply migrated to the edges of capability where you've stopped checking, which is precisely the regime where you've delegated trust and can no longer verify"
- **Line 55** — dash-substitute comma splice — *clear*
  - Quote: "After trying to be clever, the bitter lesson won *(~00:28:10, restated ~00:82)*, a one-layer sparse autoencoder trained at scale beat sophisticated approaches."
  - Fix: "After trying to be clever, the bitter lesson won *(~00:28:10, restated ~00:82)*: a one-layer sparse autoencoder trained at scale beat the sophisticated approaches." (Explanatory colon, legitimate.)
- **Line 67** — dash-substitute colon (ungrammatical) — *clear*
  - Quote: "there's no reason a unit of computation lives in a single layer: layer order can be swapped without much damage *(~00:23:15–00:23:30)*: so a bigram-style operation propagated across many layers can be folded into one feature instead of dozens."
  - Fix: "there's no reason a unit of computation lives in a single layer (layer order can be swapped without much damage *(~00:23:15–00:23:30)*), so a bigram-style operation propagated across many layers can be folded into one feature instead of dozens."
- **Line 74** — dash-substitute comma splice — *borderline* (fragments are tolerable in notes; the splice still reads as a replaced dash)
  - Quote: "A feature is a static snapshot, it says *Texas is active here*, not how the model got there or where it's heading…"
  - Fix: "A feature is a static snapshot: it says *Texas is active here*, not how the model got there or where it's heading…"
- **Line 76** — dash-substitute colons used as parentheses (ungrammatical) — *clear*
  - Quote: "A cross-layer transcoder: DenseNet-like, reading and writing across layers at once: folds those fragments back into one clean feature, which is what makes the graphs legible."
  - Fix: "A cross-layer transcoder (DenseNet-like, reading and writing across layers at once) folds those fragments back into one clean feature, which is what makes the graphs legible."
- **Line 84** — dash-substitute colon before "and" (ungrammatical) — *clear*
  - Quote: "…starts near zero (tokenizations share nothing), rises sharply through the middle, and falls at output: and the effect *grows with scale* (larger overlap in production Haiku than in the 18-layer model)…"
  - Fix: "…rises sharply through the middle, and falls at output, and the effect *grows with scale*…" (or start a new sentence: "…falls at output. The effect *grows with scale*…")
- **Line 90** — dash-substitute comma pile-up — *borderline*
  - Quote: "A second stream tracks magnitude, and it does so at more than one resolution, a wide band that knows the answer is roughly in the nineties, a narrower band that tightens that, converging on a median estimate."
  - Fix: "A second stream tracks magnitude at more than one resolution: a wide band that knows the answer is roughly in the nineties, and a narrower band that tightens that, converging on a median estimate."
- **Line 94** — colloquial intensifier — *clear*
  - Quote: "but a unit of computation pulled into wildly different contexts because each of them, underneath, needs the same sum."
  - Fix: "but a unit of computation pulled into unrelated contexts because each of them, underneath, needs the same sum."
- **Line 98** — dash-substitute comma splice — *borderline*
  - Quote: "Reflection helps, asking \"are you sure?\" feeds both entity and paper back as input, letting the computation redo itself…"
  - Fix: "Reflection helps: asking \"are you sure?\" feeds both entity and paper back as input, letting the computation redo itself…"

Out-of-scope technical note: the timestamp "*(~00:28:10, restated ~00:82)*" on line 55 looks malformed ("~00:82" is not a valid timestamp).

## _talks/twigs.md

Draft (`published: false`). The "Draft notes" section (lines 20–44: raw URLs, the `//`-separated table, and the duplicated intro at lines 25–27) is scratch material, not reviewed as prose; noted here only so it isn't published as-is.

- **Line 92** — colon-cadence punchline — *clear*
  - Quote: "Earlier work that used multiple diffusion flows gave every flow the same role: Twigs does not."
  - Fix: "Earlier work that used multiple diffusion flows gave every flow the same role; Twigs does not." (Semicolon form matches the guide's own ✓ example.)
- **Lines 105–109** — dash-substitute comma splice — *clear*
  - Quote: "It was not universally best, for one protein target an older method edged it out, but it won most of the comparisons."
  - Fix: "It was not universally best (for one protein target an older method edged it out), but it won most of the comparisons."
- **Lines 113–115** — dash-substitute colon before "though" (ungrammatical) — *clear*
  - Quote: "so more properties mean more computation and longer training: though they show the added time is modest."
  - Fix: "so more properties mean more computation and longer training, though they show the added time is modest."
- **Lines 124–126** — dash-substitute punctuation (spaced hyphen opening, colon closing, ungrammatical) — *clear*
  - Quote: "Loop guidance is a small architectural change with a clear intuition - denoise structure, use it to denoise properties, feed those back: and it's the part that pays off for inverse molecular design…"
  - Fix: "Loop guidance is a small architectural change with a clear intuition (denoise structure, use it to denoise properties, feed those back), and it's the part that pays off for inverse molecular design…"
- **Line 49** — colloquial intensifier — *borderline*
  - Quote: "There are astronomically many possible molecules, so searching through them is hopeless."
  - Fix: "There are more candidate molecules than any search could enumerate, so searching through them is hopeless." (Or leave: "astronomically many" is close to standard scientific usage.)

## _talks/yann-lecun-world-models-eth.md

- **Lines 14–15** — colon-cadence punchline — *borderline*
  - Quote: "The through-line is blunt: current LLMs are a dead end for human-level AI."
  - Fix: "LeCun's through-line is that current LLMs are a dead end for human-level AI."
- **Lines 29–31** — dash-substitute colon before "and" (ungrammatical) — *clear*
  - Quote: "It's *the ability to handle new situations with little or no prior training*: and it should be measured by **speed of learning**, not by performance on any single benchmark."
  - Fix: "It's *the ability to handle new situations with little or no prior training*, and it should be measured by **speed of learning**, not by performance on any single benchmark."
- **Lines 52–53** — altered quotation (dash inside the speaker's line replaced with a colon) — *borderline*
  - Quote: "*\"This is how LLM-based agentic systems (VLA) work: or don't.\"*"
  - Fix: quotations are exempt from the em-dash ban and must be verbatim; restore the original punctuation of the slide/quip (likely "work — or don't.").
- **Lines 67–69** — dash-substitute colon — *borderline*
  - Quote: "Actions are **optimized** to minimize the task cost: applied auto-regressively *in representation space*, explicitly **akin to Model Predictive Control (MPC)**."
  - Fix: "Actions are **optimized** to minimize the task cost, applied auto-regressively *in representation space*, explicitly **akin to Model Predictive Control (MPC)**."

Checked and judged compliant: block quotes of LeCun's lines are source voice, exempt; "Intelligence is **not** an accumulation… It's *the ability…*" is a substantive contrast summarizing the speaker's claim, not the banned "It's not just X, it's Y" scaffolding; list fragments and bolding are correct talk-notes style.

## _writing/basic.md

Draft (`published: false`).

- **Lines 23–25** — dash-substitute punctuation (spaced hyphen opening, colon closing, ungrammatical) — *clear*
  - Quote: "by representing model parameters with low-precision data - like 8-bit integer (`int8`): instead of the usual 32-bit floating point (`float32`)."
  - Fix: "by representing model parameters with low-precision data, like 8-bit integers (`int8`), instead of the usual 32-bit floating point (`float32`)."
- **Lines 57–59** — dash-substitute colon — *clear*
  - Quote: "so the maximum finite float32 is about **3.4 × 10³⁸**: vastly larger than 2³²."
  - Fix: "so the maximum finite float32 is about **3.4 × 10³⁸**, vastly larger than 2³²."
- **File-level tone** — *borderline*: `layout: article` but the piece has no first person or point of view anywhere; it reads as reference documentation. Per the guide's document-type rule that is fine for a reference page but wrong for an article. Either switch to `layout: reference` (as `transformers.md` does) or add the narrative voice.

## _writing/dante-lemma-bm25-routing.md

- **Line 28** — aphoristic punch-line / performed maxim — *clear*
  - Quote: "However, a fundamental principle of applied ML and of life in general is to **never fall in love with an easy narrative**."
  - Fix: "The aggregate numbers suggest an easy narrative; the decomposition below shows it is wrong." (The maxim is also in the front-matter summary and echoed at line 276; one plain statement of the finding carries it better than a life lesson.)
- **Line 27** — performed cleverness / hype adjectives — *borderline*
  - Quote: "the data provides a highly satisfying answer. It suggests that lemmatization is the clear winner because it elegantly translates Dante's complex, archaic verb conjugations…"
  - Fix: "the data suggests lemmatization is the clear winner: it maps Dante's archaic verb conjugations onto the forms a modern user types."
- **Line 36** — dramatized framing — *borderline*
  - Quote: "why trusting an intuitive story is dangerous."
  - Fix: "why the intuitive story does not survive decomposition."
- **Dash-substitute punctuation** (several, all *clear*):
  - Lines 131–132: "…realigns the user's modern inflections with the text's original forms: though *which* inflections do the work turns out to be mostly grammatical…" → "…original forms, though *which* inflections do the work…"
  - Lines 228–229: "a flawless, offline classifier to determine the query type-a tool that does not actually exist at runtime" → "…the query type, a tool that does not actually exist at runtime"
  - Line 267: "legitimate: but it is *shallow*, and it turns out to carry most of the measured gap" → "legitimate, but it is *shallow*…"
  - Lines 311–312: "making the two sides *symmetric*: splitting contractions in the query too, so `nel` → `in` + `il` on both sides: should recover lost recall" → "making the two sides *symmetric* (splitting contractions in the query too, so `nel` → `in` + `il` on both sides) should recover lost recall"
  - Line 323: "restoring the split changes 27 rankings: but 17 get *worse* and only 10 get better" → "…changes 27 rankings, but 17 get *worse*…"
  - Line 346: "(`dicea` ↔ `disse` → `dire`): and, as Appendix B shows…" → "(`dicea` ↔ `disse` → `dire`), and, as Appendix B shows…"
  - Lines 360–362: "not noise it ignores: but in a close ranking race even a small, down-weighted grammatical match can dictate the winner" → "…not noise it ignores; but in a close ranking race…"
- **Line 188** — editorializing aside / intensifier — *borderline*
  - Quote: "This removes a query's \"self-vote\", quite dangerous in a study like this where several query buckets are extremely small…"
  - Fix: "This removes a query's \"self-vote\", which matters here because several query buckets are very small…"
- **Lines 205–208** — hype verbs ("clearly see", "prove", "successfully recovers") — *borderline*
  - Quote: "we can clearly see a maximum \"headroom\" of 0.030. We use this theoretical yardstick to prove that our deployable router (0.526) successfully recovers about a third of the total possible improvement."
  - Fix: "the maximum headroom is 0.030. Against that yardstick, the deployable router (0.526) recovers about a third of the possible improvement."
- **File-level tone** — *clear* (per the document-type rule): an article written largely in impersonal/passive report voice ("Testing was conducted over the Inferno", "Two standard fusion methods were tested", "we identify stopwords…"). The guide's default for articles is first-person narrative; either convert the voice to "I" or accept it as a spec-style document and drop the narrative flourishes (currently it mixes both registers).
- **Line 260** — decorative metaphor — *borderline*
  - Quote: "the surface index is essentially playing on an easier difficulty setting for those searches."
  - Fix: it does clarify, so keeping it is defensible; a plain alternative: "the surface index is being scored on an easier task for those searches."

Out-of-scope technical notes: line 86 "Here the complete table of the results:" is missing "is"; lines 105–107 "…and consequently user queries ruined by broadening the results…" is garbled; line 119's table row ends in the mangled cell `|: |`; lines 273–276 break one sentence across a paragraph boundary into a bolded fragment ("However, / **it proves that…**").

## _writing/dante-retrieval-reality-gap.md

- **File-level tone** — *borderline*: the calibration note warns against the dry, listy failure mode, and this piece sits close to it. Long runs of uniform clipped declaratives ("The system addresses two query types. … I measure Recall@1, Recall@5, and MRR@10.") read as a lab report; the guide's target is a person explaining their work. The content (negative results foregrounded, concrete numbers) is exactly right; the cadence could use variation, per "Roughen the Cadence".
- **Line 81 (figcaption)** — dash-substitute colon — *borderline*
  - Quote: "moves dense R@1 by +0.006 on average: negligible and mixed."
  - Fix: "moves dense R@1 by +0.006 on average, negligible and mixed."

Otherwise clean: no em dashes, no stock openers, no punch-lines found.

## _writing/kaggle-lab.md

- **Lines 58–60** — dash-substitute colons used as parentheses (ungrammatical) — *clear*
  - Quote: "the canonical state: what the tooling shows after collapsing to the latest record per run: shows the correction."
  - Fix: "the canonical state (what the tooling shows after collapsing to the latest record per run) shows the correction."
- **Lines 117–119** — dash-substitute colon before "and" — *clear*
  - Quote: "the CV score is noisy: it shifts with how the rows land in folds, not just with the model: and local CV disagreed with the leaderboard more than once."
  - Fix: "the CV score is noisy (it shifts with how the rows land in folds, not just with the model), and local CV disagreed with the leaderboard more than once."
- **Lines 127–129** — dash-substitute colon (ungrammatical) — *clear*
  - Quote: "…and records the score that change produced: most of what an agent would need to run the search itself: read the tree, propose the next change…"
  - Fix: "…and records the score that change produced. That is most of what an agent would need to run the search itself: read the tree, propose the next change…" (the second colon legitimately introduces the list).
- **Line 136** — dash-substitute punctuation (spaced hyphen) — *clear*
  - Quote: "a model registry to serve a chosen submission by version - the loop I built separately on an [MNIST project](/writing/mnist-mlflow/)."
  - Fix: "…by version, the loop I built separately on an [MNIST project](/writing/mnist-mlflow/)."
- **Line 13** — scare quotes — *borderline*
  - Quote: "whether an idea I'd 'tried' had actually been submitted or just thought about."
  - Fix: acceptable as is (the quotes carry the point); plainer: "whether an idea had actually been submitted or only considered."

## _writing/mnist-calibration.md

- **Line 17** — dash-substitute punctuation (spaced hyphen) — *clear*
  - Quote: "here I focus on the other 1% - the test digits the model still gets wrong, and what they have in common."
  - Fix: "here I focus on the other 1%: the test digits the model still gets wrong, and what they have in common."
- **Line 26 (figcaption)** — dash-substitute colon before "and" — *clear*
  - Quote: "nearly all predictions pile into the top confidence bin: and there they're right."
  - Fix: "nearly all predictions pile into the top confidence bin, and there they're right."
- **Lines 56–57** — colon-cadence punchline — *borderline*
  - Quote: "**The classes are cleanly separated.** Ten well-separated clusters: the geometric reason the model is confident almost everywhere."
  - Fix: "Ten well-separated clusters are the geometric reason the model is confident almost everywhere."
- **Line 66 (figcaption)** — aphoristic flourish — *borderline*
  - Quote: "the complexity ladder made geometric."
  - Fix: "the same projection across the three model classes."
- **Lines 171–174** — aphoristic closer with triplet cadence — *borderline*
  - Quote: "Same complexity ladder, one calibration curve, and two ways to see what each model learned."
  - Fix: "The geometry and the calibration table describe the same progression up the ladder."

Out-of-scope note: the commented-out block at lines 87–145 contains several banned patterns ("So it's not just \"errors at the edges\"…", the simile "like a charge drifting to the opposite pole", "The metaphor survives the check."). Harmless while commented, but it should be cleaned before ever being re-enabled.

## _writing/mnist-mlflow.md

- **Line 32** — dash-substitute punctuation (spaced hyphen) — *clear*
  - Quote: "**system design with MLflow + Optuna** - tracking, hyperparameter search, the model registry, and the artifacts each run produces."
  - Fix: "**system design with MLflow + Optuna**: tracking, hyperparameter search, the model registry, and the artifacts each run produces." (colon introducing a list is legitimate).
- **Line 93 (figcaption)** — dash-substitute colon before "but" — *clear*
  - Quote: "Optuna's fANOVA importance: but with only 4 completed trials it's noisy: here <code>dropout</code> and <code>conv_channels</code> tie…"
  - Fix: "Optuna's fANOVA importance. With only 4 completed trials it's noisy: here <code>dropout</code> and <code>conv_channels</code> tie…"
- **Lines 119–121** — dash-substitute colons used as parentheses (ungrammatical) — *clear*
  - Quote: "the best model by test accuracy: the `conv_net`, at **~98.9%** with an ECE of **0.0023**: is registered as `mnist-classifier`…"
  - Fix: "the best model by test accuracy (the `conv_net`, at **~98.9%** with an ECE of **0.0023**) is registered as `mnist-classifier`…"
- **Line 148** — dash-substitute colon before "but" — *clear*
  - Quote: "**Search matters**: but importances need many trials before you can trust them."
  - Fix: "**Search matters**, but importances need many trials before you can trust them."
- **Line 161** — light anthropomorphism — *borderline*
  - Quote: "it will happily call a drawing of a flower a \"9\" with 53% confidence."
  - Fix: acceptable in this voice; plainer: "it will call a drawing of a flower a \"9\" with 53% confidence."

## _writing/ood-detection.md

This is the piece the guide's own ✓ examples come from, and most of it complies. The findings are almost all punctuation left over from the dash removal.

- **Line 12** — dash-substitute colon before "and" — *clear*
  - Quote: "…bolted onto the [bear detector](…) I deployed as a Hugging Face Space: and the negative result that turned out to be the interesting part."
  - Fix: "…deployed as a Hugging Face Space, and the negative result that turned out to be the interesting part."
- **Lines 18–20** — dash-substitute colons used as parentheses — *clear*
  - Quote: "I built mine in pure PyTorch: a ResNet-18 with a hard-coded softmax over **black**, **grizzly** and **teddy** bears: and deployed it on a Hugging Face Space with Gradio."
  - Fix: "I built mine in pure PyTorch (a ResNet-18 with a hard-coded softmax over **black**, **grizzly** and **teddy** bears) and deployed it on a Hugging Face Space with Gradio."
- **Line 26** — mechanical triplet — *borderline*
  - Quote: "Show it a cat, a car, my face: it picks a bear, and it does so confidently."
  - Fix: "Show it a cat or my face: it picks a bear, confidently."
- **Lines 58–61** — dash-substitute colon (third colon, ungrammatical) — *clear*
  - Quote: "The plan: reproduce an experiment in the spirit of Hendrycks & Gimpel §3: measure how well the model's own confidence separates real bears from non-bears: and then try to beat it with something stronger."
  - Fix: "The plan: reproduce an experiment in the spirit of Hendrycks & Gimpel §3 (measure how well the model's own confidence separates real bears from non-bears), then try to beat it with something stronger."
- **Lines 108–110** — dash-substitute colon before "and" — *clear*
  - Quote: "On held-out bears the network is, on average, 95% confident: and these are the *easy* in-distribution cases."
  - Fix: "…95% confident, and these are the *easy* in-distribution cases."
- **Line 146** — dash-substitute colon (and an echo of the banned "A relief, and a sanity check, in that order") — *clear*
  - Quote: "Good: and a sanity check that the pipeline works."
  - Fix: "Good, and a sanity check that the pipeline works."
- **Line 148** — dash-substitute colon + hyperbole — *clear*
  - Quote: "**2. Near-OOD breaks everything: and MSP, the plain baseline, beats energy.**"
  - Fix: "**2. Near-OOD is where it falls apart, and MSP, the plain baseline, beats energy.**"
- **Lines 153–155** — dash-substitute punctuation (spaced hyphen opening, colon closing) — *clear*
  - Quote: "Energy's advantage on the big benchmarks - ImageNet-scale models, hundreds of classes: does **not** survive the trip down to a tiny 3-class head…"
  - Fix: "Energy's advantage on the big benchmarks (ImageNet-scale models, hundreds of classes) does **not** survive the trip down to a tiny 3-class head…"
- **Lines 157–159** — dash-substitute colon before "and" — *clear*
  - Quote: "On near-OOD inputs those logits are already fooled: the cat genuinely activates the bear channels: and no formula over them can recover a distinction the network never learned."
  - Fix: "On near-OOD inputs those logits are already fooled (the cat genuinely activates the bear channels), and no formula over them can recover a distinction the network never learned."
- **Line 206** — "this is the case I care about" meta-statement — *clear* (the guide bans exactly this construction)
  - Quote: "On **near-OOD**, the case I actually cared about, it's weak…"
  - Fix: "On **near-OOD**, where the detector actually has to work, it's weak…"

Note: the front-matter summary carries the same dash-substitute pattern ("Near-OOD was hard: and the fancy energy score lost to the plain baseline"), and it is rendered on the site.

## _writing/progress-dashboard-tests.md

- **Lines 127–129** — dash-substitute punctuation (spaced hyphen opening, colon closing) — *clear*
  - Quote: "…make me pin down each metric far more precisely than reading the page would - what counts as mastered, which window retention uses, how the curve buckets: and working out that bucketing exactly is what surfaced the bug hiding in it."
  - Fix: "…far more precisely than reading the page would (what counts as mastered, which window retention uses, how the curve buckets), and working out that bucketing exactly is what surfaced the bug hiding in it."
- **Line 145 (figcaption)** — dash-substitute colon before "so" — *clear*
  - Quote: "entering below the screen: so a change in what the screen passes would slip past them."
  - Fix: "entering below the screen, so a change in what the screen passes would slip past them."
- **Line 152** — dash-substitute colons used as parentheses — *clear*
  - Quote: "The scenario plan: the students, cards, and graded reviews: is what factory_boy and Faker generate…"
  - Fix: "The scenario plan (the students, cards, and graded reviews) is what factory_boy and Faker generate…"

## _writing/replicating-gpt2-block.md

No style violations. The piece is a code walkthrough in a neutral instructional voice, which fits it. Out-of-scope grammar nits: line 127 "the *contributions*, that include the nonlinearities" should be "which include"; line 15 "doing mechanistic-interpretability" has a stray hyphen.

## _writing/structure-vs-recall-findings.md

- **Unspaced-hyphen dash substitutes** (creating false compounds) — *clear*:
  - Line 76: "…\"The capital of France, Paris, is…\"-an intuition that is confirmed by our frame-sensitivity experiments below." → "…, an intuition the frame-sensitivity experiments below confirm."
  - Line 83: "a \"generic mass\" of continuation words (`·now`, `·a`, `·the`)-a suppression that persists across larger model scales" → "…(`·now`, `·a`, `·the`), a suppression that persists…"
  - Line 288: "the model retains the latent fact-with ·Paris explicitly present in the distribution-but it is heavily penalized." → "the model retains the latent fact (·Paris is explicitly present in the distribution), but it is heavily penalized."
  - Line 322: "late attention transports subject-retrieval content-specifically refining at the head granularity to the known L9H8 head." → "…subject-retrieval content, refining at head granularity to the known L9H8 head."
- **Dash-substitute colons** — *clear*:
  - Line 118: "it **never wins the argmax**: not even at 1.5B:" → "it **never wins the argmax**, not even at 1.5B:"
  - Line 132: "but loses to `·a`: so for France, `·Paris` is *never* the argmax" → "but loses to `·a`, so for France…"
  - Line 261: "A quick causal probe: not a full analysis, just a reference for future work: if these capital/city features are what carries the factual answer…" → "A quick causal probe (not a full analysis, just a reference for future work): if these capital/city features…"
- **Lines 256–257 and 303** — dramatized anthropomorphism / intensifier — *clear*
  - Quote: "they violently inject the mathematical representation of `·Paris` into the residual stream, spiking its probability to near 100%." (twice, body and conclusion)
  - Fix: "they inject the representation of `·Paris` into the residual stream, spiking its probability to near 100%."
- **Lines 306–309** — performed conclusion (battle metaphor, "stubbornly", "empower", "definitive") — *borderline*
  - Quote: "whether that knowledge surfaces depends entirely on an internal routing battle: default late-layer circuits will stubbornly prioritize generic grammar, whereas strong syntactic frames or in-context few-shot patterns empower early and mid-layer circuits to execute a definitive factual overwrite."
  - Fix: "whether that knowledge surfaces depends on internal routing: by default the late-layer circuits prioritize generic grammar; strong syntactic frames or few-shot patterns let early and mid-layer circuits overwrite that with the fact."
- **Line 232** — metaphor + filler-formal verb — *borderline*
  - Quote: "the network operates differently, utilizing an assembly line to bypass the suppressors" (echoed as "The Few-Shot Assembly Line" at line 296).
  - Fix: "the network operates differently, running a multi-step circuit that bypasses the suppressors." ("Assembly line" as a named motif is defensible; "utilizing" is not: "using".)
- **Line 289** — dramatizing adjective — *borderline*
  - Quote: "Late-layer MLPs and unembed biases act as aggressive suppressors…"
  - Fix: "Late-layer MLPs and unembed biases act as strong suppressors…"

Out-of-scope: line 76 "It appears to me the comma like setting up the phrase" is garbled grammar.

## _writing/structure-vs-recall-gpt2.md

Draft (`published: false`). This file has the densest concentration of dash-substitute colons in the repo, plus the most heavily performed closing paragraph.

- **Dash-substitute colons** — *clear*; the recurring fix is parentheses, a comma, or a new sentence:
  - Lines 49–51: "Its value, I think, lies less in the subject or the answers: the field is by now saturated with similar and better explorations: than in the introduction to mechanistic interpretability it gave me." → "Its value, I think, lies less in the subject or the answers (the field is by now saturated with similar and better explorations) than in the introduction to mechanistic interpretability it gave me."
  - Lines 133–134: "lift `·Paris` to the top along a clean monotone curve: which would separate…" → "…along a clean monotone curve, which would separate…"
  - Line 142: "forces a predicate-nominative slot: and that slot is exactly where the generic continuation wins." → "…slot, and that slot is exactly where the generic continuation wins."
  - Lines 145–146: "Recall here is *frame-sensitive*: and this is the sharpest of the bets…" → "Recall here is *frame-sensitive*, and this is the sharpest of the bets…"
  - Lines 160–161: "…the causal check in §5 and the feature-level analysis in §6: and are introduced where they appear." → "…the feature-level analysis in §6, and are introduced where they appear."
  - Line 195 and 209: same two findings as the published synthesis (see `structure-vs-recall-findings.md` lines 118 and 132).
  - Lines 336–337: "the writer is a single attention head: L9H8, contributing +1.81…, more than three times the next component: not the mid-layer MLPs…" → "the writer is a single attention head, L9H8 (+1.81 to the `·Paris` − `·now` logit, more than three times the next component), not the mid-layer MLPs…"
  - Line 420 (four instances in one paragraph): "the two frames are a minimal pair: an assert confirms they differ *only* in the final token: and patching…"; "exactly its DLA write, the 0.002 gap being the final-LayerNorm nonlinearity: and collapses…"; "routed … suppressive (−1.12)**, cancelling more than half of its own +1.80 direct write: which is why…"; "the §6 generic mass, now confirmed at the component level by an independent method: while a single head writes it." → restructure each with parentheses or a period.
  - Line 445: "…applied to a factual-recall target instead of a narrative one: and it would let the three-regime taxonomy…" → "…instead of a narrative one, and it would let…"
  - Line 516: the bolded lead "**Complicated: capacity helps: unevenly: and France is an outlier.**" plus three more in the body ("non-monotonically**: `gpt2-large` is a real regression: and", "is soft in the training distribution: while for most subjects…") → "**Complicated: capacity helps, unevenly, and France is an outlier.**" etc.
  - Line 520: "That is the more interesting half: and, by the lights of the Perse passage…" → see the closing-paragraph finding below.
- **Spaced-hyphen dash substitutes** — *clear*:
  - Lines 313–314: "**L9H8, writes +1.81** to the `·Paris` − `·now` logit - more than three times the next component." → "…logit, more than three times the next component."
  - Lines 341–342: "…it confirms L9H8 directly - while showing that L9H8's own output is then routed *suppressively*." → "…confirms L9H8 directly, while showing that its own output is then routed *suppressively*."
- **Line 280** — value-narration / announcing interest instead of showing — *clear*
  - Quote: "Comparing the two lenses and looking at where they disagree is quite interesting."
  - Fix: delete the sentence and lead with the disagreement: "The two lenses disagree at the final stage, the only one with a known answer: the raw logit lens gives 92…"
- **Lines 386–388** — decorative metaphor + missing subject — *borderline*
  - Quote: "…with a non-Paris control alongside: confirms the causal direction and then springs a trap."
  - Fix: "…with a non-Paris control alongside. The control confirms the causal direction and then exposes a confound."
- **Line 436** — aphoristic punch-line — *borderline*
  - Quote: "The single distributed suppressor the SAE pass alone suggested was the obvious-but-wrong channel: the kind of miss this whole piece is about."
  - Fix: "The single distributed suppressor the SAE pass alone suggested was the obvious-but-wrong channel."
- **Lines 445 and 493** — jargon / dangling references from another project — *clear*
  - Quotes: "the same move as causal suppression of the `whales` feature in the Moby-Dick narrator task"; "a knowledge graph used the way the Céline graph anchors the literary work".
  - Fix: neither the Moby-Dick narrator task nor the Céline graph is introduced anywhere in this article; add a one-clause gloss with a link, or cut the comparisons.
- **Line 520** — closing paragraph, multiple violations (drumroll fragment, obscure allusion, aphoristic punchline) — *clear*
  - Quote: "With that owed, the headline. It is not \"small models can't recall\"; it is that in this frame, at every scale, a structural-continuation prior outranks a present-but-soft factual signal… That is the more interesting half: and, by the lights of the Perse passage, the one still closest to its own lamasery: a clean sentence is exactly the kind of thing that turns out to have a less flattering explanation waiting."
  - Fix: keep the substantive middle, drop the staging and the unexplained Perse/lamasery allusion: "The headline is not \"small models can't recall\". In this frame, at every scale, a structural-continuation prior outranks a present-but-soft factual signal, and the softness is as much in the data as in the model."
- **Lines 26–32** — performed rhetorical-question chain — *borderline*
  - Quote: "Maybe Paris simply isn't there. But can it really be that GPT-2 small, small as it is, holds no notion of Paris at all? … the story of a name resting just below the surface and never popping up as argmax, or the story of a name buried thousands of tokens down…"
  - Fix: one question is fine; the twin "story of…" framing is the performance. "More likely the model holds a notion of Paris and the signal is too weak to beat the form. How weak is the first thing to measure: a name just below the surface, or one buried thousands of ranks down, is what decides the explanation."

Out-of-scope: duplicated heading "## The mechanistic picture" (lines 114–115); §3.1 repeats its opening sentence twice (lines 243–246); the bracketed editor note at lines 40–44 is draft scratch; line 334 says "In §6 we talked about a \"generic mass\"" but §6 comes later in the document; line 46 "investigate the questions thoroughly and answer it plainly" has a number mismatch.

## _writing/transformers.md

`layout: reference`, so the neutral, second-person-free register is correct; the findings are almost entirely dash-removal residue.

- **Dash-substitute colons** — *clear*; same fix pattern (parentheses, comma, or period):
  - Line 110: "…masked self-attention, then cross-attention reading the encoder output, then the MLP: whereas a GPT-2 block has only masked self-attention + MLP." → "…then the MLP, whereas a GPT-2 block…"
  - Lines 210–215 (two): "All three are the same kind of object: a learned linear projection of the same residual stream: but they play different parts." → "All three are the same kind of object, a learned linear projection of the same residual stream, but they play different parts."; "…because $$W_Q$$ and $$W_K$$ are built alike: but they are not; why is §5.1." → "…built alike, but they are not; why is §5.1."
  - Lines 260–261: "position 0 has nothing else to attend to: so row 0 is forced to $$1.0$$ on the diagonal." → "…nothing else to attend to, so row 0 is forced to $$1.0$$…"
  - Lines 389–391: "the skip connection is an *unnormalized identity* running from the embeddings to the final LN: the clean residual stream of §3.3 / §5: so the LN sits *inside* each branch…" → "…to the final LN (the clean residual stream of §3.3 / §5), so the LN sits *inside* each branch…"
  - Line 414: "with no leakage from the future: so every position is simultaneously a valid next-token problem." → "…from the future, so every position…"
  - Lines 421–422: "**At inference time, only the last position matters: and good implementations don't compute the rest:**" → "**At inference time only the last position matters, and good implementations don't compute the rest:**"
  - Line 426: "…attends to them as **keys and values**: but the **vocab/logit projection** is applied **only to the last position**." → "…as **keys and values**, but the **vocab/logit projection**…"
  - Lines 439–440: "the stream is a *linear* sum of contributions: which is what makes terms attributable to specific heads/MLPs" → "…sum of contributions, which is what makes terms attributable…"
  - Lines 463–465: "$$Q$$ and $$K$$ are symmetric only in *construction*: same kind of projection, same shape: not in *role*." → "…symmetric only in *construction* (same kind of projection, same shape), not in *role*."
  - Lines 469–471: "…the **source** through $$W_K$$ (\"what do I advertise\"): and the softmax normalizes over keys *for a fixed query*: one asker, many candidates competing." → "…(\"what do I advertise\"), and the softmax normalizes over keys for a fixed query: one asker, many candidates competing." (the final fragment is a *borderline* mini-punchline; plain alternative: "…a single query scored against many candidate keys.")
  - Lines 484–485: "The parameters genuinely are separable: $$\{W_Q, W_K\}$$ vs $$\{W_V, W_O\}$$: so each circuit can be read off independently…" → "…separable ($$\{W_Q, W_K\}$$ vs $$\{W_V, W_O\}$$), so each circuit can be read off independently…"
- **Spaced-hyphen dash substitutes** — *clear*: line 87 ("(Head dim is 64 in both models above - $$768/12 = 512/8 = 64$$.)" → use a colon), line 189 ("each attributable to a specific head or MLP - the property §5 leans on" → comma), line 358 ("widening to $$d_{ff}$$ and back -" → colon), lines 402–403 ("the **unembedding** - giving logits;" → comma).

Out-of-scope (technical content damaged by the replacement, see the note at the top): line 56's blockquote attribution now reads ">:" and line 64's table cell reads "|: |"; both need their intended characters restored (e.g. "*Resolved in §4…*" as a normal line, and an empty or "n/a" cell).

---

## Summary

| directory | files | clear | borderline |
|---|---|---|---|
| _books | 1 | 1 | 3 |
| _courses | 1 | 0 | 3 |
| _papers | 5 | 11 | 7 |
| _talks | 3 | 12 | 6 |
| _writing | 12 | ~55 | 18 |

Three patterns account for most of the findings:

1. **Dash-substitute punctuation** (the large majority). Em dashes were removed mechanically, leaving colons before conjunctions ("…: and", "…: but", "…: so"), paired colons standing in for parenthetical dashes, and spaced or unspaced hyphens. Many of the resulting sentences are ungrammatical, and the replacement also corrupted two table cells, a blockquote line, and a speaker quote. The fix is the same everywhere: restructure with parentheses, a comma, a semicolon, or a new sentence, rather than swapping the character.
2. **Residual performance** in the interpretability pieces: "violently inject", the "routing battle" conclusion, the Perse/lamasery closing, the "never fall in love with an easy narrative" maxim. These are the "performing cleverness" and "aphoristic punch-line" bans.
3. **Tone/document-type mismatches**: `dante-lemma-bm25-routing.md` is an article in report voice, `dante-retrieval-reality-gap.md` sits close to the dry-report failure mode the calibration note warns about, and `basic.md` is an article with no voice at all (probably just mislabelled reference material).
