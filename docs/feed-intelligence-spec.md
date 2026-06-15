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
2. **LLM internals and capabilities** — reasoning, tool use, agentic behavior, context handling, inference
3. **AI safety and interpretability** — mechanistic interpretability, alignment research, model evaluation
4. **ML research** — calibration, uncertainty, OOD detection, representation learning (the user actively reads papers in these areas)
5. **LLM industry moves** — notable releases or findings from other frontier labs (OpenAI, Google DeepMind, Meta)

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
              │  (Claude API)   │
              └───────┬────────┘
                      │  scored + tagged articles
              ┌───────▼────────┐
              │    Storage      │  ← SQLite or JSON
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  Output Writer  │
              │  YAML · email   │
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
- Normalize dates to ISO 8601 UTC
- Fields to extract: `title`, `url`, `canonical_url`, `published_at`, `author`, `source_name`, `raw_text`

#### 3. Deduplicator
- Check `canonical_url` against the seen-URLs store before scoring
- Fingerprint by URL + title hash to catch syndicated duplicates

#### 4. Relevance Filter
- **No API key.** Uses the `claude` CLI (Claude Code) via subprocess:
  ```
  echo "<prompt>" | claude -p --output-format json
  ```
- Articles are passed one at a time (or in small batches as a JSON array in the prompt)
- The prompt encodes the interest profile from this document and asks Claude to return
  structured JSON
- Expected output per article:
  - `relevance_score`: float 0.0–1.0
  - `tags`: list of topic labels (e.g. `["interpretability", "claude-api", "safety"]`)
  - `one_line_summary`: ≤ 20 words
  - `reason`: one sentence explaining the score (for debugging)
- Threshold: only store articles with `relevance_score >= 0.6`
- The subprocess call must handle `claude` not being in PATH (error with a clear message)
- Timeout per call: 30s; skip article and log warning on timeout

#### 5. Storage
- SQLite, single file `data/articles.db`
- Tables: `articles` (all seen), `digests` (daily rollups)
- Schema for `articles`:

```sql
CREATE TABLE articles (
  id            INTEGER PRIMARY KEY,
  url           TEXT UNIQUE,
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
      "published_at": "2026-06-14",
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

[output]
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
- User interface (the output is YAML/email/CLI, not a web app)
- Paywall bypassing
- PDF / research paper ingestion (separate concern)
- Multi-user support
