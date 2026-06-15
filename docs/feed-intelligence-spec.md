# Feed Intelligence App — Specification

## Goal

Build a standalone local Python application that crawls a curated list of websites and
newsletters, evaluates each article for relevance to the user's interests by invoking
the Claude Code CLI (`claude`) as a subprocess, and produces a structured digest
consumed via terminal output or a local file.

**Key constraint:** No Anthropic API key. AI scoring is done via the `claude` CLI,
which uses the user's existing Claude Code authentication. The app runs entirely on
the user's local machine.

---

## User Interest Profile

The relevance filter should be calibrated around these topics, in rough priority order:

1. **Claude and Anthropic** — model releases, API updates, product announcements, company news
2. **Mechanistic interpretability** — circuits, superposition, features, probing, sparse autoencoders (primary research interest; Olah/Nanda are the canonical sources)
3. **LLM internals and capabilities** — reasoning, tool use, agentic behavior, test-time compute, chain-of-thought, context handling
4. **AI safety and alignment** — reward hacking, RLHF, post-training, model evaluation, scalable oversight
5. **ML research** — calibration, uncertainty, OOD detection, representation learning (the user actively reads papers in these areas)
6. **LLM industry moves** — notable releases or findings from other frontier labs (OpenAI, Google DeepMind, Meta)

**Deprioritize:**
- Generic "AI will transform X industry" think pieces
- Funding rounds and business news not directly tied to a technical development
- Social media drama / Twitter discourse roundups
- Tutorial content aimed at beginners

---

## Source List

### Official (high priority)

| Name | URL | Has RSS |
|---|---|---|
| Anthropic Claude Blog | https://claude.com/blog | Unknown — check |
| Anthropic Research Blog | https://anthropic.com/research | Unknown — check |
| Claude Developer Newsletter | https://claude.com/newsletter/developers | No (email-only) |

### Researcher blogs — Anthropic (highest priority)

Infrequent but high-signal. The crawler should check these and treat any new post
as automatically relevant (skip the scoring step, score = 1.0).

**Auto-pass applies only to low-cadence personal blogs** (the three above, plus Nanda,
Weng, Alammar, Ruder below). High-volume newsletters that happen to be authored by
researchers — **Interconnects** (Nathan Lambert) and **Ahead of AI** (Raschka) — publish
on a regular cadence and would flood the digest if auto-passed, so they go through normal
scoring like any other source.

| Name | Affiliation | URL | Has RSS |
|---|---|---|---|
| Chris Olah | Anthropic co-founder | https://colah.github.io | Yes (GitHub Pages) |
| Andrej Karpathy | Anthropic (joined May 2026; ex-OpenAI/Tesla) | https://karpathy.bearblog.dev | Yes (bearblog /feed/) |
| Dario Amodei | Anthropic CEO | https://darioamodei.com | Unknown — check |

### Researcher blogs — Google DeepMind / adjacent (high priority)

| Name | Affiliation | URL | Has RSS |
|---|---|---|---|
| Neel Nanda | Google DeepMind (ex-Anthropic mech interp) | https://www.neelnanda.io | Unknown — check |
| Lilian Weng | Thinking Machines Lab (ex-OpenAI; safety/reasoning focus) | https://lilianweng.github.io | Yes (GitHub Pages) |
| Sebastian Raschka | Independent — Ahead of AI / RAIR Lab | https://magazine.sebastianraschka.com | Yes (Substack) |
| Nathan Lambert | Ai2 (RLHF / post-training focus) | https://www.interconnects.ai | Yes (Substack) |
| Jay Alammar | Cohere (transformer visual explainers) | https://jalammar.github.io | Yes (GitHub Pages) |
| Sebastian Ruder | Meta (NLP focus, slowing cadence) | https://ruder.io | Unknown — check |

**Crawl note for researcher blogs:** these post infrequently (days to months between
posts). The fetcher should still poll them on every run but not treat silence as an
error. On first run, backfill the full available archive.

### Third-party (medium priority)

| Name | URL | Has RSS |
|---|---|---|
| ByteByteGo Newsletter | https://bytebytego.com | Yes (Substack) |
| NLPlanet on Medium (Fabio Chiusano) | https://medium.com/nlplanet | Yes (Medium RSS) |
| LLM Rumors | https://llmrumors.com | Unknown — check |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/ | Yes |
| The Verge AI | https://www.theverge.com/ai-artificial-intelligence | Yes |
| Ars Technica AI | https://arstechnica.com/ai/ | Yes |

### Broader AI newsletters (lower priority, high volume)

| Name | URL | Has RSS |
|---|---|---|
| The Batch (Andrew Ng) | https://www.deeplearning.ai/the-batch/ | Unknown — check |
| Ben's Bites | https://bensbites.com | Yes (Substack) |
| TLDR AI | https://tldr.tech/ai | Yes |

