# ECJ Case-Law Integration — Implementation Plan

## Overview

Integrate ECJ (CJEU) case-law into LegalViz.EU so that when viewing a law, users
can see which court judgments interpret it, and what those judgments ruled.

This plan is based on validated experiments:
- **MVP extractor** (`extract.mjs`) successfully parses operative parts and article
  citations from 7 famous GDPR cases (100% success rate, 204 total citations).
- **SPARQL API** confirmed to provide case-law → legislation links without scraping.

---

## Data Sources Available (validated)

### 1. SPARQL Endpoint (already used by codebase)

**Endpoint:** `https://publications.europa.eu/webapi/rdf/sparql`

Key predicates for case-law:

| Predicate | Direction | Description |
|-----------|-----------|-------------|
| `cdm:case-law_interpretes_resource_legal` | Case → Law | Laws interpreted by a judgment |
| `cdm:case-law_declares_void_by_preliminary_ruling_resource_legal` | Case → Law | Laws declared invalid |
| `cdm:case-law_declares_valid_resource_legal` | Case → Law | Laws declared valid |
| `cdm:work_cites_work` | Work → Work | General citation (both directions) |
| `cdm:case-law_ecli` | Case → ECLI | ECLI identifier |
| `cdm:case-law_delivered_by_court-formation` | Case → Formation | Grand Chamber, etc. |
| `cdm:case-law_originates_in_country` | Case → Country | Referring Member State |
| `cdm:work_date_document` | Work → Date | Judgment date |

**Example: Get all CJEU judgments interpreting a law**
```sparql
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?celex ?ecli ?date WHERE {
  ?caseWork cdm:case-law_interpretes_resource_legal ?law .
  ?law owl:sameAs <http://publications.europa.eu/resource/celex/{CELEX}> .
  ?caseWork cdm:resource_legal_id_celex ?celex .
  FILTER(REGEX(?celex, '^6[0-9]{4}CJ'))
  OPTIONAL { ?caseWork cdm:case-law_ecli ?ecli }
  OPTIONAL { ?caseWork cdm:work_date_document ?date }
} ORDER BY ?date
```

This returns 70+ judgments for the GDPR alone, with ECLI and date.

### 2. EUR-Lex HTML (for operative part extraction)

**URL pattern:** `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:{celex}`

The HTML uses `coj-*` CSS classes. The operative part follows a consistent structure:
- Header: `<p class="coj-normal">On those grounds, the Court (...) hereby rules:</p>`
- Declarations: numbered items in `<p class="coj-count coj-bold">` + `<p class="coj-normal">`
- Ends at: `<div class="coj-signaturecase">`

Article citations in the text follow patterns like:
- `Article 46(1) of Regulation (EU) 2016/679`
- `Article 7 of the Charter`
- `Article 267 TFEU`

---

## Implementation Strategy

### Phase 1: Backend — SPARQL-based case-law API (no database needed)

Add a new query function and API endpoint, following the existing pattern in
`backend/shared/law-queries.js` and `backend/routes/api-routes.js`.

**File: `backend/shared/law-queries.js`** — Add `fetchCaseLaw(celex, runSparqlQuery)`:

