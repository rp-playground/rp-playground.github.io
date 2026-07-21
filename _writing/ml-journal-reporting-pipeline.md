---
layout: article
title: "A Reporting Pipeline for an ML Journal"
subtitle: "Decision records as the source of truth, a slash command that turns a range of them into a published article, and a checker that tells me when one has gone stale"
description: How I turned the DanteGPT ML journal into published technical reports. Numbered decision records with a fixed schema and pre-registered adoption criteria, an append-only metric history, and a /report Claude Code skill that reads a record range and writes a Jekyll article under a versioned style guide. A --check mode re-verifies published numbers against their source records, and its limits are measured rather than assumed.
summary: "I keep an ML journal for DanteGPT: numbered decision records with a fixed schema, written before the runs, next to an append-only metric history. Writing them up by hand does not happen, so the write-up is generated. A /report skill takes a project root and a record range, reads the records and a versioned style guide, and produces an article. The style guide is the only human input, and it is what keeps a generated series in one voice. A --check mode re-reads published articles and asserts every number still occurs in its source records; it catches stale and fabricated values, and provably does not catch a value swapped for another value that appears elsewhere in the records."
date: 2026-07-21
tags: [tooling, claude-code, decision-records, reproducibility, writing, evaluation]
published: true
permalink: /writing/ml-journal-reporting-pipeline/
---

I keep a journal for the ML work on [*DanteGPT*](/writing/dante-retrieval-reality-gap/),
a verse-recall retrieval system over the *Divine Comedy*. Numbered decision
records, one per experiment, versioned with the code. It has been the most useful
habit I picked up on that project, and for a long time it was also the one whose
output nobody but me ever saw.

The write-up is the part that does not happen. Eight experiments accumulate, each
with its own table and its own verdict, and turning them into something readable
is an afternoon I never book. So I stopped booking it and generated the write-up
instead. [The summary of records 0023 to
0030](/writing/dante-retrieval-decisions-0023-0030/) is the output. This is how
it works.

{:.no_toc}

**Contents**
{:.no_toc}
* TOC
{:toc}

---

## The journal is the source of truth

The journal lives in the project repository under `docs/ml-journal/`, versioned
with the code, so every metric row points at the commit that produced it.

```
docs/ml-journal/
  decisions/       numbered ML Decision Records (MLDR), one per decision
  metrics/
    history.jsonl  append-only, one row per (run × retriever), with git SHA
    history.md     generated from history.jsonl, never edited by hand
    *.svg          metric-over-time charts
  figures/         write-up figures generated from history.jsonl
  tools/           log_run.py, render.py, chart.py
```

Every record follows one schema: **failure mode, hypothesis, decision and its
trade-off, pre-registered criterion, validity and scoping, alternatives, result
with Δ metrics, follow-up.** `[[id]]` links connect related records.

The schema is what makes a generated summary possible at all. The adoption
verdict, the criterion, and the deltas always sit in known slots, so summarising
eight records is extraction rather than interpretation. A model reading free-form
lab notes has to decide what counted as a win. A model reading these does not,
because the record already said.

The expensive habit is writing the record *before* the runs, with the primary
metric and the adoption rule fixed. It is also the one that pays. Two of the
experiments in that block came back with a +0.007 and a p=0.07, both with a
plausible story attached, and both got recorded as rejections because the
threshold was already on paper. I know what I would have done with them
otherwise.

## The `/report` skill

