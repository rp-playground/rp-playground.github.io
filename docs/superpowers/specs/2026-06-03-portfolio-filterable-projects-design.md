# Portfolio redesign — filterable Projects + Writing

**Date:** 2026-06-03
**Repo:** `rp-playground.github.io` (Jekyll site on GitHub Pages)
**Status:** approved design, ready for implementation plan

## Goal

Replace the current "Featured — Bear Classifier" landing page (one hard-coded
flagship project with a big embedded iframe) with a scalable, **filterable**
portfolio. The bear detector becomes one entry among future ones. A left
navigation column lets the visitor filter content **by tag** or **by year**.

All site-facing copy is in **English**.

## Decisions (locked during brainstorming)

1. **Two sections, not a unified feed.** The home keeps `Projects` and
   `Writing` as separate stacked sections. The sidebar filter applies to both.
2. **Project click → on-site project page.** Each project has its own page on
   the site that embeds the live demo (iframe) plus links to repo / write-up.
   Projects are *not* bare outbound links.
3. **Implementation: Jekyll collections + client-side JS filtering.** One
   markdown file per item; Liquid renders cards and the sidebar at build time;
   a small vanilla-JS script does live show/hide at runtime. No plugins beyond
   GitHub Pages defaults, no framework.
4. **Single-select filter.** One active filter at a time — a tag *or* a year *or*
   `All`. Not multi-select.
5. **Header social links** stay as `TODO` placeholders for now.

## Architecture

Static Jekyll site. Build-time Liquid + runtime vanilla JS. No backend.

```
Collections (_config.yml)
  _projects/*.md   ──Liquid──▶ Projects cards + sidebar tags/years
  _writing/*.md    ──Liquid──▶ Writing cards  + sidebar tags/years
                                      │
                              index.html (rendered)
                                      │
                          runtime JS: show/hide cards by data-tags / data-year
```

### Collections

Add to `_config.yml`:

```yaml
collections:
  projects:
    output: true
    permalink: /projects/:name/
  writing:
    output: true
    permalink: /writing/:name/   # preserves the existing /writing/ood-detection/ URL
```

### Item front matter

Shared fields (both collections):

| field     | required | notes                                            |
|-----------|----------|--------------------------------------------------|
| `title`   | yes      | display title                                    |
| `date`    | yes      | `YYYY-MM-DD`; drives sort (desc) and the year filter |
| `tags`    | yes      | list of strings; powers the tag filter           |
| `summary` | yes      | one-sentence card description                    |

Project-only fields:

| field     | required | notes                                             |
|-----------|----------|---------------------------------------------------|
| `demo`    | no       | URL embedded as an iframe on the project page (e.g. the HF Space). Omitted → no embed. |
| `repo`    | no       | source link                                       |
| `writeup` | no       | link to the companion article (e.g. `/writing/ood-detection/`) |

Writing items render through the existing `article.html` layout; the markdown
body is the article. Project items render through a new `project.html` layout;
the markdown body is the project description shown under the embed.

## Components

### `index.html` (landing page)

Gains YAML front matter (currently has none) so Jekyll processes its Liquid.
Layout = sidebar + content, two columns on desktop, sidebar stacks above content
on narrow screens.

- **Header:** name, subtitle, social links (`TODO` placeholders preserved).
- **Sidebar (`<aside>`):**
  - `All` reset control (active by default).
  - **Tags:** the sorted union of `tags` across `site.projects` and
    `site.writing`, built in Liquid. Each is a clickable filter control.
  - **Years:** the sorted-desc union of `item.date | date: "%Y"` across both
    collections.
- **Projects section:** `site.projects | sort: "date" | reverse`. Each card
  carries `data-tags="tag1 tag2"` (space-joined) and `data-year="2026"`, shows
  title, summary, tag pills, and the year. Card links to the project page.
- **Writing section:** same, from `site.writing`.

### Filter script (inline `<script>` in index.html)