```js
async function fetchCaseLaw(celex, runSparqlQuery) {
  const celexUri = `http://publications.europa.eu/resource/celex/${celex}`;
  const query = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?celex ?ecli ?date WHERE {
  ?caseWork cdm:case-law_interpretes_resource_legal ?law .
  ?law owl:sameAs <${celexUri}> .
  ?caseWork cdm:resource_legal_id_celex ?celex .
  FILTER(REGEX(?celex, '^6[0-9]{4}CJ'))
  OPTIONAL { ?caseWork cdm:case-law_ecli ?ecli }
  OPTIONAL { ?caseWork cdm:work_date_document ?date }
} ORDER BY ?date`;

  const data = await runSparqlQuery(query);
  return (data.results?.bindings || []).map(b => ({
    celex: b.celex.value,
    ecli: b.ecli?.value || null,
    date: b.date?.value || null,
    caseNumber: celexToCaseNumber(b.celex.value),
    eurlexUrl: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${b.celex.value}`,
  }));
}
```

**File: `backend/routes/api-routes.js`** — Add endpoint:

```
GET /api/laws/:celex/case-law
```

Returns: `{ celex, caseLaw: [{ celex, ecli, date, caseNumber, eurlexUrl }] }`

**Effort:** ~30 lines of code, follows existing patterns exactly.

### Phase 2: Frontend — Case-Law Panel in Law Viewer

Add a "Case Law" section to the existing `MetadataPanel.jsx` or create a
lightweight `CaseLawPanel.jsx` component.

**Data flow:**
1. When a law is loaded, fetch `/api/laws/{celex}/case-law`
2. Display as a sortable list: case number, date, ECLI (linked to EUR-Lex)
3. Cache in component state (same pattern as amendments panel)

**Mockup:**
```
┌─────────────────────────────────────────────┐
│ Case Law (72 judgments)                     │
├─────────────────────────────────────────────┤
│ C-311/18  Schrems II         16 Jul 2020   │
│ C-673/17  Planet49           01 Oct 2019   │
│ C-252/21  Meta Platforms     04 Jul 2023   │
│ ...                                         │
└─────────────────────────────────────────────┘
```

**Effort:** ~100 lines, reuses existing panel patterns.

### Phase 3: Article-Level Case-Law Links (optional enrichment)

Two approaches, from easiest to most thorough:

#### Option A: Link via operative part text extraction (recommended)

Use the extractor from this MVP to parse the operative part of each judgment and
match articles cited to articles in the viewed law. This can be done on-demand or
pre-computed.

**Key insight:** The operative part is typically 1-5 paragraphs and explicitly
names the articles being interpreted. The extractor already parses these
reliably.

**Implementation:**
1. Add an endpoint: `GET /api/case-law/:celex/operative`
2. Fetches the judgment HTML, runs the extractor, returns structured data
3. Frontend matches `article` field to the law's article numbers
4. Show a badge/icon on articles that have case-law interpretations

**Effort:** Port `extract.mjs` to the backend (~200 lines). Add caching to
avoid re-fetching (same LRU pattern as FMX cache).

#### Option B: SPARQL `work_cites_work` (coarser, law-level only)

The `work_cites_work` predicate links works at the law level (not article level).
It's already available and requires no HTML parsing, but doesn't tell you which
specific articles are interpreted.

Useful as a quick fallback or for "related legislation" features.

---

## Architecture Decisions

### No database needed

The existing architecture (SPARQL queries + file cache + in-memory state) works
perfectly for case-law integration:

- **Case-law list per law:** SPARQL query, cached in memory (same as amendments)
- **Operative part extraction:** Fetch HTML on demand, cache as files (same as FMX)
- **Article-level links:** Derived from operative part text at query time

### CELEX format for case-law

ECJ judgment CELEX numbers follow the pattern `6YYYYCJNNNN`:
- `6` = case-law sector
- `YYYY` = year case was registered
- `CJ` = Court of Justice judgment
- `NNNN` = case number (zero-padded)

Conversion: `C-311/18` ↔ `62018CJ0311`

Other document types in the `6` sector:
- `CC` = Advocate General opinions
- `CA` = case announcements
- `TO` = General Court orders

Filter with `REGEX(?celex, '^6[0-9]{4}CJ')` to get only CJ judgments.

### Caching strategy

| Data | Cache Location | TTL |
|------|---------------|-----|
| Case-law list per law | In-memory (like amendments) | 24h or on-demand |
| Judgment HTML | File cache (like FMX) | Permanent (judgments don't change) |
| Parsed operative part | File cache (JSON) | Permanent |

---

## File Changes Summary

### Phase 1 (Backend, SPARQL)
| File | Change |
|------|--------|
| `backend/shared/law-queries.js` | Add `fetchCaseLaw()` (~30 lines) |
| `backend/routes/api-routes.js` | Add `GET /api/laws/:celex/case-law` route (~15 lines) |
| `backend/bin/eurlex.js` | Add `case-law` CLI command (~20 lines) |

### Phase 2 (Frontend, Panel)
| File | Change |
|------|--------|
| `src/components/MetadataPanel.jsx` | Add case-law section (~80 lines) |
| `src/utils/formexApi.js` | Add `fetchCaseLaw()` API call (~10 lines) |

### Phase 3 (Article-Level, Optional)
| File | Change |
|------|--------|
| `backend/shared/ecj-parser.mjs` | Port extract.mjs to backend (~200 lines) |
| `backend/routes/api-routes.js` | Add `GET /api/case-law/:celex/operative` (~20 lines) |
| `src/components/law-viewer/ArticleView.jsx` | Add case-law badge (~30 lines) |

---

## Validated Test Cases

The MVP extractor was tested against these 7 GDPR-related judgments:

| Case | Name | Operative Parts | Citations |
|------|------|:-:|:-:|
| C-131/12 | Google Spain (Right to be forgotten) | 4 | 20 |
| C-362/14 | Schrems I (Safe Harbor) | 2 | 18 |
| C-673/17 | Planet49 (Cookie consent) | 3 | 17 |
| C-40/17 | Fashion ID (Joint controllers) | 5 | 14 |
| C-311/18 | Schrems II (Privacy Shield) | 5 | 47 |
| C-252/21 | Meta Platforms (Competition & GDPR) | 6 | 42 |
| C-683/21 | Nacionalinis (Credit scoring) | 3 | 30 |

**Success rate: 7/7 (100%)**

---

## Quick Start

To run the MVP extractor:

```bash
cd experiments/ecj-decisions
npm install
node run.mjs C-311/18              # Single case
node run.mjs --gdpr                # All 7 GDPR landmark cases
node run.mjs --json C-311/18       # JSON output
```
