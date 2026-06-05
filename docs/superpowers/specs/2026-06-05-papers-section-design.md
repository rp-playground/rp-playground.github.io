# Design — "Papers" section (reading & commenting papers)

**Date:** 2026-06-05
**Status:** Approved (pending spec review)

## Goal

Add a dedicated section to the site where Raffaele logs the papers he reads and
his commentary on each. Mirrors the existing Jekyll patterns (collections,
layouts, tag/year filtering) rather than introducing new machinery.

## Decisions (from brainstorming)

- **Shape:** a new Jekyll collection `papers`, parallel to `projects`/`writing`.
  Each paper is its own page.
- **Per-paper metadata:** authors + paper publication year, link to the paper
  (arXiv/DOI/PDF), reading date, tags. (No venue/journal field.)
- **Landing integration:** NOT shown as a card section on the home page and NOT
  part of the home's unified tag/year filter. Instead a dedicated index page at
  `/papers/`, reachable via a header nav link.
- **Index page:** the `/papers/` page has its own Tags/Year sidebar filter
  (same UX as the home), scoped to papers only. Year filter uses reading date.
- **Shared filter JS:** the filter logic (currently inline in `index.html`) is
  extracted into `/assets/js/filter.js` and used by both the home and `/papers/`.

## Components

### 1. `_config.yml` — register the collection
Add under `collections:`:
```yaml
papers:
  output: true
  permalink: /papers/:name/
```

### 2. Paper front matter (content model)
Each `_papers/<slug>.md`:
```yaml
---
layout: paper
title: "A Baseline for Detecting Misclassified and OOD Examples"
authors: "Hendrycks & Gimpel"
paper_year: 2017
link: https://arxiv.org/abs/1610.02136
date: 2026-06-05          # reading date — drives sort + year filter
tags: [OOD detection, calibration]
summary: "One-line teaser shown on the index card."
---
<Markdown commentary — the body>
```
Field semantics:
- `paper_year` — publication year of the paper (distinct from `date`).
- `date` — when Raffaele read/commented it; used for ordering and the year filter.
- `link` — original paper URL; rendered as a "Read paper ↗" link.

### 3. `_layouts/paper.html`
Reuses `article.html`'s reading typography (reading measure, prose, blockquote,
code, tables) since the body is long-form commentary. Differs in the header:
- `<h1>` title
- meta line: `{{ authors }} · {{ paper_year }}`
- a "Read paper ↗" link to `page.link` (target=_blank rel=noopener), when present
- a second meta line: reading date (`{{ page.date | date: "%B %Y" }}`) + tags
- topbar "← Home" link, matching the other layouts

To avoid duplicating ~70 lines of prose CSS, the shared article/paper prose
styles are acceptable to copy into `paper.html` (consistent with how
`project.html` and `article.html` each carry their own `<style>` today — the
codebase favors self-contained layouts over a shared stylesheet partial). Keep
the same class names/structure as `article.html`.

### 4. `papers.html` (permalink `/papers/`)
Standalone index page (front matter `permalink: /papers/`). Structure mirrors
`index.html`:
- header with title "Papers" + short subtitle, and a "← Home" link
- compute `all_tags` / `all_years` over `site.papers` only
- sidebar: All / Tags / Year buttons
- a grid of paper cards. Card = `<a>` to `paper.url` with:
  - `<h3>` title
  - a line `{{ authors }} · {{ paper_year }}`
  - `summary`
  - tags + reading-year meta (`data-tags`, `data-year` for filtering)
- includes `/assets/js/filter.js` and the same per-card inline styles needed.

### 5. `/assets/js/filter.js` (shared, new)
Extract the IIFE currently inline at the bottom of `index.html` verbatim
(it already operates generically on `.filter`, `.item-card`, `.item-section`
and the URL hash). Both `index.html` and `papers.html` load it via
`<script src="/assets/js/filter.js"></script>`. `index.html` loses its inline
`<script>` block but is otherwise functionally identical (same filtering,
same shareable `#tag=`/`#year=` hash behavior).

### 6. Header nav link on the home
In `index.html`'s `header.site .links`, add `<a href="/papers/">Papers</a>`
so the new section is reachable from the landing page.

### 7. Seed entry
Create one real `_papers/*.md` (e.g. Hendrycks & Gimpel 2017, already cited in
the OOD write-up) so the section and its filter render with real data.

## Out of scope (YAGNI)

- No venue/journal field.
- No papers cards on the home landing, and no merging papers into the home's
  unified filter.
- No rating/status fields, no BibTeX export, no per-tag pages.

## Verification

- `bundle exec jekyll build` succeeds with no Liquid errors.
- `/papers/` lists the seed entry; Tags/Year buttons filter it; the active
  filter is reflected in the URL hash and is shareable.
- A paper page renders authors · year, the "Read paper ↗" link, reading date,
  tags, and the Markdown body with the reading typography.
- The home page still filters projects/writing exactly as before; the new
  "Papers" header link navigates to `/papers/`.