- Single active filter held in a variable; default `All`.
- Clicking a tag or year control:
  - marks it active (visually), clears any other active control;
  - iterates project + writing cards, showing those whose `data-tags` contains
    the tag (tag filter) or whose `data-year` equals the year (year filter),
    hiding the rest;
  - hides a section's heading when that section has zero visible cards.
- `All` shows everything and clears the active control.
- **Deep-link (nice-to-have):** reflect the active filter in the URL hash
  (`#tag=PyTorch`, `#year=2026`) and apply it on page load so a filtered view is
  shareable. If it adds meaningful complexity during implementation, drop it —
  it is explicitly optional.
- No dependency on tag/year casing matching CSS-id rules: compare on
  `data-` attribute string values, not element ids.

### `_layouts/project.html` (new)

Renders a single project: header (title, `date | date: "%B %Y"`, tag pills);
the embedded demo (`<iframe>` from `page.demo`) when present; a row of links
(`repo`, `writeup`) when present; then `{{ content }}`. Shares the dark theme
(see CSS extraction below). A top `← Home` bar like `article.html`.

### `_layouts/article.html` (existing)

Unchanged in behavior. Updated only to pull the shared stylesheet instead of its
inline `<style>` (see below).

### Shared theme — `assets/css/main.css` (refactor)

The dark theme (CSS variables + base typography) is currently duplicated inline
in `index.html` and `article.html`. The new `project.html` would make a third
copy. Extract the shared theme into `assets/css/main.css`, linked by all three
pages. Page-specific rules (the landing grid/sidebar, the article reading
measure, the project embed) stay with their page or in clearly-scoped blocks.
This is a targeted improvement that directly serves the goal (the project layout
needs the same theme); no unrelated restyling.

## Content migration

1. **Move** `writing/ood-detection.md` → `_writing/ood-detection.md`. Add/confirm
   front matter: `layout: article`, `title`, `date`, `tags: [OOD detection,
   calibration, PyTorch]`, `summary`. The `permalink: /writing/:name/` collection
   rule keeps the live URL `/writing/ood-detection/` unchanged. The referenced
   images under `assets/ood/` are untouched.
2. **Create** `_projects/bear-detector.md`:
   - `layout: project`, `title: Bear detector`, `date`, `summary`,
     `tags: [PyTorch, OOD detection, calibration]`,
     `demo: https://rfflpllcn-bear-detector.hf.space`,
     `writeup: /writing/ood-detection/`,
     `repo:` (the play-pytorch lesson2 URL).
   - Body: short description of the project (the closed-set classifier + live OOD
     panel), shown under the embed.
3. **Rewrite** `index.html` per the components above; remove the hard-coded
   `Featured` section and the placeholder `Another Project` card.

## Data flow

Build time: Liquid iterates the two collections to emit the cards (with `data-`
attributes) and to compute the sidebar's tag/year lists. Runtime: the script
only toggles visibility. Nothing is fetched; there is no server.

## Error / edge handling

- **No tags / no items:** sidebar sections that would be empty are simply not
  rendered (Liquid guards on collection size).
- **A filter matching zero cards** in a section hides that section's heading, so
  the user never sees an empty labelled section.
- **Project without `demo`:** the project page renders without an iframe (links
  + body only).
- **Unknown hash on load** (deep-link to a tag that no longer exists): falls back
  to `All`.

## Testing / verification

Local: `bundle exec jekyll serve` (or the repo's existing build command) and
verify:
- `/` renders both sections with the bear-detector + OOD-article cards.
- Clicking a tag filters both sections; an emptied section's heading disappears;
  `All` resets.
- Clicking a year filters by year.
- `/writing/ood-detection/` still resolves (URL preserved) and renders via
  `article.html`.
- `/projects/bear-detector/` renders the embed + links + body.
- Narrow viewport: sidebar stacks above content, nothing overflows.

## Out of scope

- Multi-select / combined tag+year filtering.
- Search.
- Real social links (kept as TODO).
- Pagination (not needed at this scale).
- Any change to the bear-detector model or its Hugging Face Space.
