# Filterable Projects + Writing Portfolio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded "Featured" bear-detector landing page with two filterable sections (Projects + Writing), a tag/year sidebar, Jekyll collections, and per-project pages that embed the live demo.

**Architecture:** Static Jekyll site on GitHub Pages. Two collections (`_projects`, `_writing`) provide one markdown file per item. `index.html` uses Liquid to render the cards and to compute the sidebar's tag/year lists at build time; a small inline vanilla-JS script does live single-select show/hide at runtime. The dark theme is extracted into a shared stylesheet so the new project layout reuses it.

**Tech Stack:** Jekyll (via the `github-pages` gem), Liquid, kramdown, vanilla JS, plain CSS. No frameworks, no plugins beyond GitHub Pages defaults.

**Spec:** `docs/superpowers/specs/2026-06-03-portfolio-filterable-projects-design.md`

**Verification model:** There is no JS/Liquid unit-test runner for a static site. Each task's "red/green" is a **build + grep on the generated `_site/`**: first confirm the feature is absent, implement, then confirm it is present. The filter script is additionally smoke-tested manually with `jekyll serve` in the final task.

**Build command (this environment):** bundler is user-installed and the bundle path is local, so every build/serve must be prefixed with the user gem bin on PATH. The canonical command used in all verification steps below is:

```bash
export PATH="$HOME/.local/share/gem/ruby/3.2.0/bin:$PATH" && cd /home/rp/git/rp-playground/rp-playground.github.io && bundle exec jekyll build
```

System packages `ruby-dev` + `build-essential` must be present (needed to compile native gems like nokogiri); they were installed during Task 1 setup.

---

## File Structure

- `Gemfile` — **create**. Pins the `github-pages` gem so the site builds locally exactly as on GitHub Pages.
- `.gitignore` — **modify**. Ignore Jekyll build output (`_site/`, `.jekyll-cache/`, `vendor/`, `Gemfile.lock` optional-keep).
- `_config.yml` — **modify**. Declare the `projects` and `writing` collections.
- `assets/css/main.css` — **create**. Shared dark theme (CSS variables, base typography, `.card`, `.tag`, header) used by the landing page, the article layout, and the project layout.
- `_layouts/article.html` — **modify**. Drop the duplicated inline theme; link `main.css`; keep only article-specific reading-measure rules.
- `_layouts/project.html` — **create**. Renders one project page: header, embedded demo iframe, repo/write-up links, then the markdown body.
- `_writing/ood-detection.md` — **create via move** of `writing/ood-detection.md` (preserves `/writing/ood-detection/`).
- `_projects/bear-detector.md` — **create**. The bear-detector project entry (front matter + short body).
- `index.html` — **modify (rewrite)**. Front matter + sidebar + two card sections + filter script.

---

## Task 1: Local Jekyll build setup

**Files:**
- Create: `Gemfile`
- Modify: `.gitignore`, `_config.yml`

> **Note:** This task was executed by the controller during setup (toolchain
> bootstrap, analogous to creating a worktree). It is recorded here as-built so
> reviewers and any re-run match reality.

- [ ] **Step 1: System prerequisites**

`ruby-dev` and `build-essential` must be installed (native gems like nokogiri
need a C toolchain + ruby headers):

```bash
sudo apt-get install -y ruby-dev build-essential
```

- [ ] **Step 2: Create the Gemfile**

Create `Gemfile`:

```ruby
source "https://rubygems.org"

# Matches the GitHub Pages build environment (Jekyll 3.10 + supported plugins),
# so a local `bundle exec jekyll build` reproduces production.
gem "github-pages", group: :jekyll_plugins

# Jekyll 4 dropped these from stdlib; needed on Ruby 3.x.
gem "webrick"
```

- [ ] **Step 3: Install bundler (user) + the gems (local path)**

```bash
gem install bundler --user-install --no-document
export PATH="$HOME/.local/share/gem/ruby/3.2.0/bin:$PATH"
bundle config set --local path vendor/bundle
bundle install
```
Expected: `Bundle complete!`.

- [ ] **Step 4: Ignore build output**

Append to `.gitignore` (it already contains `.superpowers/`):

```
_site/
.jekyll-cache/
vendor/
```

