# Transformers — Living Reference: Design

**Date:** 2026-06-19
**Status:** Approved (design); pending spec review before implementation plan.

## Goal

Publish "Transformers — A Telling to Myself" (source: `~/Downloads/transformers-a-telling-to-myself.md`)
on the site as a **living reference document**: a structured, navigable page the
reader can search, with anchors on every section, beautiful math, and a visible
sense that the document is alive and growing. Editing/extending is the **author's**
job, done on the source markdown — the published page is **read-only**.

This is a different artifact from the existing narrative essays in `_writing`
(which use `layout: article`, a narrow reading column). It is a working
reference: modular sections, wide tables, code blocks, formulas, cross-references
(`§3.5`), and "greppable" authoring markers (`[OPEN]`, `[STUB]`, `[EXT]`).

## Decisions (resolved during brainstorming)

| Question | Decision |
|---|---|
| Who searches/extends/modifies? | Reader searches & navigates on the **published site**; only the **author** edits, on the **source markdown** (page is read-only). |
| Page structure | **Single long page** + sticky sidebar TOC, anchors on `§`, in-page search. |
| Math rendering | **KaTeX** (nice typography) — accepts a content migration from plain-text notation to LaTeX. |
| Authoring markers | **Visible badges** in body **+ a status panel** (counts of OPEN/STUB/EXT) that jumps to them. |
| Site integration | **Approach A (generic):** new `_layouts/reference.html` (written generically for reuse) + the document as `_writing/transformers.md` with `layout: reference`. No changes to `_config.yml` or `index.html`. |

## Architecture

### Files

- **New:** `_layouts/reference.html` — generic "living reference" layout (two-column
  grid, sidebar TOC + search + status panel, anchors, KaTeX, responsive). Written
  generically so a future second document (e.g. diffusion models) can reuse it.
- **New:** `_writing/transformers.md` — the migrated document with frontmatter
  `layout: reference`, `permalink: /writing/transformers/`.
- **New (optional):** `assets/js/reference.js` and/or `assets/css/reference.css`
  if inlining in the layout gets unwieldy; otherwise inline `<script>`/`<style>`
  in the layout, matching the existing `article.html` convention.
- **Unchanged:** `_config.yml`, `index.html`. The home "Writing" horizontal
  scroller picks up the new item automatically (it only reads title/summary/date,
  independent of layout).

### `reference.html` layout — components

Two-column CSS grid inside `--media`:

1. **Sidebar (sticky, left, ~240px)** — contains, top to bottom:
   - **Search box** — scoped to this page (see Search).
   - **Status panel** — three counters `OPEN / STUB / EXT` (see Status panel).
   - **TOC** — auto-generated **client-side** from `h2`/`h3` in the rendered DOM
     (Liquid cannot see headings inside rendered `{{ content }}`, so JS builds it
     on load). Scrollspy via `IntersectionObserver` highlights the current section.
2. **Body (right)** — rendered markdown. Reuses the prose typography from
   `article.html` (fonts, code blocks, tables, blockquotes) but a **wider column**
   so tables and display math breathe.
3. **Anchors on headings** — JS assigns each heading an `id` (slug of its text) and
   adds a hover `#` anchor link, making every `§` a shareable URL.
4. **Topbar** `← Home` and footer, consistent with `article.html`.
5. **Responsive** — below ~900px the sidebar collapses into a toggle/disclosure TOC
   and the body goes full-width.

Dependencies: **KaTeX** (CDN, auto-render) only. TOC, scrollspy, search, and badge
handling are **vanilla JS**.

### Cross-references (`§3.5`)

In v1 the inline `§N.M` references remain plain text. Turning them into live links
(map `§N.M` → heading id, in JS) is deferred and recorded as an `[EXT]` of the
document itself. (Listed in Out of scope.)

## Content migration (source → `_writing/transformers.md`)

1. **Frontmatter:** `layout: reference`, `title`, `description`, `summary`
   (for the home scroller), `date: 2026-06-19`, `tags`, `permalink: /writing/transformers/`.
2. **Formulas → LaTeX.** Display monospace blocks and inline backticked *math*
   become `$$…$$` / `$…$`. Notation conversion:
   - `×` → `\times`
   - `·` → `\cdot`
   - `^T` → `^{\top}`
   - `_x` → `_{x}`
   - `sqrt(...)` → `\sqrt{...}`
   - `Σ_j` → `\sum_j`
   - `ℝ^(a×b)` → `\mathbb{R}^{a\times b}`
   - bracket matrices (§3.7 multi-head, §3.5) → `\begin{bmatrix}…\end{bmatrix}`
   The **PyTorch reference code stays a ```python code block** — it is not math.
3. **KaTeX + kramdown caveat.** kramdown and KaTeX can collide on `_` (subscripts/
   emphasis) and `\\`. Use KaTeX auto-render configured to ignore `code`/`pre`, and
   pick delimiters that survive kramdown. This **must be verified with a local build**.
4. **Markers.** Keep `[OPEN]`/`[STUB]`/`[EXT]` literally in the prose; JS wraps each
   in `<span class="marker marker--{open,stub,ext}">` for styling and counts them.
5. **Intro note rewrite.** The source's opening note ("Math is written in plain text…
   renders without a LaTeX engine") is now false — rewrite it to describe the LaTeX/
   KaTeX rendering and the notation conventions instead.

Formula conversion is the most laborious part: done by hand, section by section,
with visual verification in the build. The style guide rule applies — **never alter
numbers, dimensions, code, or references**, only the representation of the math.

## Search (in-page, client-side)

- Input lives in the sidebar. On input, JS:
  - **filters the TOC** to entries whose section title matches, and
  - **highlights occurrences** in the body, with a result count; Enter jumps to the
    next match.
- No Lunr / no prebuilt index — it is a single page, so JS scans the already-present
  DOM text. Native Ctrl-F remains complementary.

## Status panel (the "living document dashboard")

- Top of sidebar: three counters `OPEN / STUB / EXT`, computed by counting wrapped
  markers.
- Clicking a counter filters/highlights only those markers and lets the reader cycle
  through their positions. This surfaces the document's open edges to both reader and
  author.

## Testing & verification

- **Local Jekyll build** with the vendored jekyll (`GEM_HOME` per memory
  `jekyll-local-build`) — primary gate: page compiles, KaTeX renders, no broken Liquid.
- **Visual check** in the browser: TOC populated, scrollspy works, anchors,
  search, badges + status panel, responsive < 900px.
- **Formula regression:** eyeball each migrated formula against the original — numbers
  and dimensions unchanged (also required by the writing style guide).
- No JS test harness exists in the project; stay consistent (manual verification).

## Out of scope (v1)

- Live `§N.M` cross-reference links (deferred `[EXT]`).
- Multi-page split / Lunr full-site search.
- A separate `_reference` collection (Approach B) — revisit only if a second living
  document appears and the home integration proves insufficient.
- Any reader-side editing/extension UI (author edits source only).

## Risks

- **KaTeX × kramdown escaping** is the main unknown; mitigated by early local-build
  verification before migrating all formulas.
- **Manual formula migration** is error-prone; mitigated by section-by-section visual
  diff against the source.