**Note on email-only sources:** Claude Developer Newsletter and similar inbox-only
newsletters cannot be crawled. Options: (a) skip them, (b) use a service like
Kill the Newsletter to convert to RSS, (c) forward emails to a parsing address.
This is a decision point — see below.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Scheduler / Runner                 │
│                  (local cron / CLI)                   │
└─────────────────────┬───────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  Fetcher Layer  │
              │  RSS + Scraper  │
              └───────┬────────┘
                      │  raw articles
              ┌───────▼────────┐
              │    Extractor    │
              │  title · date   │
              │  url · content  │
              └───────┬────────┘
                      │  structured articles
              ┌───────▼────────┐
              │  Deduplicator   │  ← checks seen-URLs store
              └───────┬────────┘
                      │  new articles only
              ┌───────▼────────┐
              │ Relevance Filter│
              │  (claude CLI)   │
              └───────┬────────┘
                      │  scored + tagged articles
              ┌───────▼────────┐
              │    Storage      │  ← SQLite
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  Output Writer  │
              │ terminal · JSON │
              └────────────────┘
```

### Component details

#### 1. Fetcher
- For sources with RSS: use `feedparser` to pull feed entries
- For sources without RSS: use `httpx` to fetch the listing page, then parse
  article links with `BeautifulSoup4`
- Respect `robots.txt`; add per-domain rate limiting (min 2s between requests)
- Retry up to 3 times with exponential backoff on transient errors
- **Archive mode** (first run only): walk pagination / older feed pages up to a
  configurable depth (e.g. 90 days back)

#### 2. Extractor
- Use `trafilatura` for main-content extraction from HTML (strips nav, ads, boilerplate)
- Normalize all dates to ISO 8601 UTC (e.g. `2026-06-14T00:00:00Z`); date-only sources are
  stored as midnight UTC. `published_at` uses this format everywhere — store, digest, JSON
- Fields to extract: `title`, `url`, `canonical_url`, `published_at`, `author`, `source_name`, `raw_text`

#### 3. Deduplicator
- Check `canonical_url` (falling back to `url`) against the `articles` table before scoring
- Because **every scored article is persisted**, not just those above threshold (see Storage),
  each URL is scored by the `claude` CLI at most once — previously-rejected articles are
  skipped on later runs instead of being re-fetched and re-scored every time
- Fingerprint by `canonical_url` + title hash to catch syndicated duplicates across sources

#### 4. Relevance Filter
- **No API key.** Uses the `claude` CLI (Claude Code) via subprocess. Pass the prompt on
  **stdin** (not via `echo "<prompt>"`, which mangles quotes/newlines/JSON in the prompt):
  ```python
  subprocess.run(["claude", "-p", "--output-format", "json"],
                 input=prompt, capture_output=True, text=True, timeout=30)
  ```
- **Two-layer parsing.** `--output-format json` returns the CLI *envelope*
  (`{"type": ..., "result": "<model text>", "session_id": ..., ...}`), not the per-article
  JSON directly. Parse the envelope, take `.result`, then parse the model's JSON out of that
  string. Instruct the model to emit **strict JSON only** and strip any markdown code-fence
  before the second parse.
- Articles are passed one at a time (or in small batches as a JSON array in the prompt — see
  the batching note under Throughput)
- The prompt encodes the interest profile from this document and asks Claude to return
  structured JSON
- Expected output per article:
  - `relevance_score`: float 0.0–1.0
  - `tags`: list of topic labels (e.g. `["interpretability", "claude-api", "safety"]`)
  - `one_line_summary`: ≤ 20 words
  - `reason`: one sentence explaining the score (for debugging)
- Threshold: only articles with `relevance_score >= 0.6` are surfaced in the digest/output.
  All scored articles are still written to the `articles` table (see Storage) so the threshold
  can be re-tuned later without re-scoring.
- The subprocess call must handle `claude` not being in PATH (error with a clear message)
- Timeout per call: 30s; skip article and log warning on timeout. Timed-out / errored
  articles are **not** recorded as seen, so they are retried on the next run (transient failures)
- **Throughput & usage limits.** "No API key" does not mean "no limits" — each call consumes
  the user's Claude subscription usage. A 90-day backfill across ~20 sources, serialized at
  one ~30s call per article, can take hours and hit subscription rate caps. Therefore:
  - **Backfill batches articles by default** (e.g. 10 per call as a JSON array), not one at a
    time, to cut the number of CLI invocations. Per-call timeout scales with batch size.
  - Incremental `--run` (few new articles) can score one at a time; batching is optional there.
  - On hitting a usage-limit error, back off and stop the run cleanly rather than spinning.

#### 5. Storage
- SQLite, single file `data/articles.db`
- Tables: `articles` (every scored article), `sources` (per-source crawl state),
  `digests` (one row per run)
- **All scored articles are written to `articles`, regardless of `relevance`.** The 0.6
  threshold is applied only when building the digest/output — never as an insert gate. This
  keeps the dedup store complete (rejected URLs aren't re-scored) and lets the threshold be
  re-tuned without re-running the `claude` CLI.
- The extractor's `raw_text` is intentionally **not** persisted — only `summary` is kept, to
  keep the DB small. Consequence: changing the *prompt* (not just the threshold) requires
  re-fetching article bodies to re-score. Add a `raw_text` column if re-scoring without
  re-fetch becomes a need.

```sql
CREATE TABLE articles (
  id            INTEGER PRIMARY KEY,
  url           TEXT UNIQUE,
  canonical_url TEXT,
  title         TEXT,
  source        TEXT,
  author        TEXT,
  published_at  TEXT,
  fetched_at    TEXT,
  relevance     REAL,
  tags          TEXT,   -- JSON array
  summary       TEXT,
  reason        TEXT
);
CREATE INDEX idx_articles_canonical ON articles(canonical_url);

