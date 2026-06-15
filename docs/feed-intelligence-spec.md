# Feed Intelligence App — Specification

## Goal

Build a standalone application that crawls a curated list of websites and newsletters,
evaluates each article for relevance to the user's interests using the Claude API,
and produces a structured digest that can be consumed by a static website, email, or CLI.

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
│              (cron / GitHub Actions / CLI)            │
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
- Model: `claude-haiku-4-5-20251001` (fast, cheap; upgrade to Sonnet if quality insufficient)
- Batch articles into groups of 10 to minimize API calls
- System prompt encodes the interest profile from this document
- Per article, the API returns:
  - `relevance_score`: float 0.0–1.0
  - `tags`: list of topic labels (e.g. `["interpretability", "claude-api", "safety"]`)
  - `one_line_summary`: ≤ 20 words
  - `reason`: one sentence explaining the score (for debugging)
- Threshold: only store articles with `relevance_score >= 0.6`

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
Two output targets (both generated on each run):

**A. YAML digest** (for Jekyll integration)
```yaml
# _data/digest.yml
generated_at: "2026-06-15T06:00:00Z"
articles:
  - title: "..."
    url: "..."
    source: "Anthropic Research"
    published_at: "2026-06-14"
    relevance: 0.91
    summary: "..."
    tags: [interpretability, claude-3-7]
```

**B. Plain-text digest** (for email or CLI)
```
=== Feed Digest · 2026-06-15 ===

[0.91] Anthropic Research
Title: ...
URL: ...
Summary: ...
Tags: interpretability, claude-3-7

...
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

| Concern | Library |
|---|---|
| HTTP | `httpx` (async) |
| RSS parsing | `feedparser` |
| HTML content extraction | `trafilatura` |
| HTML parsing (scraping) | `beautifulsoup4` |
| Claude API | `anthropic` Python SDK |
| Storage | `sqlite3` (stdlib) |
| Config | `pydantic-settings` + `.env` file |
| CLI | `typer` |
| Scheduling | GitHub Actions cron or system cron |

Python 3.11+. No framework. Single-file entry point preferred.

---

## Configuration (`.env`)

```
ANTHROPIC_API_KEY=sk-ant-...
MIN_RELEVANCE_SCORE=0.6
BACKFILL_DAYS=90
REQUEST_DELAY_SECONDS=2
OUTPUT_YAML_PATH=./_data/digest.yml
OUTPUT_EMAIL=false
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
DIGEST_EMAIL_TO=
```

---

## Open Decision Points

Before implementation, the following need answers from the user:

1. **Where does the app run?**
   Options: local machine (manual or cron), GitHub Actions (scheduled), lightweight VPS.
   GitHub Actions is the simplest path if the goal is to auto-update the Jekyll site.

2. **Output destination(s)?**
   - YAML → Jekyll site (needs the app to commit `_data/digest.yml` back to the repo)
   - Email digest (needs SMTP config)
   - Both

3. **Crawl frequency?**
   Daily at 06:00 UTC is a reasonable default.

4. **Email-only newsletters?**
   The Claude Developer Newsletter, Ben's Bites, and TLDR AI are inbox-only.
   Skip for now, or integrate a Kill the Newsletter / email-to-RSS bridge?

5. **Relevance score threshold?**
   0.6 is the proposed default. Adjust after a first test run.

6. **Archive depth on first run?**
   Proposed: 90 days. Could be shorter (30) or longer (180+).

---

## Out of Scope (v1)

- Personalization that learns from reading history
- User interface (the output is YAML/email/CLI, not a web app)
- Paywall bypassing
- PDF / research paper ingestion (separate concern)
- Multi-user support