Generation runs from a [Claude Code](https://claude.com/claude-code) skill,
versioned in a personal skills repository and symlinked into `~/.claude/skills/`.

```
/report ~/git/rp-playground/play-dantegpt 0023-0030
/report ~/git/rp-playground/play-dantegpt latest
```

The first argument is the project root. The skill assumes `docs/ml-journal/`
underneath it and nothing else, so it works against any repository that adopts
the layout. The publishing site is the working directory it runs in, and it
checks that first: `_writing/` and the style guide both present, otherwise stop.
Running from the wrong repository would drop an article somewhere nothing
publishes.

It then reads the selected records in full, the journal README for the current
reference configuration, and `metrics/history.jsonl` for cross-record context. It
writes a Jekyll article with a provenance note, builds the site, and stops before
committing.

That last part is deliberate. Publication is where a wrong number becomes public,
so the generator drafts and I read the diff.

### What `latest` needs

`latest` means "every record not yet covered by a published article", which
requires knowing what is covered. I put that in the article's own front matter
rather than in a state file:

```yaml
journal_repo: play-dantegpt
journal_records: "0023-0030"
```

Coverage is then a directory listing minus a front-matter scan. Nothing to keep
in sync, nothing to drift, and "write up the journal" turns into a queue instead
of a decision I keep postponing.

### The style guide is the interesting input

The site has a [writing style guide](https://github.com/rp-playground/rp-playground.github.io/blob/main/docs/writing-style-guide.md)
that the skill reads every run. No stock openers, no aphoristic punch-lines, no
em dashes, negative results foregrounded, and the rule that every number, table,
and figure path is transcribed byte-for-byte from the source record.

It is the only human input to a generated report, and it is why a series reads as
one voice rather than as eight independently drafted summaries. It is also
versioned, so editing it changes every future report and the change shows up in a
diff. The rule in it about redundant narrative summaries came from reading a
generated article and noticing the tic. That loop, read the output and tighten the
guide, is the part I would keep if I had to throw away everything else.

One decision I got wrong first. I originally put the skill in the site
repository, reasoning that it depends on the site's paths. Then I noticed it takes
*two* inputs, the source project as an argument and the site as the working
directory, and belongs to neither. It moved to the shared skills repository, and
the rule I now use is: a skill goes with a project only if there is no second
project it could ever run against.

## `--check`, and what it cannot do

The journal keeps moving after an article ships. A record gets corrected, a
metric is re-measured, and the published piece quietly stops matching its source.

`/report <project> --check` re-reads every published article, loads the records it
declares, and asserts that each number in the article still occurs in them.
Articles with no `journal_records` are skipped rather than failed. It runs clean
on the 0023 to 0030 summary.

I care more about what it does not catch. It is a lexical presence check, so it
finds a number that occurs nowhere in the covered records, which covers the stale
case and the fabricated case. It does not find a value swapped for another value
that appears somewhere in those records. I tested that instead of assuming it:
editing a published table cell from 0.508 to 0.611 passes the check, because
0.611 is a real number sitting in a different row of a different record. Column
placement is semantic and the script does not read semantics.

So the workflow has two stages. The script narrows the search and every miss gets
triaged into stale, derived, or unsourced. Then the tables get read against the
records they came from, which is where a swapped value hides. And the checker
reports without editing, because deciding which side is right, the record or the
article, is not a call to hand to the thing that wrote the article.

Building the checker also turned up two things I would not have predicted. The
first run failed on `33,320` and `36,392`, which were not errors at all: the
records write them with the Italian thousands separator, `33.320`. And the
provenance block had to be excluded, because the model name and the source commit
describe the generation run rather than the journal.

## Where the model name goes

Every generated report opens with a provenance blockquote naming the model that
wrote it, the skill, the source repository, and the commit SHA of the journal it
read.

The model name is the part I would not drop. A reader has to know which system
produced a report to weigh it, the answer changes between runs, and it is exactly
the field that a generator would happily copy from the previous article if the
skill did not tell it not to. The skill tells it not to, and to ask rather than
guess when it cannot determine the answer.

## What this is worth

Two things, and they are separable.

The journal pays for itself with or without any of this. Pre-registered criteria
turned two marginal results into recorded rejections. Control arms overturned a
conclusion two records old and found a stale ceiling that had been shaping
priorities. None of that needs a publishing pipeline.

The pipeline changes what the journal is for. Records written to be summarisable
by a machine are also records written to be read by a person six months later,
and the discipline that makes a generated report trustworthy, fixed slots and
criteria on paper before the runs, is the same discipline that makes the journal
worth keeping. The write-up stopped being an afternoon I never book.

Still queued: a scheduled run that opens a draft once the number of unreported
records crosses a threshold.
