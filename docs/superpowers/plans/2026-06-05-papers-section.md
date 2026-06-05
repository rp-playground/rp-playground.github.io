# Papers Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Papers" section — a Jekyll collection of read-and-commented papers, surfaced at `/papers/` with its own tag/year filter and individual paper pages.

**Architecture:** A new `papers` Jekyll collection (parallel to `projects`/`writing`), a `paper.html` layout reusing the article reading typography, a standalone `/papers/` index page with the existing sidebar-filter UX scoped to papers, and the home's inline filter JS extracted into a shared `/assets/js/filter.js` used by both pages. A header nav link on the home points to `/papers/`.

**Tech Stack:** Jekyll 3.10 (github-pages gem), Liquid templating, vanilla JS, plain CSS. No test framework — verification is `jekyll build` + grepping the generated `_site/`.

---

## Build / Verify Command

This repo has no `bundle` on PATH; gems are vendored. Every "build" step in this plan uses this exact command from the repo root:

```bash
GEM_HOME="$PWD/vendor/bundle/ruby/3.2.0" GEM_PATH="$PWD/vendor/bundle/ruby/3.2.0" \
  "$PWD/vendor/bundle/ruby/3.2.0/bin/jekyll" build --quiet
```

A successful build prints (at most) the harmless `faraday-retry` warning and exits 0, regenerating `_site/`. Any line containing `Liquid Exception`, `Error:`, or a non-zero exit = FAIL.

---

## File Structure

- Create: `_layouts/paper.html` — individual paper page layout (header + reading prose).
- Create: `papers.html` — `/papers/` index page (sidebar filter + card grid over `site.papers`).
- Create: `assets/js/filter.js` — shared filter IIFE (extracted from `index.html`).
- Create: `_papers/baseline-detecting-ood.md` — seed paper entry.
- Modify: `_config.yml` — register the `papers` collection.
- Modify: `index.html` — add `Papers` nav link; replace inline filter `<script>` with `<script src>`.

---

## Task 1: Register the `papers` collection

**Files:**
- Modify: `_config.yml`

- [ ] **Step 1: Add the collection**

In `_config.yml`, the `collections:` block currently reads:

```yaml
collections:
  projects:
    output: true
    permalink: /projects/:name/
  writing:
    output: true
    permalink: /writing/:name/
```

Replace it with (adds the `papers` entry at the end):

```yaml
collections:
  projects:
    output: true
    permalink: /projects/:name/
  writing:
    output: true
    permalink: /writing/:name/
  papers:
    output: true
    permalink: /papers/:name/
```

- [ ] **Step 2: Create the seed paper so the collection is non-empty**

Create `_papers/baseline-detecting-ood.md`:

```markdown
---
layout: paper
title: "A Baseline for Detecting Misclassified and Out-of-Distribution Examples in Neural Networks"
authors: "Hendrycks & Gimpel"
paper_year: 2017
link: https://arxiv.org/abs/1610.02136
date: 2026-06-05
tags: [OOD detection, calibration]
summary: "The MSP baseline: maximum softmax probability separates correct/in-distribution from wrong/OOD inputs surprisingly well."
---

The paper that established **maximum softmax probability (MSP)** as the baseline
for out-of-distribution detection. The core observation:

> the prediction probability of incorrect and out-of-distribution examples tends
> to be lower than the prediction probability for correct examples.

## Why it stuck with me

It is the reference point every later OOD method is measured against — including
the energy score I compared it to on my own
[bear detector](/writing/ood-detection/). On a tiny 3-class head the MSP is
squeezed into `[1/3, 1]`, yet it still held up better than energy on the
near-OOD case. A good reminder that a simple, well-understood baseline is hard
to beat when the model is small.
```

- [ ] **Step 3: Build (expected to FAIL on missing layout)**

Run the build command. Expected: FAIL with a Liquid/Jekyll error about the
missing `paper` layout (the layout is created in Task 2). This confirms the
collection is wired and the entry is being processed.

- [ ] **Step 4: Commit**

