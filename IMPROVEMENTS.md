# LegalViz.EU — Improvement Roadmap

A reflection on areas where the tool can be further improved, organized by priority and impact.

---

## 1. Testing (Critical Gap)

The project currently has **zero automated tests**. This is the single biggest risk to long-term maintainability.

**Recommendations:**
- Add **Vitest** for unit testing pure-logic utilities (`fmxParser.js`, `nlp.js`, `definitions.js`, `url.js`)
- Add **React Testing Library** for component tests
- Add **Playwright** or **Cypress** for E2E testing of the core reading flow
- Parsing logic (`fmxParser.js`, 1002 lines) and NLP (`nlp.js`, 375 lines) are especially critical to test — regressions would silently corrupt the displayed data

---

## 2. Component Decomposition

`LawViewer.jsx` is **1,796 lines** — too large for a single component.

**Suggested splits:**
- `ArticleView` — article rendering and scroll management
- `RecitalsBrowser` — recitals grid and navigation
- `AnnexesBrowser` — annexes display
- `TableOfContents` — sidebar TOC logic
- `DualPaneView` — side-by-side comparison mode
- Custom hooks: `useArticleNavigation`, `useScrollSync`, `useTocHighlight`

Similarly, `TopBar.jsx` (588 lines) could extract search into a dedicated component and hook.

---

## 3. Accessibility (a11y)

For a legal tool, accessibility is essential:
- Add proper **ARIA landmarks** and roles (`navigation`, `main`, `complementary`)
- Ensure **keyboard navigation** works throughout the TOC and article panes
- Add **skip-to-content** links
- Test with screen readers
- Verify **color contrast** in both light and dark modes
- Add `aria-live` regions for dynamic content updates (search results, related recitals)

---

## 4. Performance Optimizations

- **Virtualize long lists** — Use `react-window` or `react-virtuoso` for TOC and recitals grid in laws with 100+ articles
- **Web Workers for NLP** — Move TF-IDF computation off the main thread to avoid UI jank
- **Lazy-load components** — Print modal, add-law dialog, and dual-pane view should use `React.lazy()`
- **Memoize expensive renders** — Article content with definition highlighting and cross-references

---

## 5. Offline-First / PWA Enhancements

- **Pre-cache all 6 bundled laws** for full offline support on first visit
- **Background sync** for importing new laws when connectivity returns
- **Install prompt** with clear UX for saving the app to home screen

---

## 6. Search Enhancements

- **Fuzzy matching** — Handle variant spellings, abbreviations (e.g., Fuse.js)
- **Filter by section type** — Articles only, recitals only
- **Search history** — Persist recent queries
- **Better result context** — Show more surrounding text with highlighted matches

---

## 7. Cross-Reference Improvements

- **Bidirectional navigation** — Show which articles reference the current one (back-references)
- **External law linking** — When a law references another EU regulation, link to it in LegalViz if loaded
- **Visual reference graph** — Network visualization of article-to-article and article-to-recital relationships

---

## 8. Comparison & Annotation Features

- **Version comparison** — Show diffs between amendment versions of a law
- **Multi-language comparison** — Explicit side-by-side view of same article in two languages
- **User annotations** — Highlight passages, add notes, bookmark articles (stored in IndexedDB)

---

## 9. Developer Experience

- **TypeScript migration** — Catch bugs in complex parsing/NLP code; improve IDE support
- **Storybook** — Develop and document UI components in isolation
- **CI pipeline** — Add lint and test steps to the GitHub Actions workflow (currently deploy-only)
- **API documentation** — OpenAPI/Swagger docs for backend endpoints

---

## 10. Content & Data Expansion

- **More pre-loaded laws** — ePrivacy Directive, REACH, MiFID II, etc.
- **Amendment tracking** — Show when articles were added, modified, or repealed
- **Structured metadata** — Entry-into-force dates, applicability dates, transition periods per article