- [ ] **Step 5: Exclude tooling + design docs from the site**

Add an `exclude:` block to `_config.yml` so Jekyll does not try to render
`docs/` (its fenced Liquid examples break the build) or the build tooling:

```yaml
exclude:
  - docs/
  - vendor/
  - Gemfile
  - Gemfile.lock
  - README.md
  - .superpowers/
```

- [ ] **Step 6: Verify the current site builds**

Run: `export PATH="$HOME/.local/share/gem/ruby/3.2.0/bin:$PATH" && bundle exec jekyll build`
Expected: `done in X.XXX seconds`.
Run: `test -f _site/writing/ood-detection/index.html && echo OK`
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add Gemfile Gemfile.lock .gitignore _config.yml
git commit -m "build: add local Jekyll (github-pages gem); exclude docs/tooling from site"
```

---

## Task 2: Extract the shared theme into `assets/css/main.css`

The dark theme is duplicated inline in `index.html` and `_layouts/article.html`. Extract the shared parts so the new project layout reuses them instead of adding a third copy. Behavior must not change.

**Files:**
- Create: `assets/css/main.css`
- Modify: `_layouts/article.html` (replace inline shared theme with a `<link>`)

- [ ] **Step 1: Confirm there is no shared stylesheet yet (red)**

Run: `test -f assets/css/main.css && echo EXISTS || echo MISSING`
Expected: `MISSING`

- [ ] **Step 2: Create `assets/css/main.css`**

```css
/* Shared dark theme — used by index.html, article.html, project.html. */
:root {
  --bg: #0f1115;
  --card: #1a1d24;
  --text: #e6e8eb;
  --muted: #9aa0a8;
  --accent: #5b9dff;
  --border: #2a2e37;
  --code-bg: #14171d;
  --measure: 700px;
  --media: 960px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); }

