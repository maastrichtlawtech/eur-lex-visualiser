# LegalViz.EU — Improvement Roadmap

A reflection on areas where the tool can be further improved, grouped by the
kind of benefit they deliver. The app is already a pleasant EU-law reader with
tests, decomposed components, PWA caching, CJEU case law, grounded Q&A, and
bidirectional cross-references — so this list focuses on what is still genuinely
open.

---

## 1. Reading-first wins (small scope, high felt value)

- **Hover previews for cross-references.** Clicking `Art 5(1)` today navigates
  away from the current article. A tooltip/popover showing the target article
  (and the same for `Recital (45)` mentions) keeps the reader in place.
- **Reading-position memory.** The library already tracks `lastOpened`; extend
  it to remember the last selected article/recital per law so returning to a
  law lands you where you stopped.
- **Per-paragraph anchors.** URLs currently anchor at the article level;
  deep-linking to `Art 5(1)(a)` would make shared links precise enough for
  footnotes and teaching.
- **Glossary view.** One page listing every defined term in a law with its
  definition and the article that defines it. The parser already surfaces this
  data.
- **Inline recital tooltips.** The app already links recitals to articles in a
  sidebar; a hover preview on inline `(45)` mentions would save a click.

## 2. Citations & academic use

- **"Copy as citation"** — a button that produces a clean, shareable citation
  at the current selection. Useful formats:
  - Plain-text legal citation (e.g. `Art 5(1)(a) Regulation (EU) 2016/679`).
  - **OSCOLA** — the standard in UK/EU legal academia, including the correct
    punctuation for EU instruments and pinpoint references.
  - **Bluebook** for US-style academic work.
  - **BibTeX / RIS** for reference managers.
- **Permanent-link pinning.** Today a shared URL always resolves to the latest
  consolidated text; pinning to a consolidation date (or to the original act
  vs. the current consolidation) would stop links from silently changing
  meaning over time.
- **Source provenance line.** A small footer noting "fetched from EUR-Lex on
  YYYY-MM-DD" reassures academic users citing the tool.

## 3. Versioning, amendments, effective dates

- **Article-level amendment diffs.** `AmendmentHistory.jsx` lists amendments
  but the reader doesn't show *what changed* in the article you're on. Even a
  "last modified by Regulation 2018/1971" badge per article would help; a full
  paragraph-level diff would be the gold standard.
- **Phased applicability / effective dates.** Acts like the AI Act have
  different entry-into-force dates per article. Surface this on the article
  header rather than only in the law-level metadata panel.
- **"What's new" view** for laws that have been recently amended: highlight
  the articles affected by the most recent amendment.

## 4. Visualisation — focused, not a hairball

A full network graph of every cross-reference in GDPR is a hairball and does
not help reading. More targeted alternatives:

- **Per-article "neighbourhood" widget.** A tiny 1-hop diagram showing only
  what *this* article references and what references *it* (incl. CJEU cases).
  Stays embedded in the reader.
- **TOC density signals.** Small dots/bars next to each TOC entry indicating
  cross-ref count and case-law count — a "where the action is" hint.
- **Cross-law citation chord/sankey.** If a larger viz is wanted, the
  interesting story is *which other EU acts a given law cites and is cited
  by*, which a small diagram tells well.
- **Optional "Law map" page** — a separate, opt-in route for users who really
  do want the full graph, kept off the core reading path.

## 5. Search

- **Fuzzy and Boolean search** (Fuse.js or MiniSearch) — handles typos and
  queries like `"data AND processing NOT consent"`.
- **Escalating scopes**: current article → current chapter → whole law → all
  laws, as the user widens the query.
- **Richer result previews** in the TOC hit list (more surrounding text,
  highlighted matches).
- **Search history** — persist and surface recent queries.

## 6. Parsing & data quality

- **Recitals on legacy acts are not parsed correctly.** The Data Protection
  Directive (95/46/EC) is a clear example — its recitals come out mangled or
  missing. Older pre-Formex / pre-2004 HTML layouts need dedicated extraction
  rules; this matters for directives that are still influential despite being
  repealed or consolidated away.
- **Sub-paragraph structure.** Some long paragraphs (e.g. GDPR Art 6(1)) are
  rendered as one block; surfacing `(a)–(f)` as navigable sub-units would help
  both the reader and deep-linking.
- **Annex tables.** Tables inside annexes occasionally lose alignment in the
  Formex → HTML step.

## 7. Accessibility (still a real gap)

- Proper ARIA landmarks (`navigation`, `main`, `complementary`), skip-to-content
  link.
- Focus management when opening the print modal, add-law dialog, case-law
  modal, or switching to side-by-side.
- Keyboard coverage for the TOC, cross-reference chips, and recital grid.
- Screen-reader testing and a colour-contrast audit in both themes.
- `aria-live` for async regions (search results, related recitals/case law).

## 8. Performance

- **Web Worker for NLP / TF-IDF and search-index builds** — large laws (AI
  Act) can jank the main thread during the initial index build.
- **Virtualize long lists** for laws with 100+ articles (TOC, recital grid,
  case-law list in the modal).
- **Skeleton states** for the related-recitals and related-case-law panels so
  the layout doesn't jump when they resolve.
- **Pre-cache the bundled laws** in the service worker on install so the
  curated library is fully offline from first visit.

## 9. Annotations & personal state

- **Highlights and notes** stored locally in IndexedDB, scoped per law.
- **Bookmarks** at article/paragraph level.
- **Export / import** of the user's annotations and library as a single JSON
  file so power users can back up or move between devices.

## 10. Component & code health

- **Decompose `TopBar.jsx`** (currently ~1,200 lines) — extract `SearchBox`,
  the language switcher, and font controls. `LawViewer.jsx` has already been
  split nicely; `TopBar` is now the outlier.
- **TypeScript migration**, at least for `utils/` and the Formex parser where
  subtle shape bugs would hurt most.
- **Storybook** (or equivalent) for the viewer primitives — useful because
  component states depend heavily on parsed-law shape.

## 11. Content & library

- **More curated starter laws**: DSA, DMA, NIS2, Data Act, ePrivacy Directive,
  REACH, MiFID II.
- **Language coverage for bundled metadata** — titles/subtitles in all 24 UI
  locales for the curated list so the landing looks right regardless of
  language.

---

## Already shipped (for context, since the previous roadmap predated them)

- Vitest unit tests across parser, NLP, routing, library, viewer hooks; CI
  runs `npm test` on every push.
- `LawViewer.jsx` decomposed into `components/law-viewer/*` and
  `hooks/law-viewer/*` (was 1,796 lines, now ~430).
- PWA via `vite-plugin-pwa` with manifest and workbox runtime caching.
- Bidirectional cross-references and external-law linking in
  `CrossReferences.jsx`.
- CJEU case-law integration with article-level matching and the operative part
  parsed for both modern EUR-Lex and legacy Curia HTML.
- Grounded Q&A over a planner → answerer pipeline with per-claim citations.
- Side-by-side dual-language reading in all 24 official EU languages.
- 24 UI locales.
