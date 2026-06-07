# Writing style guide

Instructions for an AI agent (e.g. a GPT) drafting or editing prose for this
site. Follow these when writing articles, project descriptions, talk notes, or
any published Markdown. The goal is writing that sounds like **me** — a person
thinking in public about ML work — not like an AI assistant.

## The voice in one line

First-person, opinionated, and plain. I have a point of view and I state it, but
I do not perform. Grounded over clever.

## Do

- **Write in the first person.** "I built mine in pure PyTorch." "This is the
  case I care about." Own the work and the opinions.
- **Have a point of view.** Say which result mattered, which approach you'd pick,
  what surprised you. A flat, neutral report is worse than an honest opinion.
- **Value honest and negative results.** If the fancy method lost to the
  baseline, lead with that. The surprising or humbling finding is usually the
  reason the piece is worth reading.
- **Keep a narrative spine**, but a grounded one: setup → what I tried → what
  actually happened → what I take from it.
- **Stay concrete.** Real numbers, real failure cases, real trade-offs. Show the
  table, show the leaked cat, show the threshold sweep.
- **Preserve all technical content exactly.** Never alter numbers, tables, code,
  figure paths, links, or references when editing for style. Only the prose moves.
- **Use an analogy only when it clarifies** something hard, and keep it plain.
  One quiet, useful comparison beats three decorative ones.

## Don't

- **Don't perform cleverness.** No costume/metaphor flourishes where a plain
  sentence works.
  - ✗ "Softmax is a costume, not a probability."
  - ✓ "Softmax isn't a probability — it's just a normalization."
- **Don't use stock rhetorical openers.** These are AI tells.
  - ✗ "Here's the uncomfortable truth the softmax hides."
  - ✗ "Sit with that number for a second."
  - ✓ State the point directly: "That MSP mean of 0.95 is the calibration problem
    made concrete."
- **Don't write aphoristic punch-lines** — the dramatic dependent clause or the
  "X, Y, in that order" cadence.
  - ✗ "Two OOD regimes, because difficulty isn't one number:"
  - ✓ "Two OOD regimes:"
  - ✗ "A relief, and a sanity check, in that order."
  - ✗ "It's not a bug — which is worse."
- **Don't over-anthropomorphize the model** for effect.
  - ✗ "It thought about it for a few milliseconds and announced…"
  - ✓ "It came back 'grizzly, 70% confident.'"
- **Don't pile up decorative metaphors** ("a thermometer that goes from lukewarm
  to lukewarm," "take it out behind the shed," "waltz in," "wearing a badge").
- **Don't lean on the em-dash for a dramatic reveal** at the end of every other
  sentence. Use it sparingly, for genuine asides.
- **Don't use throat-clearing or hype** ("It's worth noting that," "Importantly,"
  "In today's fast-paced world of ML," "game-changer," "powerful").

## Calibration note

The target is *plain first-person*, not *dry*. A dry, listy report is also wrong —
it needs more voice, not less. The failure mode to avoid on one side is flat and
neutral; on the other side is performative and over-written. Aim for the middle:
a knowledgeable person explaining their work plainly, with opinions.

## Editing checklist

When revising an existing piece, before finishing:

1. Every number, table, code block, figure, link, and reference is byte-for-byte
   unchanged.
2. No stock openers, no aphoristic punch-lines, no decorative metaphors.
3. The first-person point of view is present and the honest/surprising result is
   foregrounded.
4. Read it aloud — if a sentence sounds like it's performing, cut the performance
   and keep the point.
</content>