/* Shared card + tag components */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.4rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
  display: block;
}
.card:hover { border-color: var(--accent); transform: translateY(-2px); }
.card h3 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.4rem; }
.card p { color: var(--muted); font-size: 0.9rem; }
.tags { margin-top: 0.9rem; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.tag {
  font-size: 0.72rem; color: var(--accent);
  background: rgba(91,157,255,0.1); padding: 0.2rem 0.55rem; border-radius: 6px;
}
```

- [ ] **Step 3: Point `article.html` at the shared stylesheet**

In `_layouts/article.html`, replace the entire `<style>…</style>` block in `<head>` with a link plus the **article-only** rules. The new `<head>` style section becomes:

```html
  <link rel="stylesheet" href="/assets/css/main.css">
  <style>
    /* Article-only: reading measure + prose typography */
    .topbar { max-width: var(--media); margin: 0 auto; padding: 1.5rem 1.5rem 0; }
    .topbar a { font-size: 0.9rem; text-decoration: none; color: var(--muted); }
    .topbar a:hover { color: var(--accent); }

    .article { max-width: var(--media); margin: 0 auto; padding: 2rem 1.5rem 5rem; }
    .article > * { max-width: var(--measure); margin-left: auto; margin-right: auto; }
    .article > .highlighter-rouge,
    .article > div.highlight,
    .article > pre,
    .article > table,
    .article > figure { max-width: var(--media); }

    .article-header { margin-bottom: 2.5rem; }
    .article-header h1 { font-size: 2.4rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
    .article-meta { color: var(--muted); font-size: 0.95rem; margin-top: 0.8rem; }

    .article p, .article li { font-size: 1.15rem; line-height: 1.75; color: #d7dade; }
    .article p { margin: 1.3rem auto; }
    .article ul, .article ol { margin: 1.3rem auto; padding-left: 1.4rem; }
    .article li { margin: 0.5rem auto; }
    .article li > ul, .article li > ol { margin: 0.5rem 0; }

    .article h2 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; margin: 3rem auto 1rem; padding-top: 0.5rem; }
    .article h3 { font-size: 1.15rem; font-weight: 600; color: var(--muted); margin: 2rem auto 0.8rem; text-transform: none; }

    .article strong { color: #fff; }
    .article em { color: #c8ccd2; }
    .article a { text-decoration: none; border-bottom: 1px solid rgba(91,157,255,0.35); }
    .article a:hover { border-bottom-color: var(--accent); }

    .article blockquote { border-left: 3px solid var(--accent); padding: 0.2rem 0 0.2rem 1.3rem; margin: 1.6rem auto; color: var(--muted); font-style: italic; }
    .article blockquote p { font-size: 1.08rem; color: var(--muted); }

    .article code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 0.88em; background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 5px; border: 1px solid var(--border); }
    .article pre, .article .highlighter-rouge, .article .highlight { background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; margin: 1.6rem auto; overflow-x: auto; }
    .article pre, .article .highlight pre { padding: 1rem 1.2rem; }
    .article pre code { background: none; border: none; padding: 0; font-size: 0.92rem; line-height: 1.6; color: var(--text); }

    .article table { width: 100%; border-collapse: collapse; margin: 1.8rem auto; font-size: 1rem; }
    .article th, .article td { border: 1px solid var(--border); padding: 0.6rem 0.9rem; text-align: left; vertical-align: middle; }
    .article th { background: var(--card); font-weight: 600; }
    .article td img { display: block; max-width: 100%; height: auto; margin: 0 auto; border-radius: 10px; }
    .article table:has(img) td { text-align: center; }

    .article hr { border: none; border-top: 1px solid var(--border); margin: 3rem auto; }

    footer { max-width: var(--measure); margin: 0 auto; padding: 0 1.5rem 4rem; color: var(--muted); font-size: 0.85rem; }
  </style>
```

Leave the rest of `_layouts/article.html` (`<body>` and below) unchanged.

- [ ] **Step 4: Build and verify the article still renders themed (green)**

Run: `bundle exec jekyll build && grep -q 'assets/css/main.css' _site/writing/ood-detection/index.html && echo LINKED`
Expected: `LINKED`
Run: `test -f _site/assets/css/main.css && echo CSS_OK`
Expected: `CSS_OK`

- [ ] **Step 5: Commit**

```bash
git add assets/css/main.css _layouts/article.html
git commit -m "refactor: extract shared dark theme into assets/css/main.css"
```

---

## Task 3: Declare collections and migrate the writing article

**Files:**
- Modify: `_config.yml`
- Move: `writing/ood-detection.md` → `_writing/ood-detection.md`

- [ ] **Step 1: Add the collections to `_config.yml`**

Append to `_config.yml` (after the existing kramdown block):

```yaml
collections:
  projects:
    output: true
    permalink: /projects/:name/
  writing:
    output: true
    permalink: /writing/:name/
```

- [ ] **Step 2: Move the article into the writing collection**

Run: `git mv writing/ood-detection.md _writing/ood-detection.md`
The file already has `layout: article`, `title`, `date: 2026-06-02`, and `permalink: /writing/ood-detection/`. Add a `tags` line and a `summary` line to its front matter so it powers the sidebar and the card. The front matter becomes:

```yaml
---
layout: article
title: 'Teaching a bear detector to say "I don''t know"'
description: A post-hoc out-of-distribution study on a 3-class bear classifier — MSP vs energy, far-OOD vs near-OOD, and an honest negative result.
summary: A post-hoc out-of-distribution study on the bear classifier — MSP vs energy, far- vs near-OOD, and an honest negative result.
date: 2026-06-02
tags: [PyTorch, OOD detection, calibration]
permalink: /writing/ood-detection/
---
```

- [ ] **Step 3: Build and verify the URL is preserved and the item is in the collection (green)**

Run: `bundle exec jekyll build && test -f _site/writing/ood-detection/index.html && echo URL_OK`
Expected: `URL_OK` (the live URL is unchanged)
Run: `rmdir writing 2>/dev/null; test -d writing && echo "still exists" || echo "old dir gone"`
Expected: `old dir gone`

- [ ] **Step 4: Commit**

```bash
git add _config.yml _writing/ood-detection.md
git commit -m "feat: add projects/writing collections; migrate OOD article (URL preserved)"
```

---

## Task 4: Project layout + bear-detector project page

**Files:**
- Create: `_layouts/project.html`
- Create: `_projects/bear-detector.md`

- [ ] **Step 1: Confirm the project route does not exist yet (red)**

Run: `bundle exec jekyll build; test -f _site/projects/bear-detector/index.html && echo EXISTS || echo MISSING`
Expected: `MISSING`

- [ ] **Step 2: Create `_layouts/project.html`**

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
    .project { max-width: var(--media); margin: 0 auto; padding: 2rem 1.5rem 5rem; }
    .project-header h1 { font-size: 2.4rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
    .project-meta { color: var(--muted); font-size: 0.95rem; margin-top: 0.8rem; }
    .project .links { margin: 1.2rem 0; display: flex; gap: 1.2rem; }
    .project .links a { font-size: 0.95rem; text-decoration: none; }
    .embed-wrap { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--card); margin: 1.5rem 0; }
    .embed-wrap iframe { width: 100%; height: 640px; border: none; display: block; }
    .project-body { margin-top: 2rem; }
    .project-body p, .project-body li { font-size: 1.1rem; line-height: 1.7; color: #d7dade; }
    .project-body p { margin: 1.2rem 0; }
    .project-body h2 { font-size: 1.4rem; margin: 2.2rem 0 0.8rem; }
    footer { max-width: var(--media); margin: 0 auto; padding: 0 1.5rem 4rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="topbar"><a href="/">← Home</a></div>
  <article class="project">
    <header class="project-header">
      <h1>{{ page.title }}</h1>
      <p class="project-meta">{% if page.date %}{{ page.date | date: "%B %Y" }}{% endif %}</p>
      {% if page.tags %}
      <div class="tags">
        {% for t in page.tags %}<span class="tag">{{ t }}</span>{% endfor %}
      </div>
      {% endif %}
    </header>

    {% if page.repo or page.writeup %}
    <div class="links">
      {% if page.repo %}<a href="{{ page.repo }}" target="_blank" rel="noopener">Source ↗</a>{% endif %}
      {% if page.writeup %}<a href="{{ page.writeup }}">Write-up →</a>{% endif %}
    </div>
    {% endif %}

    {% if page.demo %}
    <div class="embed-wrap">
      <iframe src="{{ page.demo }}?__theme=dark" loading="lazy" title="{{ page.title }} — live demo" allow="camera"></iframe>
    </div>
    {% endif %}

    <div class="project-body">
      {{ content }}
    </div>
  </article>
  <footer>Built with Jekyll · hosted on GitHub Pages · <a href="/">back home</a></footer>
</body>
</html>
```

- [ ] **Step 3: Create `_projects/bear-detector.md`**

```markdown
---
layout: project
title: Bear detector
summary: A 3-class bear classifier (black / grizzly / teddy) with a live out-of-distribution panel.
date: 2026-06-01
tags: [PyTorch, OOD detection, calibration]
demo: https://rfflpllcn-bear-detector.hf.space
repo: https://github.com/rp-playground/play-pytorch/tree/main/course.fast.ai/lesson2
writeup: /writing/ood-detection/
---

A ResNet-18 transfer-learned onto a 3-class head, built in pure PyTorch from
[fast.ai lesson 2](https://course.fast.ai/Lessons/lesson2.html). Upload a bear
and it returns per-class probabilities — plus a **live OOD panel**: the energy
score, an honest in-distribution / out-of-distribution verdict, and a TPR slider
that moves the decision threshold so you can watch the trade-off in real time.

It is **closed-set**: feed it a non-bear and softmax still confidently picks a
bear. Rather than hand-wave that failure, I measured it — the
[write-up](/writing/ood-detection/) compares MSP and energy as post-hoc OOD
signals on real data, with an honest negative result on the near-OOD case.
```

- [ ] **Step 4: Build and verify the project page renders the embed + links (green)**

Run: `bundle exec jekyll build && test -f _site/projects/bear-detector/index.html && echo PAGE_OK`
Expected: `PAGE_OK`
Run: `grep -q 'rfflpllcn-bear-detector.hf.space' _site/projects/bear-detector/index.html && grep -q 'Write-up' _site/projects/bear-detector/index.html && echo EMBED_OK`
Expected: `EMBED_OK`

- [ ] **Step 5: Commit**

```bash
git add _layouts/project.html _projects/bear-detector.md
git commit -m "feat: project layout + bear-detector page with embedded live demo"
```

---

## Task 5: Rewrite `index.html` — sidebar + two card sections

**Files:**
- Modify (rewrite): `index.html`

- [ ] **Step 1: Confirm the landing page has no filter sidebar yet (red)**

Run: `bundle exec jekyll build && grep -q 'data-year' _site/index.html && echo HAS || echo MISSING`
Expected: `MISSING`

- [ ] **Step 2: Rewrite `index.html`**

Replace the entire file with:

```html
---
# Front matter (even empty) makes Jekyll process the Liquid below.
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raffaele P. — ML Projects</title>
  <link rel="stylesheet" href="/assets/css/main.css">
  <style>
    .container { max-width: 1040px; margin: 0 auto; padding: 4rem 1.5rem; }
    header.site { margin-bottom: 3rem; }
    header.site h1 { font-size: 2.2rem; font-weight: 600; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 1.1rem; margin-top: 0.5rem; }
    .links { margin-top: 1.2rem; display: flex; gap: 1.2rem; }
    .links a { color: var(--accent); text-decoration: none; font-size: 0.95rem; }
    .links a:hover { text-decoration: underline; }

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
    section.item-section + section.item-section { margin-top: 2.5rem; }
    .grid { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .item-card .meta-year { margin-left: auto; color: var(--muted); font-size: 0.72rem; }

    footer { margin-top: 4rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <header class="site">
      <h1>Raffaele P.</h1>
      <p class="subtitle">Applied ML · domain-driven AI systems</p>
      <div class="links">
        <!-- TODO: real links -->
        <a href="https://github.com/YOUR_USERNAME">GitHub</a>
        <a href="https://linkedin.com/in/YOUR_HANDLE">LinkedIn</a>
        <a href="mailto:you@example.com">Email</a>
      </div>
    </header>

    {%- comment -%} Build the union of tags and years across both collections. {%- endcomment -%}
    {%- assign all_items = site.projects | concat: site.writing -%}
    {%- assign tag_acc = "" -%}
    {%- assign year_acc = "" -%}
    {%- for item in all_items -%}
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
        {%- assign projects = site.projects | sort: "date" | reverse -%}
        {%- if projects.size > 0 -%}
        <section class="item-section">
          <h2>Projects</h2>
          <div class="grid">
            {%- for p in projects -%}
            <a class="card item-card" href="{{ p.url }}"
               data-tags="|{{ p.tags | join: '|' }}|" data-year="{{ p.date | date: '%Y' }}">
              <h3>{{ p.title }}</h3>
              <p>{{ p.summary }}</p>
              <div class="tags">
                {%- for t in p.tags -%}<span class="tag">{{ t }}</span>{%- endfor -%}
                <span class="meta-year">{{ p.date | date: "%Y" }}</span>
              </div>
            </a>
            {%- endfor -%}
          </div>
        </section>
        {%- endif -%}

        {%- assign writing = site.writing | sort: "date" | reverse -%}
        {%- if writing.size > 0 -%}
        <section class="item-section">
          <h2>Writing</h2>
          <div class="grid">
            {%- for w in writing -%}
            <a class="card item-card" href="{{ w.url }}"
               data-tags="|{{ w.tags | join: '|' }}|" data-year="{{ w.date | date: '%Y' }}">
              <h3>{{ w.title }}</h3>
              <p>{{ w.summary }}</p>
              <div class="tags">
                {%- for t in w.tags -%}<span class="tag">{{ t }}</span>{%- endfor -%}
                <span class="meta-year">{{ w.date | date: "%Y" }}</span>
              </div>
            </a>
            {%- endfor -%}
          </div>
        </section>
        {%- endif -%}
      </main>
    </div>

    <footer>Built with Jekyll · hosted on GitHub Pages</footer>
  </div>
</body>
</html>
```

- [ ] **Step 3: Build and verify both sections + sidebar render (green)**

Run: `bundle exec jekyll build && grep -q 'data-year' _site/index.html && echo CARDS_OK`
Expected: `CARDS_OK`
Run: `grep -c 'class="filter"' _site/index.html`
Expected: a number ≥ 4 (All + 3 tags + 1 year for the current two items)
Run: `grep -q '>Projects<' _site/index.html && grep -q '>Writing<' _site/index.html && echo SECTIONS_OK`
Expected: `SECTIONS_OK`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: filterable landing page — sidebar + Projects/Writing card sections"
```

---

## Task 6: Add the single-select filter script

**Files:**
- Modify: `index.html` (add a `<script>` before `</body>`)

- [ ] **Step 1: Confirm there is no filter script yet (red)**

Run: `grep -q 'data-filter' index.html && echo HAS_CONTROLS; grep -q 'addEventListener' index.html && echo HAS_SCRIPT || echo NO_SCRIPT`
Expected: `HAS_CONTROLS` then `NO_SCRIPT`

- [ ] **Step 2: Add the script**

Insert this block immediately before the closing `</body>` tag in `index.html`:

```html
  <script>
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
  </script>
```

- [ ] **Step 3: Build and verify the script ships (green)**

Run: `bundle exec jekyll build && grep -q 'function matches' _site/index.html && echo SCRIPT_OK`
Expected: `SCRIPT_OK`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: single-select tag/year filter with shareable hash deep-link"
```

---

## Task 7: Manual smoke test + finish

**Files:** none (verification + branch wrap-up)

- [ ] **Step 1: Serve the site locally**

Run: `bundle exec jekyll serve --port 4000`
Open: `http://localhost:4000/`

- [ ] **Step 2: Verify the interactive behavior**

Check each, manually:
- Both `Projects` and `Writing` sections show their cards; bear-detector is a normal card (no "Featured").
- Click a tag (e.g. `PyTorch`) → only matching cards remain; a section with zero matches loses its heading.
- Click a `Year` → filters by year; the active control highlights; clicking `All` resets everything.
- The URL hash updates (e.g. `#tag=PyTorch`); reloading that URL re-applies the filter.
- Open a project card → `/projects/bear-detector/` shows the embedded live demo + Source/Write-up links + body.
- Open `http://localhost:4000/writing/ood-detection/` → renders via the article layout (URL unchanged).
- Narrow the window below 680px → the sidebar stacks above the content; nothing overflows.

Stop the server (Ctrl-C) when done.

- [ ] **Step 3: Verify the old featured markup is gone**

Run: `grep -q 'Featured' index.html && echo "STILL THERE" || echo "REMOVED"`
Expected: `REMOVED`
Run: `grep -q 'Another Project' index.html && echo "STILL THERE" || echo "REMOVED"`
Expected: `REMOVED`

- [ ] **Step 4: Final review of the branch**

Run: `git log --oneline main..HEAD`
Expected: the Task 1–6 commits plus the design/plan commits.

- [ ] **Step 5: Hand back for merge decision**

Do not merge automatically. Report completion and let the user choose how to integrate the `redesign-filterable-projects` branch (the `finishing-a-development-branch` skill covers the options). Note the remaining `TODO` header links for the user to fill in.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Two sections, sidebar filters both → Task 5 ✓
- Project click → on-site page with embed → Task 4 ✓
- Jekyll collections + client-side JS → Tasks 3, 5, 6 ✓
- Single-select filter → Task 6 ✓
- Header links as TODO → preserved in Task 5 ✓
- Preserve `/writing/ood-detection/` → Task 3 (permalink) + verified ✓
- Shared CSS extraction (refactor) → Task 2 ✓
- Empty-section heading hidden → Task 6 ✓
- Project without `demo` renders without iframe → Task 4 layout `{% if page.demo %}` ✓
- Deep-link optional → Task 6 (included; explicitly droppable) ✓
- All copy in English → all created content is English ✓
- Out of scope (multi-select, search, real links, pagination, model changes) → none introduced ✓

**Placeholder scan:** No "TBD/TODO" steps. The only `TODO` is the intentional header-links placeholder, called out in the spec and Task 7.

**Type/name consistency:** `.filter` / `data-filter` / `data-value`, `.item-card` / `data-tags` / `data-year`, `.item-section` — used identically across Tasks 5 and 6. Tag delimiter `|` written in Task 5 markup and matched in Task 6 `matches()`. Collection variables `site.projects` / `site.writing` consistent across Tasks 3–5.