-- Per-source crawl state. Backs `--run` ("new since last run") and `--sources`.
CREATE TABLE sources (
  name            TEXT PRIMARY KEY,
  url             TEXT,
  last_fetched_at TEXT,   -- ISO 8601 UTC; high-water mark for incremental fetch
  last_status     TEXT    -- "ok" | "error:<msg>"
);

-- One row per run, archives the emitted digest (same shape as the JSON output file).
CREATE TABLE digests (
  id            INTEGER PRIMARY KEY,
  generated_at  TEXT,
  article_count INTEGER,
  payload       TEXT      -- JSON
);
```

#### 6. Output Writer
Two output targets:

**A. Terminal digest** (primary)
```
=== Feed Digest · 2026-06-15 ===

[0.91] Anthropic Research · 2026-06-14
Title: ...
URL:   https://...
       One-line summary here.
Tags:  interpretability, claude-3-7

[0.78] TechCrunch AI · 2026-06-13
...
```

**B. Local JSON file** (optional, for archiving or future tooling)
```json
{
  "generated_at": "2026-06-15T06:00:00Z",
  "articles": [
    {
      "title": "...",
      "url": "...",
      "source": "Anthropic Research",
      "published_at": "2026-06-14T00:00:00Z",
      "relevance": 0.91,
      "summary": "...",
      "tags": ["interpretability", "claude-3-7"]
    }
  ]
}
```

---

## Running Modes

| Mode | Trigger | Behavior |
|---|---|---|
| `--run` | Scheduled / manual | Fetch new articles since last run, score, update store + output |
| `--backfill` | First run | Crawl archives up to N days back (default: 90) |
| `--dry-run` | Development | Fetch and score but do not write to store or output |
| `--sources` | Debug | Print source list with RSS availability and last-fetched time |

---

## Suggested Tech Stack

| Concern | Library / tool |
|---|---|
| HTTP | `httpx` (sync is fine for local use) |
| RSS parsing | `feedparser` |
| HTML content extraction | `trafilatura` |
| HTML parsing (scraping) | `beautifulsoup4` |
| AI scoring | `claude` CLI via `subprocess` (no SDK needed) |
| Storage | `sqlite3` (stdlib) |
| Config | plain `configparser` + `config.ini` file (no .env complexity) |
| CLI | `argparse` (stdlib) or `typer` |
| Scheduling | local `cron` (macOS/Linux) |

Python 3.11+. No framework. Prefer stdlib where possible to keep dependencies minimal.
Single-file entry point (`feed.py`) with helper modules only if needed.

---

## Configuration (`config.ini`)

```ini
[crawl]
backfill_days = 90
request_delay_seconds = 2

[filter]
min_relevance_score = 0.6
claude_timeout_seconds = 30
backfill_batch_size = 10        ; articles per claude CLI call during backfill

[output]
output_target = both            ; terminal | json | both
digest_path = ~/feeds/digest.json
```

No secrets needed. The `claude` CLI handles auth via its own session.

---

## Open Decision Points

Before implementation, the following need answers from the user:

1. **Output format?**
   - Plain terminal output (print digest to stdout on each run) — simplest
   - Local JSON file (machine-readable, can be read by other tools)
   - Both

2. **Crawl frequency?**
   Daily via local cron is a reasonable default. Or run manually on demand.

3. **Email-only newsletters?**
   The Claude Developer Newsletter, Ben's Bites, and TLDR AI are inbox-only with no RSS.
   Skip for now, or integrate a service like Kill the Newsletter to convert to RSS?

4. **Relevance score threshold?**
   0.6 is the proposed default. Adjust after a first test run.

5. **Archive depth on first run?**
   Proposed: 90 days. Could be shorter (30) or longer (180+).

---

## Out of Scope (v1)

- Personalization that learns from reading history
- User interface (the output is JSON/terminal/CLI, not a web app)
- Paywall bypassing
- PDF / research paper ingestion (separate concern)
- Multi-user support
