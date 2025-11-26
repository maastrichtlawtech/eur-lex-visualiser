import React, { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  const { key, kind, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lawPath = getLawPathFromKey(key);
  const [data, setData] = useState({ articles: [], recitals: [], annexes: [] });
  const [selected, setSelected] = useState({ kind: "article", id: null, html: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExtensionMode, setIsExtensionMode] = useState(false);

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
    } catch (e) {
      setError(String(e.message || e));
      setData({ articles: [], recitals: [], annexes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFromExtension = React.useCallback(async (htmlString) => {
    if (!htmlString) {
      console.error('loadFromExtension called with empty htmlString');
      return;
    }
    setLoading(true);
    setError("");
    setSelected({ kind: "article", id: null, html: "" });
    setIsExtensionMode(true);
    try {
      console.log('Parsing HTML from extension, length:', htmlString.length);
      const combined = parseAnyToCombined(htmlString);
      console.log('Parsed result:', {
        articles: combined.articles?.length || 0,
        recitals: combined.recitals?.length || 0,
        annexes: combined.annexes?.length || 0
      });
      setData(combined);
    } catch (e) {
      console.error('Error parsing HTML from extension:', e);
      setError(String(e.message || e));
      setData({ articles: [], recitals: [], annexes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for extension HTML from injected script tag in DOM
  useEffect(() => {
    const isExtension = searchParams.get('extension') === 'true';
    const storageKey = searchParams.get('key');
    
    if (isExtension && storageKey) {
      console.log('Extension mode detected, storage key:', storageKey);
      
      let loaded = false;
      
      // Try to get HTML from DOM (injected by content script)
      const checkForHtml = () => {
        const scriptTag = document.getElementById('eurlex-extension-html');
        if (scriptTag && scriptTag.textContent && !loaded) {
          const html = scriptTag.textContent;
          console.log('Found HTML from extension in DOM, length:', html.length);
          loaded = true;
          loadFromExtension(html);
          return true;
        }
        return false;
      };
      
      // Check immediately
      if (checkForHtml()) {
        return;
      }
      
      // Also check on DOM ready
      const handleDOMReady = () => {
        if (!loaded) {
          console.log('DOM ready, checking for HTML...');
          checkForHtml();
        }
      };
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleDOMReady);
      } else {
        handleDOMReady();
      }
      
      // Poll for the script tag
      let attempts = 0;
      const pollInterval = setInterval(() => {
        attempts++;
        if (checkForHtml() || loaded || attempts > 100) {
          clearInterval(pollInterval);
          if (attempts > 100 && !loaded) {
            const scriptTag = document.getElementById('eurlex-extension-html');
            if (!scriptTag) {
              console.error('Failed to find extension HTML script tag after polling');
              setError('Failed to load HTML from extension. Please try capturing the page again.');
            } else if (!scriptTag.textContent) {
              console.error('Extension HTML script tag found but empty');
              setError('Extension HTML script tag is empty. Please try capturing the page again.');
            }
          }
        }
      }, 50); // Check every 50ms for up to 5 seconds
      
      return () => {
        document.removeEventListener('DOMContentLoaded', handleDOMReady);
        clearInterval(pollInterval);
      };
    }
  }, [searchParams, loadFromExtension]);

  // Load law when path changes
  useEffect(() => {
    if (isExtensionMode) return; // Don't load from file if we're in extension mode
    
    if (lawPath) {
      loadLaw(lawPath);
    } else if (key) {
      // Only redirect if we have a key but no matching law path
      navigate("/", { replace: true });
    }
  }, [lawPath, key, loadLaw, navigate, isExtensionMode]);

  // Update selection from URL params when data is loaded or URL params change
  useEffect(() => {
    if (!data.articles?.length && !data.recitals?.length && !data.annexes?.length) {
      // Data not loaded yet, wait for it
      return;
    }

    // Try to select from URL params
    if (kind && id) {
      let found = false;
      if (kind === "article") {
        const article = data.articles?.find(a => a.article_number === id);
        if (article) {
          setSelected({ kind: "article", id: article.article_number, html: article.article_html });
          found = true;
        }
      } else if (kind === "recital") {
        const recital = data.recitals?.find(r => r.recital_number === id);
        if (recital) {
          setSelected({ kind: "recital", id: recital.recital_number, html: recital.recital_html });
          found = true;
        }
      } else if (kind === "annex") {
        const annex = data.annexes?.find(a => a.annex_id === id);
        if (annex) {
          setSelected({ kind: "annex", id: annex.annex_id, html: annex.annex_html });
          found = true;
        }
      }
      
      if (found) {
        return;
      }
    }

    // If no URL params or they didn't match, select default and update URL
    if (!kind || !id) {
      const extensionKey = isExtensionMode ? searchParams.get('key') : null;
      const extensionParams = extensionKey ? `?extension=true&key=${extensionKey}` : '';
      
      if (data.articles?.[0]) {
        const a0 = data.articles[0];
        setSelected({ kind: "article", id: a0.article_number, html: a0.article_html });
        if (isExtensionMode) {
          // In extension mode, update URL without key
          navigate(`/extension/article/${a0.article_number}${extensionParams}`, { replace: true });
        } else {
          navigate(`/law/${key}/article/${a0.article_number}`, { replace: true });
        }
      } else if (data.recitals?.[0]) {
        const r0 = data.recitals[0];
        setSelected({ kind: "recital", id: r0.recital_number, html: r0.recital_html });
        if (isExtensionMode) {
          navigate(`/extension/recital/${r0.recital_number}${extensionParams}`, { replace: true });
        } else {
          navigate(`/law/${key}/recital/${r0.recital_number}`, { replace: true });
        }
      } else if (data.annexes?.[0]) {
        const x0 = data.annexes[0];
        setSelected({ kind: "annex", id: x0.annex_id, html: x0.annex_html });
        if (isExtensionMode) {
          navigate(`/extension/annex/${x0.annex_id}${extensionParams}`, { replace: true });
        } else {
          navigate(`/law/${key}/annex/${x0.annex_id}`, { replace: true });
        }
      }
    }
  }, [data, kind, id, key, navigate, isExtensionMode, searchParams]);

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

  const getExtensionParams = useMemo(() => {
    if (!isExtensionMode) return '';
    const extensionKey = searchParams.get('key');
    return extensionKey ? `?extension=true&key=${extensionKey}` : '?extension=true';
  }, [isExtensionMode, searchParams]);

  const selectArticleIdx = (idx) => {
    const a = data.articles[idx];
    if (!a) return;
    setSelected({ kind: "article", id: a.article_number, html: a.article_html });
    if (isExtensionMode) {
      navigate(`/extension/article/${a.article_number}${getExtensionParams}`, { replace: true });
    } else {
      navigate(`/law/${key}/article/${a.article_number}`, { replace: true });
    }
  };
  const selectRecitalIdx = (idx) => {
    const r = data.recitals[idx];
    if (!r) return;
    setSelected({ kind: "recital", id: r.recital_number, html: r.recital_html });
    if (isExtensionMode) {
      navigate(`/extension/recital/${r.recital_number}${getExtensionParams}`, { replace: true });
    } else {
      navigate(`/law/${key}/recital/${r.recital_number}`, { replace: true });
    }
  };
  const selectAnnexIdx = (idx) => {
    const x = data.annexes[idx];
    if (!x) return;
    setSelected({ kind: "annex", id: x.annex_id, html: x.annex_html });
    if (isExtensionMode) {
      navigate(`/extension/annex/${x.annex_id}${getExtensionParams}`, { replace: true });
    } else {
      navigate(`/law/${key}/annex/${x.annex_id}`, { replace: true });
    }
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

  // Update document title based on current law and selection
  useEffect(() => {
    if (isExtensionMode) {
      if (selected.id) {
        const kindLabel = selected.kind === "article" ? "Article" : selected.kind === "recital" ? "Recital" : "Annex";
        document.title = `Custom Law - ${kindLabel} ${selected.id} | EU Law Visualiser`;
      } else {
        document.title = "Custom Law | EU Law Visualiser";
      }
    } else if (key) {
      const law = LAWS.find(l => l.key === key);
      const lawName = law ? law.label : key;
      
      if (selected.id) {
        const kindLabel = selected.kind === "article" ? "Article" : selected.kind === "recital" ? "Recital" : "Annex";
        document.title = `${lawName} - ${kindLabel} ${selected.id} | EU Law Visualiser`;
      } else {
        document.title = `${lawName} | EU Law Visualiser`;
      }
    } else {
      document.title = "EU Law Visualiser";
    }
  }, [key, selected.kind, selected.id, isExtensionMode]);

  // --------- Main visualiser UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <TopBar
        lawKey={isExtensionMode ? "extension" : key}
        lists={{ articles: data.articles, recitals: data.recitals, annexes: data.annexes }}
        selected={selected}
        onPrevNext={onPrevNext}
        isExtensionMode={isExtensionMode}
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
      <Route path="/law/:key/:kind/:id" element={<LawViewer />} />
      {/* Extension routes - no key needed */}
      <Route path="/extension" element={<LawViewer />} />
      <Route path="/extension/:kind/:id" element={<LawViewer />} />
    </Routes>
  );
}
