# EUR-Lex FMX API & CLI

REST API **and** command-line tool for downloading, parsing, and searching EU legislation in [Formex](https://op.europa.eu/en/web/eu-vocabularies/formex) format.

## Quick start

```bash
cd legalviz-api
npm install
npm start          # API server on port 3000
```

Or use the CLI directly (no server needed):

```bash
npx eurlex get 32016R0679           # Download & parse GDPR → JSON
npx eurlex search "digital markets" # Search law metadata
```

## CLI

The `eurlex` command exposes the same functionality as the API server so you can work with EU legislation locally without running the server.

```bash
npx eurlex <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `eurlex get <celex>` | Download a law by CELEX, parse it, output structured JSON |
| `eurlex fetch <celex>` | Download raw Formex XML (no parsing) |
| `eurlex parse <file>` | Parse a local Formex XML file to JSON (or pipe via stdin) |
| `eurlex metadata <celex>` | Fetch SPARQL metadata (entry-into-force, ELI, etc.) |
| `eurlex amendments <celex>` | List amendments and corrigenda |
| `eurlex implementing <celex>` | List implementing/delegated acts |
| `eurlex search <query>` | Search the local law metadata cache |
| `eurlex resolve <text>` | Resolve a legal reference to a CELEX number |
| `eurlex resolve-url <url>` | Resolve a EUR-Lex URL to a CELEX number |
| `eurlex list` | List locally cached FMX files |

Every command supports `--help` for detailed usage.

### Examples

```bash
# Download & parse laws
eurlex get 32016R0679                            # GDPR (English, stdout)
eurlex get 32024R1689 --lang DEU -o ai-act.json  # AI Act in German → file
eurlex get 32022R2065 | jq '.articles | length'  # count DSA articles

# Raw XML download
eurlex fetch 32016R0679 -o gdpr.xml

# Parse a local file
eurlex parse gdpr.xml -o gdpr.json
cat gdpr.xml | eurlex parse | jq '.definitions'

# Metadata & related acts
eurlex metadata 32016R0679
eurlex amendments 32016R0679
eurlex implementing 32016R0679

# Search & resolve
eurlex search "artificial intelligence" --limit 5
eurlex resolve "Regulation 2016/679"
eurlex resolve --actType directive --year 2018 --number 1972
eurlex resolve-url "https://eur-lex.europa.eu/eli/reg/2016/679/oj"
```

### Parsed JSON structure

`eurlex get 32016R0679` (and `GET /api/laws/32016R0679/parsed`) returns:

```json
{
  "celex": "32016R0679",
  "lang": "ENG",
  "title": "Regulation (EU) 2016/679 ...",
  "langCode": "EN",
  "articles": [
    {
      "article_number": "1",
      "article_title": "Subject-matter and objectives",
      "article_html": "<p>...</p>",
      "division": {
        "chapter": { "number": "I", "title": "General provisions" },
        "section": null
      }
    }
  ],
  "recitals": [
    {
      "recital_number": "1",
      "recital_text": "The protection of natural persons ...",
      "recital_html": "<p>...</p>"
    }
  ],
  "definitions": [
    { "term": "personal data", "definition": "any information relating to ..." }
  ],
  "annexes": [],
  "crossReferences": {
    "1": [
      { "type": "article", "target": "2", "raw": "Article 2" }
    ]
  }
}
```

### Global CLI options

| Flag | Description |
|------|-------------|
| `--lang <CODE>` | EUR-Lex language code, e.g. `ENG`, `DEU`, `FRA` (default: `ENG`) |
| `-o, --output <file>` | Write output to a file instead of stdout |
| `--help, -h` | Show help for a command |

### `parse-fmx` (standalone shortcut)

Lightweight alias for `eurlex parse`:

```bash
parse-fmx input.xml -o output.json
cat input.xml | parse-fmx > output.json
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/laws` | List cached FMX files |
| `GET` | `/api/laws/:celex?lang=ENG` | Download raw Formex XML by CELEX |
| `GET` | `/api/laws/:celex/parsed?lang=ENG` | **Parsed law as structured JSON** |
| `GET` | `/api/laws/:celex/info?lang=ENG` | Law type and format metadata |
| `GET` | `/api/laws/:celex/metadata` | SPARQL metadata (entry into force, ELI, etc.) |
| `GET` | `/api/laws/:celex/amendments` | Amendment and corrigendum history |
| `GET` | `/api/laws/:celex/implementing` | Implementing and delegated acts |
| `GET` | `/api/laws/by-reference?actType=...&year=...&number=...` | Fetch law by official reference |
| `GET` | `/api/search?q=keyword&limit=10` | Search law metadata |
| `GET` | `/api/resolve-reference?actType=...&year=...&number=...` | Resolve legal reference to CELEX |
| `GET` | `/api/resolve-url?url=...` | Resolve EUR-Lex URL to CELEX |

`/api/search` searches a local metadata cache of primary regulations/directives/decisions.

## Search

Search is intentionally narrow and conservative:
- primary acts only
- regulations, directives, decisions
- local metadata cache
- lexical ranking only

Each result returns:
- `celex`
- `title`
- `type`
- `date`
- `eli`
- `fmxAvailable`
- `matchReason`

Examples:

```bash
curl "http://localhost:3000/api/search?q=32016R0679"
curl "http://localhost:3000/api/search?q=regulation%202016/679"
curl "http://localhost:3000/api/search?q=digital%20markets%20act&limit=5"
```

If the search cache has not been built yet, `/api/search` returns `503` with `code=search_cache_unavailable`.

## Search Cache Build

The search cache is built manually and loaded at server startup.

Build it:

```bash
npm run build:search-cache
```

Useful options:

```bash
npm run build:search-cache -- --concurrency 6
npm run build:search-cache -- --resume --concurrency 6
npm run build:search-cache -- --fromYear 2026 --toYear 2010 --limit 200
```

Builder behavior:
- harvests primary `reg|dir|dec` `/eli/.../oj` acts from the official Publications Office SPARQL endpoint
- enriches titles from FMX/Formex where available
- records FMX availability
- writes the cache atomically
- persists resumable build state

Default files:
- search cache: [search/data/search-cache.json](/Users/konrad/Documents/legalviz.eu/legalviz-api/search/data/search-cache.json)
- build state: [search/data/search-build-state.json](/Users/konrad/Documents/legalviz.eu/legalviz-api/search/data/search-build-state.json)

Important: restart the API server after rebuilding the cache, because the cache is loaded on startup.

## Project Layout

```text
legalviz-api/
├─ package.json
├─ server.js
├─ README.md
├─ bin/
│  ├─ eurlex.js          # Full-featured CLI
│  └─ parse-fmx.js       # Standalone parse shortcut
├─ routes/
│  └─ api-routes.js
├─ search/
│  ├─ search-build.js
│  ├─ search-index.js
│  ├─ search-ranking.js
│  ├─ search-route.js
│  ├─ search-regression.test.js
│  └─ search-route.test.js
└─ shared/
   ├─ api-utils.js
   ├─ fmx-parser-node.js  # Node.js wrapper for browser-side Formex parser
   ├─ fmx-service.js
   ├─ rate-limit.js
   ├─ reference-utils.js
   └─ reference-utils.test.js
```

## Local Development

```bash
cd legalviz-api
npm install
npm start
```

Quick checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/laws
curl http://localhost:3000/api/laws/32016R0679?lang=ENG
curl "http://localhost:3000/api/search?q=gdpr"
curl "http://localhost:3000/api/resolve-reference?actType=directive&year=2018&number=1972&lang=ENG"
curl "http://localhost:3000/api/resolve-url?url=https%3A%2F%2Feur-lex.europa.eu%2Feli%2Freg%2F2016%2F679%2Foj&lang=ENG"
```

## Tests

Run all current tests:

```bash
npm test
```

Search-only tests:

```bash
npm run test:search
```

Current test coverage includes:
- search regression ranking checks
- search route behavior
- CELEX/reference parsing helpers

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Port for the API server. |
| `FMX_DIR` | Directory for cached FMX/XML/ZIP downloads. Defaults to `legalviz-api/fmx-downloads`. |
| `RATE_LIMIT_MAX` | Per-IP request cap for the 15-minute window. |
| `STORAGE_LIMIT_MB` | Max size of the FMX download cache before eviction starts. Default `500`. |
| `TIMEOUT_MS` | HTTP request timeout in ms. Default `30000`. |
| `SEARCH_CACHE_PATH` | Optional override for the search cache JSON path. |

## Notes

- FMX fetching and search are separate concerns. Search does not download FMX files.
- `/api/search` prefers primary acts and deprioritizes implementing/delegated/corrigendum material.
- Search quality is strongest for CELEX, `type + year/number`, and well-titled flagship laws.
- The builder is resumable, but a partially enriched cache is still only best-effort for relevance.

## License

MIT
