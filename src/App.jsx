import React, { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { LAWS } from "./constants/laws.js";
import { fetchText } from "./utils/fetch.js";
import { parseAnyToCombined } from "./utils/parsers.js";
import { getLawPathFromKey } from "./utils/url.js";
import { Button } from "./components/Button.jsx";
import { Accordion } from "./components/Accordion.jsx";
import { Landing } from "./components/Landing.jsx";
import { TopBar } from "./components/TopBar.jsx";

// ---------------- Law Viewer Component ----------------
function LawViewer() {
  const { key } = useParams();
  const navigate = useNavigate();
  const lawPath = getLawPathFromKey(key);
  const [data, setData] = useState({ articles: [], recitals: [], annexes: [] });
  const [selected, setSelected] = useState({ kind: "article", id: null, html: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const contentRef = useRef(null); // used to jump the page to the content block

  const loadLaw = React.useCallback(async (path) => {
    if (!path) return;
    setLoading(true);
    setError("");
    setSelected({ kind: "article", id: null, html: "" });
    try {
      const text = await fetchText(path);
      const combined = parseAnyToCombined(text);
      setData(combined);
      // Default select first available thing
      if (combined.articles?.[0]) {
        const a0 = combined.articles[0];
        setSelected({ kind: "article", id: a0.article_number, html: a0.article_html });
      } else if (combined.recitals?.[0]) {
        const r0 = combined.recitals[0];
        setSelected({ kind: "recital", id: r0.recital_number, html: r0.recital_html });
      } else if (combined.annexes?.[0]) {
        const x0 = combined.annexes[0];
        setSelected({ kind: "annex", id: x0.annex_id, html: x0.annex_html });
      }
    } catch (e) {
      setError(String(e.message || e));
      setData({ articles: [], recitals: [], annexes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load law when path changes
  useEffect(() => {
    if (lawPath) {
      loadLaw(lawPath);
    } else if (key) {
      // Only redirect if we have a key but no matching law path
      navigate("/", { replace: true });
    }
  }, [lawPath, key, loadLaw, navigate]);

  // Group articles by chapter for TOC
  const toc = useMemo(() => {
    const chapters = [];
    const chMap = new Map(); // chapterLabel -> chapterObj

    const label = (d) => (d ? [d.number, d.title].filter(Boolean).join(" — ").trim() : "");

    for (const a of data.articles) {
      const chLabel = label(a?.division?.chapter) || "(Untitled Chapter)";
      const scLabel = label(a?.division?.section) || null;

      let ch = chMap.get(chLabel);
      if (!ch) {
        ch = { label: chLabel, items: [], sections: [], secMap: new Map() };
        chMap.set(chLabel, ch);
        chapters.push(ch);
      }

      if (scLabel) {
        let sec = ch.secMap.get(scLabel);
        if (!sec) {
          sec = { label: scLabel, items: [] };
          ch.secMap.set(scLabel, sec);
          ch.sections.push(sec);
        }
        sec.items.push(a);
      } else {
        ch.items.push(a);
      }
    }

    // drop helper maps before rendering
    chapters.forEach((c) => delete c.secMap);
    return chapters;
  }, [data.articles]);

  // --- Selection helpers ---
  const selectArticleIdx = (idx) => {
    const a = data.articles[idx];
    if (!a) return;
    setSelected({ kind: "article", id: a.article_number, html: a.article_html });
  };
  const selectRecitalIdx = (idx) => {
    const r = data.recitals[idx];
    if (!r) return;
    setSelected({ kind: "recital", id: r.recital_number, html: r.recital_html });
  };
  const selectAnnexIdx = (idx) => {
    const x = data.annexes[idx];
    if (!x) return;
    setSelected({ kind: "annex", id: x.annex_id, html: x.annex_html });
  };

  const onPrevNext = (kind, nextIndex) => {
    if (kind === "article") return selectArticleIdx(nextIndex);
    if (kind === "recital") return selectRecitalIdx(nextIndex);
    if (kind === "annex") return selectAnnexIdx(nextIndex);
  };

  const onClickArticle = (a) =>
    selectArticleIdx(data.articles.findIndex((x) => x.article_number === a.article_number));
  const onClickRecital = (r) =>
    selectRecitalIdx(data.recitals.findIndex((x) => x.recital_number === r.recital_number));
  const onClickAnnex = (ax) =>
    selectAnnexIdx(data.annexes.findIndex((x) => x.annex_id === ax.annex_id));

  // When selection changes, jump to the content display
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected.kind, selected.id]);

  // --------- Main visualiser UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <TopBar
        lawKey={key}
        lists={{ articles: data.articles, recitals: data.recitals, annexes: data.annexes }}
        selected={selected}
        onPrevNext={onPrevNext}
      />

      <main className="w-full px-6 py-6">
        {/* Top grid: TOC | Annexes | Recitals */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* TOC */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold">Table of Contents</h2>
            <p className="mt-1 text-sm text-gray-600">Chapters and Articles.</p>
            <div className="mt-3 space-y-2">
              {toc.map((ch) => (
                <Accordion key={ch.label} title={ch.label || "(Untitled Chapter)"}>
                  {ch.items?.length > 0 && (
                    <ul className="space-y-1">
                      {ch.items.map((a) => (
                        <li key={`toc-${a.article_number}`}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-left"
                            onClick={() => onClickArticle(a)}
                          >
                            <span className="truncate text-left">
                              Article {a.article_number}: {a.article_title}
                            </span>
                            <span className="text-xs text-gray-500">›</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {ch.sections?.map((sec) => (
                    <div key={sec.label} className="mt-3">
                      <div className="border-t border-gray-100 pt-2 text-center text-sm font-semibold text-gray-700">
                        {sec.label}
                      </div>
                      <ul className="mt-1 space-y-1">
                        {sec.items.map((a) => (
                          <li key={`toc-${a.article_number}`}>
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-left"
                              onClick={() => onClickArticle(a)}
                            >
                              <span className="truncate text-left">
                                Article {a.article_number}: {a.article_title}
                              </span>
                              <span className="text-xs text-gray-500">›</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Accordion>
              ))}
              {toc.length === 0 && <div className="text-sm text-gray-600">No articles detected.</div>}
            </div>
          </section>

          {/* Annexes */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold">Annexes</h2>
            <p className="mt-1 text-sm text-gray-600">Supplementary material.</p>
            <div className="mt-3 space-y-2">
              {data.annexes?.length ? (
                data.annexes.map((ax, i) => (
                  <Button
                    key={`annex-${i}`}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => onClickAnnex(ax)}
                  >
                    <span className="truncate text-left">{ax.annex_title || ax.annex_id}</span>
                    <span className="text-xs text-gray-500">›</span>
                  </Button>
                ))
              ) : (
                <div className="text-sm text-gray-600">No annexes detected.</div>
              )}
            </div>
          </section>

          {/* Recitals grid */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold">Recitals</h2>
            <p className="mt-1 text-sm text-gray-600">Context for interpretation.</p>
            <div className="mt-3 grid grid-cols-8 gap-2 md:grid-cols-10">
              {data.recitals?.map((r) => (
                <Button
                  key={`rbtn-${r.recital_number}`}
                  variant="outline"
                  className="px-2 py-1"
                  onClick={() => onClickRecital(r)}
                >
                  {r.recital_number}
                </Button>
              ))}
              {(!data.recitals || data.recitals.length === 0) && (
                <div className="col-span-full text-sm text-gray-600">No recitals.</div>
              )}
            </div>
          </section>
        </div>

        {/* Selected content viewer */}
        <section ref={contentRef} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="article-header">
            Selected: {selected.kind} {selected.id || "–"}
            {loading && <span className="ml-2 text-xs text-gray-500">(loading…)</span>}
          </div>
          <article
            className="prose prose-base mx-auto max-w-3xl md:prose-lg"
            dangerouslySetInnerHTML={{
              __html: selected.html || "<em>Select an article, recital, or annex.</em>",
            }}
          />
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------- App ----------------
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/law/:key" element={<LawViewer />} />
    </Routes>
  );
}
