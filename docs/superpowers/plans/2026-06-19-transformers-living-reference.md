# Transformers Living Reference — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish "Transformers — A Telling to Myself" as a read-only, navigable living-reference page under `_writing`, with a sidebar TOC, in-page search, KaTeX math, and a marker status panel.

**Architecture:** A new generic `_layouts/reference.html` (two-column grid: sticky sidebar with search + status panel + auto-built TOC, wide prose body) renders a single markdown document `_writing/transformers.md`. TOC, scrollspy, anchors, search, and marker badges are vanilla JS that runs on the rendered DOM; math is rendered by KaTeX auto-render from CDN. The home "Writing" scroller picks the item up automatically — no changes to `_config.yml` or `index.html`.

**Tech Stack:** Jekyll (kramdown + rouge), Liquid layouts, vanilla JS, KaTeX (CDN auto-render), CSS custom properties already defined in `assets/css/main.css`.

## Global Constraints

- **Site CSS variables (use, don't redefine):** `--card #1a1d24`, `--text #e6e8eb`, `--muted #9aa0a8`, `--accent #5b9dff`, `--border #2a2e37`, `--code-bg #14171d`, `--measure 700px`, `--media 960px` (in `assets/css/main.css:2-11`).
- **Reuse `article.html` prose CSS verbatim** for body typography (p/li/h2/h3/code/pre/table/blockquote/figure) — only widen the body column; do not invent new prose styles.
- **Published page is read-only.** No reader-side editing UI. Author edits the source markdown only.
- **Never alter numbers, dimensions, code, tables, or references** during migration — only change the *representation* of math (writing style guide rule).
- **PyTorch reference code stays a ```` ```python ```` code block** — it is never converted to math.
- **No new build dependencies** beyond the KaTeX CDN `<link>`/`<script>` tags. TOC/scrollspy/search/markers are vanilla JS.
- **Frontmatter the home scroller reads:** `title`, `summary`, `tags`, `date` (see `index.html:157-166`). All four required for the card to render correctly.
- **Local build command** (gems are vendored; `bundle` is not on PATH — see memory `jekyll-local-build`). Run from the repo root that contains `vendor/`:
  ```bash
  export GEM_HOME="$PWD/vendor/bundle/ruby/$(ls vendor/bundle/ruby/)"
  export GEM_PATH="$GEM_HOME"
  export PATH="$GEM_HOME/bin:$PATH"
  jekyll build           # output in _site/ ; or: jekyll serve -> http://localhost:4000
  ```
  Note: `vendor/` is gitignored, so it exists only in the primary checkout. If building from a worktree, either copy/symlink `vendor/` and `.bundle/` in, or run the build from the primary checkout.

**Verification model:** This is a static site with no JS test runner. Each task's "test" is a **local Jekyll build that succeeds** plus a **specific visual check** in `jekyll serve` at `http://localhost:4000/writing/transformers/`. Where a step says "verify", open that URL and confirm the described behavior before committing.

---

### Task 1: Layout skeleton + content stub that builds and renders

Create the reference layout shell and a small stub document so later tasks have real structure (headings, a formula, markers, a table, a code block) to verify against. No JS behavior yet — just static structure that builds, renders at the permalink, and appears on the home Writing scroller.

**Files:**
- Create: `_layouts/reference.html`
- Create: `_writing/transformers.md`

**Interfaces:**
- Produces: layout `reference` usable via frontmatter `layout: reference`; page at `/writing/transformers/`; DOM landmarks later tasks depend on:
  - `<aside class="ref-sidebar">` — sidebar container
  - `<nav class="ref-toc" aria-label="Contents"></nav>` — empty, JS fills it
  - `<div class="ref-search"></div>` and `<div class="ref-status"></div>` — empty mount points
  - `<div class="ref-body">{{ content }}</div>` — rendered markdown
  - `<script src="/assets/js/reference.js"></script>` referenced at end of body (file created in Task 2)

- [ ] **Step 1: Write `_layouts/reference.html`**

Mirror `_layouts/article.html`'s `<head>` (charset, viewport, title, description, `/assets/css/main.css`) and its inline prose CSS block, but lay the page out as a two-column grid and widen the body. Use only the existing CSS variables.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ page.title }} — Raffaele P.</title>
  {% if page.description %}<meta name="description" content="{{ page.description }}">{% endif %}
  <link rel="stylesheet" href="/assets/css/main.css">
  <style>
    .topbar { max-width: var(--media); margin: 0 auto; padding: 1.5rem 1.5rem 0; }
    .topbar a { font-size: 0.9rem; text-decoration: none; color: var(--muted); }
    .topbar a:hover { color: var(--accent); }

    /* Two-column reference layout */
    .ref { max-width: var(--media); margin: 0 auto; padding: 1rem 1.5rem 5rem;
           display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 2.5rem; }
    .ref-sidebar { position: sticky; top: 1rem; align-self: start;
                   max-height: calc(100vh - 2rem); overflow-y: auto; font-size: 0.9rem; }
    .ref-sidebar > * + * { margin-top: 1.25rem; }

    .ref-toc ul { list-style: none; margin: 0; padding: 0; }
    .ref-toc li { margin: 0.15rem 0; line-height: 1.4; }
    .ref-toc li.lvl-3 { padding-left: 0.9rem; }
    .ref-toc a { display: block; text-decoration: none; color: var(--muted);
                 border-left: 2px solid transparent; padding: 0.1rem 0 0.1rem 0.6rem; }
    .ref-toc a:hover { color: var(--text); }
    .ref-toc a.active { color: var(--accent); border-left-color: var(--accent); }

    .ref-header { margin-bottom: 1.5rem; }
    .ref-header h1 { font-size: 2.1rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
    .ref-meta { color: var(--muted); font-size: 0.95rem; margin-top: 0.6rem; }

    /* Heading anchors */
    .ref-body h2, .ref-body h3 { scroll-margin-top: 1rem; }
    .ref-body .anchor { opacity: 0; text-decoration: none; color: var(--muted);
                        margin-left: 0.4rem; font-weight: 400; }
    .ref-body h2:hover .anchor, .ref-body h3:hover .anchor { opacity: 1; }

    /* ---- Prose typography: copied from article.html, scoped to .ref-body ---- */
    .ref-body p, .ref-body li { font-size: 1.08rem; line-height: 1.7; color: #d7dade; }
    .ref-body p { margin: 1.1rem 0; }
    .ref-body ul, .ref-body ol { margin: 1.1rem 0; padding-left: 1.4rem; }
    .ref-body li { margin: 0.4rem 0; }
    .ref-body h2 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; margin: 2.6rem 0 1rem; padding-top: 0.5rem; }
    .ref-body h3 { font-size: 1.12rem; font-weight: 600; color: var(--muted); margin: 1.8rem 0 0.7rem; }
    .ref-body strong { color: #fff; }
    .ref-body em { color: #c8ccd2; }
    .ref-body a { text-decoration: none; border-bottom: 1px solid rgba(91,157,255,0.35); }
    .ref-body a:hover { border-bottom-color: var(--accent); }
    .ref-body blockquote { border-left: 3px solid var(--accent); padding: 0.2rem 0 0.2rem 1.3rem; margin: 1.4rem 0; color: var(--muted); font-style: italic; }
    .ref-body code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 0.88em; background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 5px; border: 1px solid var(--border); }
    .ref-body pre, .ref-body .highlighter-rouge, .ref-body .highlight { background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; margin: 1.4rem 0; overflow-x: auto; }
    .ref-body pre, .ref-body .highlight pre { padding: 1rem 1.2rem; }
    .ref-body pre code { background: none; border: none; padding: 0; font-size: 0.92rem; line-height: 1.6; color: var(--text); }
    .ref-body table { width: 100%; border-collapse: collapse; margin: 1.6rem 0; font-size: 0.98rem; }
    .ref-body th, .ref-body td { border: 1px solid var(--border); padding: 0.5rem 0.8rem; text-align: left; vertical-align: middle; }
    .ref-body th { background: var(--card); font-weight: 600; }
    .ref-body hr { border: none; border-top: 1px solid var(--border); margin: 2.5rem 0; }

    footer { max-width: var(--media); margin: 0 auto; padding: 0 1.5rem 4rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="topbar"><a href="/">← Home</a></div>
  <div class="ref">
    <aside class="ref-sidebar">
      <div class="ref-search"></div>
      <div class="ref-status"></div>
      <nav class="ref-toc" aria-label="Contents"></nav>
    </aside>
    <main class="ref-main">
      <header class="ref-header">
        <h1>{{ page.title }}</h1>
        <p class="ref-meta">
          {% if page.date %}{{ page.date | date: "%B %Y" }}{% endif %}
          {% if page.reading %} · {{ page.reading }}{% endif %}
        </p>
      </header>
      <div class="ref-body">{{ content }}</div>
    </main>
  </div>
  <footer>Built with Jekyll · hosted on GitHub Pages · <a href="/">back home</a></footer>
  <script src="/assets/js/reference.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write the `_writing/transformers.md` stub**

A real-but-small document: frontmatter + intro + two sections, exercising a heading hierarchy, a marker of each kind, a table, a fenced code block, and one display formula written as plain text (KaTeX comes in Task 4 — for now it renders as literal text, which is fine).

````markdown
---
layout: reference
title: "Transformers — A Telling to Myself"
description: A living reference for the transformer architecture, explained back to myself — searchable, modular, and built to grow.
summary: A working reference for the transformer architecture, in the voice of explaining it back to myself. Searchable and modular, with formulas that carry explicit dimensions so any piece lifts out without re-deriving the rest.
date: 2026-06-19
tags: [transformers, attention, mech-interp, reference]
permalink: /writing/transformers/
---

A working reference for the transformer architecture, written in the voice of
explaining it back to myself. Built to be **searched, extended, and modified** —
not read once.

## 1. What a transformer does

A transformer maps a sequence of tokens to next-token probability distributions.
[OPEN] verify the exact phrasing against the source.

| Symbol | Meaning |
|---|---|
| `T` | sequence length |
| `d_e` | embedding width |

## 2. Inside attention

The scaled dot-product, written here as plain text for now:

```
Attn(X) = softmax( mask( Q·K^T / sqrt(d_k) ) ) · V
```

A reference implementation stays a code block, never math:

```python
def attention(Q, K, V):
    d_k = Q.size(-1)
    scores = Q @ K.transpose(-2, -1) / d_k ** 0.5
    return scores
```

The MLP treatment is thin on purpose. [STUB]
Expansion hook for the interp project. [EXT]
````

- [ ] **Step 3: Build and verify it renders**

Run the local build command (Global Constraints), then `jekyll serve`. Open `http://localhost:4000/writing/transformers/`.
Expected: page builds with **no Liquid/kramdown errors**; the title, intro, both sections, the table, the code blocks, and the literal marker text are visible; the sidebar area is present but empty.

- [ ] **Step 4: Verify the home scroller picks it up**

Open `http://localhost:4000/`. Expected: a card titled "Transformers — A Telling to Myself" appears in the **Writing** section with its summary and tags.

- [ ] **Step 5: Commit**

```bash
git add _layouts/reference.html _writing/transformers.md
git commit -m "feat: reference layout + transformers stub page"
```

---

### Task 2: Auto-built TOC + heading anchors (vanilla JS)

Generate the sidebar table of contents from the rendered headings, and add a hover `#` anchor to each heading. Liquid can't see headings inside `{{ content }}`, so this runs on the DOM at load.

**Files:**
- Create: `assets/js/reference.js`

**Interfaces:**
- Consumes: DOM landmarks from Task 1 (`.ref-body`, `.ref-toc`).
- Produces: each `.ref-body h2,h3` gets a stable `id` (slug of its text); `.ref-toc` is filled with `<ul><li class="lvl-2|lvl-3"><a href="#id">text</a>`. Exposes nothing global; all code in one IIFE. The slug function and the heading node list are reused by Tasks 3 and 5 — keep them at the top of the IIFE.

- [ ] **Step 1: Write `assets/js/reference.js`**

```javascript
(function () {
  var body = document.querySelector('.ref-body');
  var tocEl = document.querySelector('.ref-toc');
  if (!body) return;

  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')   // drop punctuation (incl. the § sign)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  var headings = Array.prototype.slice.call(body.querySelectorAll('h2, h3'));
  var used = {};
  headings.forEach(function (h) {
    var base = slugify(h.textContent) || 'section';
    var id = base;
    var n = 2;
    while (used[id]) { id = base + '-' + n++; }
    used[id] = true;
    h.id = id;
    var a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + id;
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    h.appendChild(a);
  });

  if (tocEl && headings.length) {
    var ul = document.createElement('ul');
    headings.forEach(function (h) {
      var li = document.createElement('li');
      li.className = 'lvl-' + (h.tagName === 'H3' ? '3' : '2');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      // exclude the trailing "#" anchor text from the TOC label
      a.textContent = h.firstChild ? h.firstChild.textContent : h.textContent;
      li.appendChild(a);
      ul.appendChild(li);
    });
    tocEl.appendChild(ul);
  }
})();
```

- [ ] **Step 2: Build and verify the TOC**

Rebuild, open `http://localhost:4000/writing/transformers/`.
Expected: the sidebar lists "1. What a transformer does" and "2. Inside attention" (h2 entries). Clicking an entry scrolls to that section. Hovering a heading shows a `#` that links to it. The URL gains `#1-what-a-transformer-does` etc.

- [ ] **Step 3: Commit**

```bash
git add assets/js/reference.js
git commit -m "feat: auto-built TOC and heading anchors"
```

---

### Task 3: Scrollspy — highlight the current section in the TOC

Use `IntersectionObserver` to mark the TOC entry for the section currently in view with `.active`.

**Files:**
- Modify: `assets/js/reference.js`

**Interfaces:**
- Consumes: `headings` node list and the `.ref-toc a[href="#id"]` links built in Task 2.
- Produces: at most one `.ref-toc a.active` at a time.

- [ ] **Step 1: Append the scrollspy block to the IIFE (before its closing `})();`)**

```javascript
  // --- Scrollspy ---
  var tocLinks = {};
  if (tocEl) {
    Array.prototype.slice.call(tocEl.querySelectorAll('a')).forEach(function (a) {
      tocLinks[a.getAttribute('href').slice(1)] = a;
    });
  }
  var visible = {};
  function refreshActive() {
    var current = null;
    headings.forEach(function (h) {
      if (visible[h.id]) { current = current || h.id; }
    });
    Object.keys(tocLinks).forEach(function (id) {
      tocLinks[id].classList.toggle('active', id === current);
    });
  }
  if ('IntersectionObserver' in window && headings.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      refreshActive();
    }, { rootMargin: '0px 0px -75% 0px', threshold: 0 });
    headings.forEach(function (h) { spy.observe(h); });
  }
```

- [ ] **Step 2: Build and verify scrollspy**

Rebuild, open the page, scroll. Expected: as each section reaches the top region, its TOC entry turns accent-colored (`.active`) and the previous one un-highlights. Exactly one entry is active at a time.

- [ ] **Step 3: Commit**

```bash
git add assets/js/reference.js
git commit -m "feat: scrollspy highlights current TOC section"
```

---

### Task 4: KaTeX math rendering

Load KaTeX + its auto-render extension from CDN in the layout, configured to render `$…$` / `$$…$$` and to **ignore code/pre**. Convert the Task 1 stub's display formula to LaTeX to prove rendering end-to-end.

**Files:**
- Modify: `_layouts/reference.html`
- Modify: `_writing/transformers.md`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: math delimiters `$…$` (inline) and `$$…$$` (display) render via KaTeX; fenced code blocks are left untouched.

- [ ] **Step 1: Add KaTeX to `_layouts/reference.html` `<head>`**

```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
```

- [ ] **Step 2: Add the auto-render trigger before `reference.js` (end of body)**

Place this `<script>` immediately **above** the existing `<script src="/assets/js/reference.js"></script>` line:

```html
  <script>
    document.addEventListener("DOMContentLoaded", function () {
      if (window.renderMathInElement) {
        renderMathInElement(document.querySelector(".ref-body"), {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ],
          ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
          throwOnError: false
        });
      }
    });
  </script>
```

- [ ] **Step 3: Convert the stub's display formula to LaTeX in `_writing/transformers.md`**

Replace the plain-text formula block in §2 (the fenced ``` block containing `Attn(X) = …`) with a display-math line. Keep the `python` code block exactly as-is.

```markdown
The scaled dot-product attention:

$$\mathrm{Attn}(X) = \mathrm{softmax}\!\left( \mathrm{mask}\!\left( \frac{Q\cdot K^{\top}}{\sqrt{d_k}} \right) \right) \cdot V$$
```

- [ ] **Step 4: Build and verify KaTeX**

Rebuild, open the page. Expected: the `Attn(X)` formula renders as typeset math (real fraction bar, √, superscript ⊤). The `python` code block is **unchanged** (no math substitution inside it). No KaTeX console errors.

- [ ] **Step 5: Verify the kramdown × KaTeX escaping caveat**

In `.ref-body`, confirm a subscript like `d_k` inside `$…$` renders correctly and that underscores in surrounding prose/code are not turned into `<em>`. If kramdown mangles a formula, wrap the offending span per KaTeX docs or adjust delimiters — document any workaround inline in the markdown. This is the spec's flagged risk; resolve it now on one formula before Task 8 migrates them all.

- [ ] **Step 6: Commit**

```bash
git add _layouts/reference.html _writing/transformers.md
git commit -m "feat: KaTeX math rendering for reference pages"
```

---

### Task 5: In-page search (filter TOC + highlight body)

A sidebar search box that filters TOC entries by section title and highlights matches in the body, with a result count and Enter-to-jump.

**Files:**
- Modify: `assets/js/reference.js`
- Modify: `_layouts/reference.html` (add `.ref-search` styles)

**Interfaces:**
- Consumes: `.ref-search` mount, `headings`, `tocLinks`, `.ref-body`.
- Produces: live filtering of `.ref-toc li` visibility; `<mark class="ref-hit">` wrappers around body matches; a result counter element.

- [ ] **Step 1: Add search-box styles to `_layouts/reference.html` `<style>`**

```css
    .ref-search input { width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem;
      background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px;
      color: var(--text); font-size: 0.9rem; }
    .ref-search input::placeholder { color: var(--muted); }
    .ref-search .ref-count { color: var(--muted); font-size: 0.8rem; margin-top: 0.3rem; min-height: 1em; }
    .ref-body mark.ref-hit { background: rgba(91,157,255,0.28); color: #fff; border-radius: 3px; }
    .ref-body mark.ref-hit.current { background: var(--accent); color: #0b0e13; }
```

- [ ] **Step 2: Append the search block to the IIFE in `assets/js/reference.js`**

```javascript
  // --- In-page search ---
  var searchMount = document.querySelector('.ref-search');
  if (searchMount) {
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search this page…';
    input.setAttribute('aria-label', 'Search this page');
    var count = document.createElement('div');
    count.className = 'ref-count';
    searchMount.appendChild(input);
    searchMount.appendChild(count);

    var hits = [];
    var cursor = -1;

    function clearHighlights() {
      body.querySelectorAll('mark.ref-hit').forEach(function (m) {
        var t = document.createTextNode(m.textContent);
        m.parentNode.replaceChild(t, m);
      });
      body.normalize();
      hits = [];
      cursor = -1;
    }

    function highlight(term) {
      var lower = term.toLowerCase();
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node.nodeValue.toLowerCase().includes(lower)) return NodeFilter.FILTER_REJECT;
          var p = node.parentNode;
          // skip code, the anchors, and already-marked nodes
          if (p.closest('code, pre, .anchor, mark')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var targets = [];
      while (walker.nextNode()) targets.push(walker.currentNode);
      targets.forEach(function (node) {
        var text = node.nodeValue, idx, last = 0, frag = document.createDocumentFragment();
        var lc = text.toLowerCase();
        while ((idx = lc.indexOf(lower, last)) !== -1) {
          if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
          var mark = document.createElement('mark');
          mark.className = 'ref-hit';
          mark.textContent = text.slice(idx, idx + term.length);
          frag.appendChild(mark);
          hits.push(mark);
          last = idx + term.length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    }

    function filterToc(term) {
      var lower = term.toLowerCase();
      Object.keys(tocLinks).forEach(function (id) {
        var li = tocLinks[id].parentNode;
        li.style.display = (!term || tocLinks[id].textContent.toLowerCase().includes(lower)) ? '' : 'none';
      });
    }

    function run() {
      clearHighlights();
      var term = input.value.trim();
      filterToc(term);
      if (!term) { count.textContent = ''; return; }
      highlight(term);
      count.textContent = hits.length + (hits.length === 1 ? ' match' : ' matches');
      if (hits.length) { cursor = 0; focusHit(); }
    }

    function focusHit() {
      hits.forEach(function (m, i) { m.classList.toggle('current', i === cursor); });
      if (hits[cursor]) hits[cursor].scrollIntoView({ block: 'center' });
    }

    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && hits.length) {
        e.preventDefault();
        cursor = (cursor + (e.shiftKey ? -1 + hits.length : 1)) % hits.length;
        focusHit();
      }
    });
  }
```

- [ ] **Step 3: Build and verify search**

Rebuild, open the page. Type `attention`. Expected: the result count shows N matches, matches are highlighted in the body, the first is centered and accent-colored, and the TOC collapses to entries whose titles match. Pressing Enter cycles to the next match. Clearing the box restores the full TOC and removes all highlights. Verify highlighting never touches text inside `code`/`pre`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/reference.js _layouts/reference.html
git commit -m "feat: in-page search with TOC filter and match highlight"
```

---

### Task 6: Marker badges + status panel

Style `[OPEN]`/`[STUB]`/`[EXT]` as inline badges and build a status panel that counts them and cycles through their positions.

**Files:**
- Modify: `assets/js/reference.js`
- Modify: `_layouts/reference.html` (badge + panel styles)

**Interfaces:**
- Consumes: `.ref-status` mount, `.ref-body`.
- Produces: each literal `[OPEN|STUB|EXT]` in body text wrapped as `<span class="marker marker--{open|stub|ext}">`; a status panel with three clickable counters that scroll through markers of that kind.

- [ ] **Step 1: Add marker + status styles to `_layouts/reference.html` `<style>`**

```css
    .ref-body .marker { font-family: ui-monospace, monospace; font-size: 0.72em; font-weight: 600;
      padding: 0.05em 0.4em; border-radius: 4px; vertical-align: middle; letter-spacing: 0.03em; }
    .ref-body .marker--open { background: rgba(255,107,107,0.18); color: #ff9b9b; border: 1px solid rgba(255,107,107,0.4); }
    .ref-body .marker--stub { background: rgba(255,196,0,0.16); color: #ffd166; border: 1px solid rgba(255,196,0,0.4); }
    .ref-body .marker--ext  { background: rgba(91,157,255,0.16); color: #8fbcff; border: 1px solid rgba(91,157,255,0.4); }
    .ref-status .ref-status-row { display: flex; gap: 0.4rem; }
    .ref-status button { flex: 1; cursor: pointer; background: var(--card); border: 1px solid var(--border);
      border-radius: 6px; color: var(--muted); font-size: 0.78rem; padding: 0.35rem 0.2rem; text-align: center; }
    .ref-status button:hover { color: var(--text); border-color: var(--accent); }
    .ref-status button .n { display: block; font-size: 1.05rem; font-weight: 600; color: var(--text); }
```

- [ ] **Step 2: Append the markers block to the IIFE in `assets/js/reference.js`**

Run this **before** the search block builds its TreeWalker indices is not required, but it must run after `body` is defined. Place it near the end of the IIFE.

```javascript
  // --- Marker badges + status panel ---
  var MARKERS = [
    { key: 'open', label: 'OPEN', token: '[OPEN]' },
    { key: 'stub', label: 'STUB', token: '[STUB]' },
    { key: 'ext',  label: 'EXT',  token: '[EXT]'  }
  ];
  var markerNodes = { open: [], stub: [], ext: [] };

  MARKERS.forEach(function (m) {
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue.includes(m.token)) return NodeFilter.FILTER_REJECT;
        if (node.parentNode.closest('code, pre, .anchor, .marker')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);
    targets.forEach(function (node) {
      var parts = node.nodeValue.split(m.token);
      var frag = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i > 0) {
          var span = document.createElement('span');
          span.className = 'marker marker--' + m.key;
          span.textContent = m.label;
          frag.appendChild(span);
          markerNodes[m.key].push(span);
        }
        if (part) frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    });
  });

  var statusMount = document.querySelector('.ref-status');
  if (statusMount) {
    var row = document.createElement('div');
    row.className = 'ref-status-row';
    MARKERS.forEach(function (m) {
      var nodes = markerNodes[m.key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="n">' + nodes.length + '</span>' + m.label;
      btn.disabled = nodes.length === 0;
      var i = 0;
      btn.addEventListener('click', function () {
        if (!nodes.length) return;
        nodes[i % nodes.length].scrollIntoView({ block: 'center' });
        i++;
      });
      row.appendChild(btn);
    });
    statusMount.appendChild(row);
  }
```

- [ ] **Step 3: Build and verify markers + panel**

Rebuild, open the page. Expected: the stub's `[OPEN]`, `[STUB]`, `[EXT]` render as colored badges in the body (red/amber/blue). The sidebar status panel shows `1 OPEN · 1 STUB · 1 EXT`. Clicking a counter scrolls to that marker; clicking again cycles to the next (with one each, it re-centers the same one). Verify no badge appears inside the `python` code block.

- [ ] **Step 4: Commit**

```bash
git add assets/js/reference.js _layouts/reference.html
git commit -m "feat: marker badges and status panel"
```

---

### Task 7: Responsive layout (< 900px)

Below ~900px, collapse the sidebar into a disclosure at the top and let the body go full-width.

**Files:**
- Modify: `_layouts/reference.html`

**Interfaces:**
- Consumes: existing `.ref`, `.ref-sidebar` structure.
- Produces: a single-column layout under 900px with the sidebar above the body.

- [ ] **Step 1: Add a media query to `_layouts/reference.html` `<style>`**

```css
    @media (max-width: 900px) {
      .ref { grid-template-columns: 1fr; gap: 1.25rem; }
      .ref-sidebar { position: static; max-height: none; overflow: visible;
        border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
      .ref-toc { max-height: 40vh; overflow-y: auto; }
    }
```

- [ ] **Step 2: Build and verify responsive**

Rebuild, open the page, narrow the window below 900px (or use devtools device emulation). Expected: the layout becomes one column with search + status + TOC stacked above the body; nothing overflows horizontally; the body uses full width. Above 900px, the two-column layout is unchanged.

- [ ] **Step 3: Commit**

```bash
git add _layouts/reference.html
git commit -m "feat: responsive single-column reference layout under 900px"
```

---

### Task 8: Full content migration (the real document)

Replace the stub body with the full source document, converting every math formula to LaTeX, rewriting the intro note, and keeping all markers. This is the laborious, careful task — work **section by section**, verifying each in the browser.

**Files:**
- Modify: `_writing/transformers.md`
- Source (read-only reference): `~/Downloads/transformers-a-telling-to-myself.md`

**Interfaces:**
- Consumes: the layout + JS behaviors from Tasks 1–7 (all keyed on rendered DOM, so they apply automatically to the full content).
- Produces: the complete published document at `/writing/transformers/`.

- [ ] **Step 1: Copy the full source body under the existing frontmatter**

Keep the Task 1 frontmatter block. Replace everything below it with the full prose of `~/Downloads/transformers-a-telling-to-myself.md` (sections 1–7), **before** any math conversion. Leave fenced ```` ```python ```` and ```` ```text ```` code/diagram blocks as code for now.

- [ ] **Step 2: Rewrite the intro notation note**

The source's opening blockquote ("Math is written in plain text … renders in any markdown viewer without a LaTeX engine") is now false. Replace it with a note describing the conventions as rendered math, e.g.:

```markdown
> **Notation.** Math is typeset with KaTeX. Dimensions are explicit: $\times$ is a
> dimension product, $\cdot$ a matrix/scalar product, $^{\top}$ transpose,
> $\mathbb{R}^{a\times b}$ real matrices of that shape. Symbols are defined in §2.
```

- [ ] **Step 3: Convert formulas to LaTeX, section by section**

Apply this notation mapping to every **math** block and inline math (NOT to `python`/`text` code blocks):

| Source | LaTeX |
|---|---|
| `×` | `\times` |
| `·` | `\cdot` |
| `^T` | `^{\top}` |
| `_x` (subscript) | `_{x}` |
| `sqrt(...)` | `\sqrt{...}` |
| `Σ_j` | `\sum_j` |
| `ℝ^(a×b)` | `\mathbb{R}^{a\times b}` |
| `softmax`, `mask`, `Attn`, `Concat` | `\mathrm{softmax}` etc. |
| `-∞` | `-\infty` |
| `≤` | `\le` |
| bracket matrices (§3.7, §3.5) | `\begin{bmatrix} … \end{bmatrix}` / `\begin{pmatrix}` |

Display blocks become `$$…$$`; inline backticked math becomes `$…$`. Convert one section, save, rebuild, eyeball it, then move to the next. Specific blocks needing care:
- §3.5 the masked-softmax line and the dimension lines `(T × T)(T × d_v) = T × d_v`.
- §3.6 the per-position `A_ij`, `v_j`, `r_i` system → an `aligned` environment: `$$\begin{aligned} A_{ij} &= \dots \\ r_i &= \sum_j A_{ij}\,v_j \end{aligned}$$`.
- §3.7 the multi-head `W_O · [r^h1; …]` block → `bmatrix`.
- §5.1 the QK/OV bilinear forms and the softmax denominator.

**Do not change any number, dimension, or the PyTorch code** — only the math representation (Global Constraints / style guide).

- [ ] **Step 4: Decide per code-ish block: math or code?**

The source has plain fenced blocks that are *dimension reasoning / diagrams* (e.g. the `x_{t+1} = f(...)` autoregressive line, the multi-head bracket diagram). Convert these to `$$…$$` math. Keep genuine program listings (the `def attention(...)` block) as ```` ```python ````. When unsure, prefer code block if it contains Python syntax, math if it's notation.

- [ ] **Step 5: Full build + visual pass**

Rebuild, open `http://localhost:4000/writing/transformers/`. Walk the whole page top to bottom:
- Every formula renders as typeset math; no stray `$` or raw LaTeX visible; no `\times`-as-text.
- All `python` blocks render as highlighted code, unchanged.
- TOC lists all of §1–§7 (and h3 subsections); scrollspy tracks while scrolling the full doc.
- Search across the full text works and never highlights inside code.
- Status panel counts match the real marker totals in the source; each counter cycles through all of its markers.
- Tables (the §2 dimensions table) render with borders and fit the wide column.

- [ ] **Step 6: Cross-check formulas against the source**

Open `~/Downloads/transformers-a-telling-to-myself.md` side by side. For each converted formula, confirm the rendered math is mathematically identical to the original (same symbols, subscripts, dimensions). Fix any discrepancy.

- [ ] **Step 7: Commit**

```bash
git add _writing/transformers.md
git commit -m "content: migrate full transformers reference with LaTeX math"
```

---

### Task 9: Final verification pass

A clean end-to-end check that the whole feature works together, and the home integration is intact.

**Files:** none (verification only).

- [ ] **Step 1: Clean build**

Remove `_site/` and rebuild from scratch:
```bash
rm -rf _site && jekyll build
```
Expected: build succeeds with no warnings about the reference page or transformers doc.

- [ ] **Step 2: Full manual checklist at `http://localhost:4000/writing/transformers/`**

Confirm, in one sitting: KaTeX math, TOC + scrollspy, heading anchors (URL updates, deep-link reload lands at the section), in-page search (filter + highlight + Enter-cycle, code excluded), marker badges + status panel counts/cycling, responsive < 900px, and `← Home` works.

- [ ] **Step 3: Home + listing check**

Open `http://localhost:4000/`. Expected: the Transformers card shows in the Writing scroller with title/summary/tags/year, and clicking it lands on the reference page.

- [ ] **Step 4: No regressions to existing articles**

Open one existing essay (e.g. `http://localhost:4000/writing/progress-dashboard-tests/`). Expected: unchanged — it still uses `article.html`, narrow column, no sidebar. (Confirms the new layout/JS/CSS is fully scoped and didn't leak.)

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore: final verification fixes for transformers reference"
```

---

## Self-Review

**Spec coverage:**
- Single page + sidebar TOC → Tasks 1–3. ✓
- Anchors on `§` → Task 2. ✓
- KaTeX math + migration → Tasks 4, 8. ✓
- In-page search → Task 5. ✓
- Marker badges + status panel → Task 6. ✓
- Responsive → Task 7. ✓
- Approach A integration (layout + `_writing` item, no config/home changes) → Task 1, verified Task 9 step 3–4. ✓
- KaTeX × kramdown risk → Task 4 step 5 (early, before full migration). ✓
- Read-only / author-edits-source → no reader editing UI in any task. ✓
- Live `§N.M` cross-ref links → correctly **out of scope** (spec), absent from plan. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code. ✓

**Type/name consistency:** `slugify`, `headings`, `tocLinks`, `markerNodes`, `.ref-body`, `.ref-toc`, `.ref-search`, `.ref-status`, `.marker--{open,stub,ext}` are defined once and reused with the same names across tasks. ✓
