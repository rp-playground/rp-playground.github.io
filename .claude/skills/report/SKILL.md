---
name: report
description: Generate a technical report article from a range of ML journal decision records (MLDRs) in a project that follows the docs/ml-journal layout. Use when asked to write up decision records as a site article, e.g. "/report ../play-dantegpt 0023-0030" or "/report ../play-dantegpt latest".
---

# Report from an ML journal

Turn a block of ML Decision Records into a published article in `_writing/`.

**Usage:** `/report <project-root> <NNNN-NNNN | NNNN | latest>`

- `<project-root>` — path to the source repository. The only assumption about it
  is that `docs/ml-journal/` exists underneath. Nothing else is project-specific.
- selector — an explicit range (`0023-0030`), a single id (`0031`), or `latest`.

If either argument is missing, ask for it. Do not guess the project root.

## 1. Resolve the journal

Check `<project-root>/docs/ml-journal/decisions/` exists. If not, stop and say
which path was tried. The expected layout:

```
docs/ml-journal/
  decisions/       NNNN-<slug>.md, one per decision
  metrics/
    history.jsonl  append-only, one row per (run × retriever), with git SHA
    history.md     generated
  figures/         generated SVGs
  README.md        index of decisions + current reference configuration
```

## 2. Resolve the selector

Derive `journal_repo` as the basename of `<project-root>` (e.g. `play-dantegpt`).

- **Range or single id** — map onto `decisions/NNNN-*.md`. If any id in the range
  has no file, list the missing ones and continue with the rest.
- **`latest`** — all ids in `decisions/` minus the ids already covered by
  published articles for the same project. Coverage lives in the front matter of
  `_writing/*.md`:

  ```yaml
  journal_repo: play-dantegpt
  journal_records: "0023-0030"
  ```

  Read those two fields across `_writing/*.md`, keep the entries whose
  `journal_repo` matches, expand each `journal_records` range into ids, and
  subtract. Ignore `TEMPLATE.md` and any `NNNN-review.md` side files.

  If the remainder is empty, stop and report that every record is already
  covered. If the remainder is non-contiguous, report the gaps and ask whether to
  cover the whole span or only the contiguous tail.

Confirm the resolved id list before writing anything.

## 3. Read the sources

Read in full, no skimming:

1. every selected record (primary source for all numbers and verdicts);
2. `docs/ml-journal/README.md` — the decision index and the current reference
   configuration;
3. `docs/ml-journal/metrics/history.jsonl` — for cross-record context and to
   check a quoted number when a record is ambiguous.

Capture the source commit: `git -C <project-root> rev-parse --short HEAD`.

Also capture the model actually generating the report, as a reader-facing name
plus the variant if one applies (e.g. "Claude Opus 4.8, 1M-context variant").
Take it from the running session, not from this file, and do not carry it over
from a previous article. If it cannot be determined, ask rather than guess: a
provenance note that names the wrong model is worse than one that names none.

## 4. Read the style guide and follow it

`docs/writing-style-guide.md` in this repository is binding. It is the only human
input to the report, and it is what makes a series read as one voice.

Two rules dominate and are worth restating:

- **Every number, table, code block, figure path, link, and reference is
  transcribed byte-for-byte from the source record.** Do not recompute, round,
  reformat, or re-derive. If a record's numbers look wrong, report it and stop;
  do not silently fix.
- **Foreground the negative results.** Records that failed their pre-registered
  criterion carry most of the information. Say what was rejected and why, in the
  same weight as the adoptions.

Register: technical report. Neutral third person, no "I". Attribute actions to
the record (`Record 0024 re-measured...`), not to a narrator. The style guide's
prohibitions (no stock openers, no aphoristic punch-lines, no em dashes, no
redundant narrative summaries) apply in full.

## 5. Check what has already been published

Scan `_writing/` for earlier articles covering earlier records of the same
project. Link to them by permalink instead of restating their content. An article
covering records 23–30 should point at the one that already covers record 23 in
depth rather than duplicating its analysis.

## 6. Write the article

Write `_writing/<slug>.md`. The slug names the project and the range, e.g.
`dante-retrieval-decisions-0023-0030.md`.

Front matter, matching the site's conventions:

```yaml
---
layout: article
title: "..."
subtitle: "..."
description: ...      # one paragraph, plain text, for meta tags
summary: "..."        # longer abstract shown in listings
date: YYYY-MM-DD
tags: [...]
published: true
permalink: /writing/<slug>/
journal_repo: <project basename>
journal_records: "NNNN-NNNN"
---
```

`journal_repo` and `journal_records` are what makes `latest` work in future runs.
Never omit them.

Open with a provenance blockquote. It must name, in this order: the generating
model from step 3, the `/report` skill, the source repository and its commit SHA,
the record range, and the fact that no numbers were re-derived for the write-up.
The model name is not optional. A reader has to know which system wrote the
report to judge it, and the answer changes between runs.

```markdown
> **Provenance.** Generated by Claude Code (model: <model name and variant>) via
> the `/report` skill, from the primary sources of the <project> ML journal at
> commit `<sha>`: the decision records `NNNN`–`NNNN`, ...
```

Body structure:

- terminology section if the records use notation a reader will not have;
- one section per coherent phase of work, each opening with a decision table
  (`# | Decision | Outcome | Rationale`) and then the analysis of the records
  that need it;
- a `Where things stand` section: reference configuration, current bottleneck,
  next lever, and any standing rules the records established;
- a `Method notes` section on the practices that produced the results, when the
  block supports one.

## 7. Build

```bash
export GEM_HOME="$PWD/vendor/bundle/ruby/$(ls vendor/bundle/ruby/)"
export GEM_PATH="$GEM_HOME"
export PATH="$GEM_HOME/bin:$PATH"
jekyll build
```

Report Liquid errors and broken internal links. `GEM_PATH` is required; without
it the user gem dir leaks in and the build fails on a version conflict.

## 8. Stop before committing

Do not commit and do not push. Print:

- the output path and the resolved record range;
- the record ids that remain uncovered after this article;
- a short diff summary.

Publication is the step where a wrong number becomes public, so a human reads the
diff and merges.