```bash
git add _config.yml _papers/baseline-detecting-ood.md
git commit -m "feat: register papers collection with seed entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Paper page layout

**Files:**
- Create: `_layouts/paper.html`

- [ ] **Step 1: Create the layout**

Create `_layouts/paper.html`. The `<style>` block is copied from
`_layouts/article.html` (same reading typography), with the class renamed from
`.article` to `.paper` and a paper-specific header. Full file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ page.title }} — Raffaele P.</title>
  {% if page.summary %}<meta name="description" content="{{ page.summary }}">{% endif %}
  <link rel="stylesheet" href="/assets/css/main.css">
  <style>
    .topbar { max-width: var(--media); margin: 0 auto; padding: 1.5rem 1.5rem 0; }
    .topbar a { font-size: 0.9rem; text-decoration: none; color: var(--muted); }
    .topbar a:hover { color: var(--accent); }

    .paper { max-width: var(--media); margin: 0 auto; padding: 2rem 1.5rem 5rem; }
    .paper > * { max-width: var(--measure); margin-left: auto; margin-right: auto; }
    .paper > .highlighter-rouge,
    .paper > div.highlight,
    .paper > pre,
    .paper > table,
    .paper > figure { max-width: var(--media); }

    .paper-header { margin-bottom: 2.5rem; }
    .paper-header h1 { font-size: 2.1rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
    .paper-byline { color: var(--text); font-size: 1.05rem; margin-top: 0.7rem; }
    .paper-links { margin: 0.9rem 0; }
    .paper-links a { font-size: 0.95rem; text-decoration: none; }
    .paper-meta { color: var(--muted); font-size: 0.95rem; margin-top: 0.9rem; }
    .paper-meta .tags { display: inline-flex; gap: 0.4rem; margin-left: 0.6rem; vertical-align: middle; }

    .paper p, .paper li { font-size: 1.15rem; line-height: 1.75; color: #d7dade; }
    .paper p { margin: 1.3rem auto; }
    .paper ul, .paper ol { margin: 1.3rem auto; padding-left: 1.4rem; }
    .paper li { margin: 0.5rem auto; }
    .paper li > ul, .paper li > ol { margin: 0.5rem 0; }

    .paper h2 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; margin: 3rem auto 1rem; padding-top: 0.5rem; }
    .paper h3 { font-size: 1.15rem; font-weight: 600; color: var(--muted); margin: 2rem auto 0.8rem; text-transform: none; }

    .paper strong { color: #fff; }
    .paper em { color: #c8ccd2; }
    .paper a { text-decoration: none; border-bottom: 1px solid rgba(91,157,255,0.35); }
    .paper a:hover { border-bottom-color: var(--accent); }

    .paper blockquote { border-left: 3px solid var(--accent); padding: 0.2rem 0 0.2rem 1.3rem; margin: 1.6rem auto; color: var(--muted); font-style: italic; }
    .paper blockquote p { font-size: 1.08rem; color: var(--muted); }

    .paper code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 0.88em; background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 5px; border: 1px solid var(--border); }
    .paper pre, .paper .highlighter-rouge, .paper .highlight { background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; margin: 1.6rem auto; overflow-x: auto; }
    .paper pre, .paper .highlight pre { padding: 1rem 1.2rem; }
    .paper pre code { background: none; border: none; padding: 0; font-size: 0.92rem; line-height: 1.6; color: var(--text); }

    .paper table { width: 100%; border-collapse: collapse; margin: 1.8rem auto; font-size: 1rem; }
    .paper th, .paper td { border: 1px solid var(--border); padding: 0.6rem 0.9rem; text-align: left; vertical-align: middle; }
    .paper th { background: var(--card); font-weight: 600; }

    .paper hr { border: none; border-top: 1px solid var(--border); margin: 3rem auto; }

    footer { max-width: var(--measure); margin: 0 auto; padding: 0 1.5rem 4rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="topbar"><a href="/papers/">← Papers</a></div>
  <article class="paper">
    <header class="paper-header">
      <h1>{{ page.title }}</h1>
      {% if page.authors or page.paper_year %}
      <p class="paper-byline">
        {{ page.authors }}{% if page.authors and page.paper_year %} · {% endif %}{{ page.paper_year }}
      </p>
      {% endif %}
      {% if page.link %}
      <div class="paper-links"><a href="{{ page.link }}" target="_blank" rel="noopener">Read paper ↗</a></div>
      {% endif %}
      <p class="paper-meta">
        {% if page.date %}Read {{ page.date | date: "%B %Y" }}{% endif %}
        {% if page.tags %}<span class="tags">{% for t in page.tags %}<span class="tag">{{ t }}</span>{% endfor %}</span>{% endif %}
      </p>
    </header>
    {{ content }}
  </article>
  <footer>Built with Jekyll · hosted on GitHub Pages · <a href="/">back home</a></footer>
</body>
</html>
```

- [ ] **Step 2: Build (expected PASS)**

Run the build command. Expected: PASS (exit 0, no Liquid error).

- [ ] **Step 3: Verify the paper page rendered**

```bash
test -f _site/papers/baseline-detecting-ood/index.html && \
grep -q "Read paper ↗" _site/papers/baseline-detecting-ood/index.html && \
grep -q "Hendrycks &amp; Gimpel · 2017" _site/papers/baseline-detecting-ood/index.html && \
echo VERIFY_OK
```

Expected: prints `VERIFY_OK`. (The `&amp;` is the HTML-escaped `&` from the author string.)

- [ ] **Step 4: Commit**

```bash
git add _layouts/paper.html
git commit -m "feat: add paper page layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extract shared filter JS

**Files:**
- Create: `assets/js/filter.js`
- Modify: `index.html` (remove inline `<script>`, add `<script src>`)

- [ ] **Step 1: Create the shared JS file**

Create `assets/js/filter.js` with the exact IIFE currently inline at the bottom
of `index.html` (verbatim — it already operates generically on `.filter`,
`.item-card`, `.item-section`, and the URL hash):

```javascript
(function () {
  var controls = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.item-card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.item-section'));

  function matches(card, type, value) {
    if (type === 'all') return true;
    if (type === 'tag') return ('|' + card.dataset.tags + '|').indexOf('|' + value + '|') !== -1;
    if (type === 'year') return card.dataset.year === value;
    return true;
  }

  function apply(type, value) {
    controls.forEach(function (c) {
      var on = (type === 'all' && c.dataset.filter === 'all') ||
               (c.dataset.filter === type && c.dataset.value === value);
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cards.forEach(function (card) {
      card.style.display = matches(card, type, value) ? '' : 'none';
    });
    // Hide a section (heading + grid) when it has no visible cards.
    sections.forEach(function (sec) {
      var any = Array.prototype.slice.call(sec.querySelectorAll('.item-card'))
        .some(function (c) { return c.style.display !== 'none'; });
      sec.style.display = any ? '' : 'none';
    });
    // Reflect the active filter in the URL hash so a filtered view is shareable.
    if (type === 'all') history.replaceState(null, '', location.pathname);
    else history.replaceState(null, '', '#' + type + '=' + encodeURIComponent(value));
  }

  controls.forEach(function (c) {
    c.addEventListener('click', function () { apply(c.dataset.filter, c.dataset.value); });
  });

  var m = location.hash.match(/^#(tag|year)=(.+)$/);
  if (m) apply(m[1], decodeURIComponent(m[2]));
  else apply('all');
})();
```

- [ ] **Step 2: Replace the inline script in `index.html`**

In `index.html`, find the entire inline script block (starts with `<script>`
immediately followed by `(function () {` and ends with `</script>` near the end
of the file). Replace the whole block — `<script>` … the IIFE … `</script>` —
with this single line:

```html
  <script src="/assets/js/filter.js"></script>
```

- [ ] **Step 3: Build (expected PASS)**

Run the build command. Expected: PASS.

- [ ] **Step 4: Verify the home references the shared file and no longer inlines the IIFE**

```bash
grep -q '<script src="/assets/js/filter.js">' _site/index.html && \
! grep -q "function matches(card" _site/index.html && \
test -f _site/assets/js/filter.js && \
echo VERIFY_OK
```

Expected: prints `VERIFY_OK` (home links the file; the inline function is gone; the asset was copied to `_site`).

- [ ] **Step 5: Commit**

```bash
git add assets/js/filter.js index.html
git commit -m "refactor: extract landing filter JS into shared assets/js/filter.js

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `/papers/` index page

**Files:**
- Create: `papers.html`

- [ ] **Step 1: Create the index page**

Create `papers.html` at the repo root. It mirrors `index.html`'s filter UX but
computes tags/years over `site.papers` only and renders one card section. The
inline `<style>` carries only the bits the index needs (copied from
`index.html`'s relevant rules). Full file:

```html
---
permalink: /papers/
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Papers — Raffaele P.</title>
  <meta name="description" content="Papers I've read, with commentary.">
  <link rel="stylesheet" href="/assets/css/main.css">
  <style>
    .container { max-width: 1040px; margin: 0 auto; padding: 4rem 1.5rem; }
    header.site { margin-bottom: 3rem; }
    header.site h1 { font-size: 2.2rem; font-weight: 600; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 1.1rem; margin-top: 0.5rem; }
    .topbar { margin-bottom: 1.5rem; }
    .topbar a { font-size: 0.9rem; text-decoration: none; color: var(--muted); }
    .topbar a:hover { color: var(--accent); }

    .layout { display: grid; grid-template-columns: 180px 1fr; gap: 2.5rem; align-items: start; }
    @media (max-width: 680px) { .layout { grid-template-columns: 1fr; gap: 1.5rem; } }

    aside .label { text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-size: 0.7rem; margin: 1.1rem 0 0.5rem; }
    aside .label:first-child { margin-top: 0; }
    .filter {
      display: block; width: 100%; text-align: left; cursor: pointer;
      background: none; border: none; color: var(--text); font: inherit;
      padding: 0.25rem 0.55rem; border-radius: 6px; margin-bottom: 0.15rem;
    }
    .filter:hover { background: rgba(91,157,255,0.08); }
    .filter.active { background: rgba(91,157,255,0.18); color: var(--accent); }

    section.item-section h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 0 0 1.2rem; }
    .grid { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .item-card .byline { color: var(--muted); font-size: 0.82rem; margin: 0.15rem 0 0.4rem; }
    .item-card .meta-year { margin-left: auto; color: var(--muted); font-size: 0.72rem; }

    .empty { color: var(--muted); }
    footer { margin-top: 4rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar"><a href="/">← Home</a></div>
    <header class="site">
      <h1>Papers</h1>
      <p class="subtitle">Papers I've read, with commentary.</p>
    </header>

    {%- comment -%} Tags + reading-years across the papers collection only. {%- endcomment -%}
    {%- assign tag_acc = "" -%}
    {%- assign year_acc = "" -%}
    {%- for item in site.papers -%}
      {%- for t in item.tags -%}{%- assign tag_acc = tag_acc | append: t | append: "~" -%}{%- endfor -%}
      {%- assign y = item.date | date: "%Y" -%}
      {%- assign year_acc = year_acc | append: y | append: "~" -%}
    {%- endfor -%}
    {%- assign all_tags = tag_acc | split: "~" | uniq | sort -%}
    {%- assign all_years = year_acc | split: "~" | uniq | sort | reverse -%}

    <div class="layout">
      <aside>
        <div class="label">Filter</div>
        <button class="filter active" data-filter="all">All</button>

        {%- if all_tags.size > 0 -%}
        <div class="label">Tags</div>
        {%- for t in all_tags -%}
        <button class="filter" data-filter="tag" data-value="{{ t }}">{{ t }}</button>
        {%- endfor -%}
        {%- endif -%}

        {%- if all_years.size > 0 -%}
        <div class="label">Year</div>
        {%- for y in all_years -%}
        <button class="filter" data-filter="year" data-value="{{ y }}">{{ y }}</button>
        {%- endfor -%}
        {%- endif -%}
      </aside>

      <main>
        {%- assign papers = site.papers | sort: "date" | reverse -%}
        {%- if papers.size > 0 -%}
        <section class="item-section">
          <h2>Papers</h2>
          <div class="grid">
            {%- for p in papers -%}
            <a class="card item-card" href="{{ p.url }}"
               data-tags="|{{ p.tags | join: '|' }}|" data-year="{{ p.date | date: '%Y' }}">
              <h3>{{ p.title }}</h3>
              <p class="byline">{{ p.authors }}{% if p.authors and p.paper_year %} · {% endif %}{{ p.paper_year }}</p>
              <p>{{ p.summary }}</p>
              <div class="tags">
                {%- for t in p.tags -%}<span class="tag">{{ t }}</span>{%- endfor -%}
                <span class="meta-year">{{ p.date | date: "%Y" }}</span>
              </div>
            </a>
            {%- endfor -%}
          </div>
        </section>
        {%- else -%}
        <p class="empty">No papers yet.</p>
        {%- endif -%}
      </main>
    </div>

    <footer>Built with Jekyll · hosted on GitHub Pages · <a href="/">back home</a></footer>
  </div>
  <script src="/assets/js/filter.js"></script>
</body>
</html>
```

- [ ] **Step 2: Build (expected PASS)**

Run the build command. Expected: PASS.

- [ ] **Step 3: Verify the index rendered with a filterable card**

```bash
test -f _site/papers/index.html && \
grep -q 'data-filter="tag" data-value="OOD detection"' _site/papers/index.html && \
grep -q 'class="card item-card"' _site/papers/index.html && \
grep -q '<script src="/assets/js/filter.js">' _site/papers/index.html && \
echo VERIFY_OK
```

Expected: prints `VERIFY_OK` (index exists, a tag filter button for the seed's tag is present, a paper card is present, and the shared filter JS is linked).

- [ ] **Step 4: Commit**

```bash
git add papers.html
git commit -m "feat: add /papers/ index page with tag/year filter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Home nav link to `/papers/`

**Files:**
- Modify: `index.html` (`header.site .links`)

- [ ] **Step 1: Add the nav link**

In `index.html`, the header links block currently reads:

```html
      <div class="links">
        <!-- TODO: real links -->
        <a href="https://github.com/YOUR_USERNAME">GitHub</a>
        <a href="https://linkedin.com/in/YOUR_HANDLE">LinkedIn</a>
        <a href="mailto:you@example.com">Email</a>
      </div>
```

Add a `Papers` link as the first entry:

```html
      <div class="links">
        <!-- TODO: real links -->
        <a href="/papers/">Papers</a>
        <a href="https://github.com/YOUR_USERNAME">GitHub</a>
        <a href="https://linkedin.com/in/YOUR_HANDLE">LinkedIn</a>
        <a href="mailto:you@example.com">Email</a>
      </div>
```

- [ ] **Step 2: Build (expected PASS)**

Run the build command. Expected: PASS.

- [ ] **Step 3: Verify the link is on the home page**

```bash
grep -q '<a href="/papers/">Papers</a>' _site/index.html && echo VERIFY_OK
```

Expected: prints `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: link Papers section from landing header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

```bash
rm -rf _site
GEM_HOME="$PWD/vendor/bundle/ruby/3.2.0" GEM_PATH="$PWD/vendor/bundle/ruby/3.2.0" \
  "$PWD/vendor/bundle/ruby/3.2.0/bin/jekyll" build --quiet
echo "exit=$?"
```

Expected: `exit=0`, only the harmless `faraday-retry` warning, no `Liquid Exception` / `Error:`.

- [ ] **Step 2: Verify all artifacts in one shot**

```bash
test -f _site/papers/index.html && \
test -f _site/papers/baseline-detecting-ood/index.html && \
test -f _site/assets/js/filter.js && \
grep -q '<a href="/papers/">Papers</a>' _site/index.html && \
! grep -q "function matches(card" _site/index.html && \
grep -q "Read paper ↗" _site/papers/baseline-detecting-ood/index.html && \
grep -q 'class="card item-card"' _site/papers/index.html && \
echo ALL_OK
```

Expected: prints `ALL_OK`.

- [ ] **Step 3: Confirm the home filter still works (regression)**

The home's projects/writing filter must be unchanged. Confirm the home still
ships filter buttons and the shared script:

```bash
grep -q 'class="filter active" data-filter="all"' _site/index.html && \
grep -q '<script src="/assets/js/filter.js">' _site/index.html && \
echo HOME_OK
```

Expected: prints `HOME_OK`.

- [ ] **Step 4: No commit needed** (verification only). If any check failed, fix the responsible task before considering the plan complete.
```
