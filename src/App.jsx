import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { LAWS } from "./constants/laws.js";
import { fetchText } from "./utils/fetch.js";
import { parseAnyToCombined } from "./utils/parsers.js";
import { getLawPathFromKey } from "./utils/url.js";
import { mapRecitalsToArticles } from "./utils/nlp.js";
import { Button } from "./components/Button.jsx";
import { Accordion } from "./components/Accordion.jsx";
import { Landing } from "./components/Landing.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { NavigationControls } from "./components/NavigationControls.jsx";
import { PrintModal } from "./components/PrintModal.jsx";
import { PrintView } from "./components/PrintView.jsx";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

function NumberSelector({ label, total, onSelect }) {
  const [val, setVal] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= total) {
      onSelect(num);
      setVal("");
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex-1 min-w-[140px]">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <input
            type="number"
            min="1"
            max={total}
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              setError(false);
            }}
            className={`block w-full rounded-lg border px-3 py-2 text-sm outline-none transition pr-14 bg-gray-50 ${
              error
                ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50"
                : "border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            }`}
            placeholder={`${label} (1-${total})`}
          />
          <button
            type="submit"
            disabled={!val}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-white hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 shadow-sm"
          >
            Go
          </button>
        </div>
        {error && <p className="absolute top-full left-0 mt-1 text-[10px] text-red-600">Invalid range</p>}
      </form>
    </div>
  );
}

// ---------------- Related Recitals Component ----------------
function RelatedRecitals({ recitals, onSelectRecital }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!recitals || recitals.length === 0) return null;

  return (
    <div className="mt-8 rounded-xl border border-blue-100 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-8 py-5 text-left transition hover:bg-gray-50"
      >
        <div className="flex items-center gap-2 text-blue-900">
          <span className="font-semibold">Related Recitals</span>
          <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
            {recitals.length}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-blue-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-blue-500" />
        )}
      </button>

        {isOpen && (
        <div className="px-8 pb-8 pt-2 space-y-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            These recitals appear to be related to this article based text analysis using simple AI. They do not have the quality of manually curated legal databases but exist for any EU law loaded in this visualiser.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2 items-start">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Pro Tip:</strong> Use the <strong>Print / PDF</strong> button in the top bar to generate a document with these related recitals included next to their articles.
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {recitals.map((r) => (
              <div
                key={r.recital_number}
                className="group relative flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-5 transition hover:border-blue-300 hover:bg-white hover:shadow-md cursor-pointer"
                onClick={() => onSelectRecital(r)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-gray-900">
                    Recital {r.recital_number}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 font-medium">
                    Read →
                  </span>
                </div>
                <div 
                  className="text-sm text-gray-600 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: r.recital_html }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Law Viewer Component ----------------
function LawViewer() {
  const { key, kind, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lawPath = getLawPathFromKey(key);
  const [data, setData] = useState({ title: "", articles: [], recitals: [], annexes: [] });
  const [recitalMap, setRecitalMap] = useState(new Map());
  const [selected, setSelected] = useState({ kind: "article", id: null, html: "" });
  const [returnToArticle, setReturnToArticle] = useState(null); // { id: string, title: string } | null
  const [openChapter, setOpenChapter] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExtensionMode, setIsExtensionMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

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
      setData({ title: "", articles: [], recitals: [], annexes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFromExtension = React.useCallback(async (htmlString, metadata) => {
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
      
      // Use metadata title if available and parsed title is empty or generic
      if (metadata?.title && (!combined.title || combined.title === 'Untitled Law')) {
        combined.title = metadata.title;
      }

      // Use metadata url if available
      if (metadata?.url) {
        // Ensure we link to the main text view, not the HTML-specific view
        combined.eurlex = metadata.url.replace(/\/TXT\/HTML\//, '/TXT/');
      }
      
      console.log('Parsed result:', {
        articles: combined.articles?.length || 0,
        recitals: combined.recitals?.length || 0,
        annexes: combined.annexes?.length || 0
      });
      setData(combined);
    } catch (e) {
      console.error('Error parsing HTML from extension:', e);
      setError(String(e.message || e));
      setData({ title: "", articles: [], recitals: [], annexes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data.articles?.length > 0 && data.recitals?.length > 0) {
      // Run NLP mapping in a timeout to not block initial render
      const timer = setTimeout(() => {
        const map = mapRecitalsToArticles(data.recitals, data.articles);
        setRecitalMap(map);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setRecitalMap(new Map());
    }
  }, [data.articles, data.recitals]);

  // Ref to track the currently loaded law key to prevent re-loading on navigation
  const loadedKeyRef = React.useRef(null);

  // Request law content via postMessage when in extension mode
  useEffect(() => {
    const isExtension = searchParams.get('extension') === 'true';
    const storageKey = searchParams.get('key');
    
    if (isExtension && storageKey) {
      // If we already loaded this key and have data, don't reload.
      // This prevents reloading when navigating between articles of the same law.
      if (loadedKeyRef.current === storageKey && data.title) {
        return;
      }

      console.log('Extension mode detected, loading storage key:', storageKey);
      loadedKeyRef.current = storageKey;
      setIsExtensionMode(true);
      setLoading(true);
      
      let isResponseReceived = false;
      
      const handleMessage = (event) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'EURLEX_LAW_DATA') {
          const payload = event.data.payload;
          if (payload.error) {
            console.error('Extension error:', payload.error);
            setError(`Error loading law: ${payload.error}`);
            setLoading(false);
            isResponseReceived = true;
          } else if (payload.html) {
            console.log('Received law data from extension');
            isResponseReceived = true;
            loadFromExtension(payload.html, payload.metadata);
          } else {
            // Empty response, wait for retry
          }
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Request data immediately
      window.postMessage({ type: 'EURLEX_GET_LAW', key: storageKey }, '*');
      
      // Poll in case the extension bridge script hasn't loaded yet
      const pollInterval = setInterval(() => {
        if (isResponseReceived) {
          clearInterval(pollInterval);
          return;
        }
        console.log('Polling for law data...');
        window.postMessage({ type: 'EURLEX_GET_LAW', key: storageKey }, '*');
      }, 500);
      
      // Stop polling after 5 seconds to avoid infinite loops if something is wrong
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        if (!isResponseReceived && !data.title) {
           setError("Timed out waiting for extension data. Please ensure the extension is installed and active.");
           setLoading(false);
        }
      }, 5000);
      
      return () => {
        window.removeEventListener('message', handleMessage);
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }
  }, [searchParams, loadFromExtension, data.title]);

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

  // Auto-expand TOC chapter when selection changes
  useEffect(() => {
    if (selected.kind === "article" && selected.id && toc.length > 0) {
      const foundCh = toc.find(
        (ch) =>
          ch.items.some((a) => a.article_number === selected.id) ||
          ch.sections.some((s) => s.items.some((a) => a.article_number === selected.id))
      );
      if (foundCh) {
        setOpenChapter(foundCh.label);
      }
    }
  }, [selected.kind, selected.id, toc]);

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
      navigate(`/extension/article/${a.article_number}${getExtensionParams}`);
    } else {
      navigate(`/law/${key}/article/${a.article_number}`);
    }
  };
  const selectRecitalIdx = (idx) => {
    const r = data.recitals[idx];
    if (!r) return;
    setSelected({ kind: "recital", id: r.recital_number, html: r.recital_html });
    if (isExtensionMode) {
      navigate(`/extension/recital/${r.recital_number}${getExtensionParams}`);
    } else {
      navigate(`/law/${key}/recital/${r.recital_number}`);
    }
  };
  const selectAnnexIdx = (idx) => {
    const x = data.annexes[idx];
    if (!x) return;
    setSelected({ kind: "annex", id: x.annex_id, html: x.annex_html });
    if (isExtensionMode) {
      navigate(`/extension/annex/${x.annex_id}${getExtensionParams}`);
    } else {
      navigate(`/law/${key}/annex/${x.annex_id}`);
    }
  };

  const onPrevNext = React.useCallback((kind, nextIndex) => {
    if (kind === "article") return selectArticleIdx(nextIndex);
    if (kind === "recital") return selectRecitalIdx(nextIndex);
    if (kind === "annex") return selectAnnexIdx(nextIndex);
  }, [selectArticleIdx, selectRecitalIdx, selectAnnexIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input or textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        const { articles, recitals, annexes } = data;
        let currentList = [];
        let currentId = selected.id;
        
        if (selected.kind === "article") currentList = articles;
        else if (selected.kind === "recital") currentList = recitals;
        else if (selected.kind === "annex") currentList = annexes;

        if (currentList && currentList.length > 0) {
           const idx = currentList.findIndex(item => 
             (item.article_number === currentId) || 
             (item.recital_number === currentId) || 
             (item.annex_id === currentId)
           );
           if (idx > 0) onPrevNext(selected.kind, idx - 1);
        }
      } else if (e.key === "ArrowRight") {
        const { articles, recitals, annexes } = data;
        let currentList = [];
        let currentId = selected.id;
        
        if (selected.kind === "article") currentList = articles;
        else if (selected.kind === "recital") currentList = recitals;
        else if (selected.kind === "annex") currentList = annexes;

        if (currentList && currentList.length > 0) {
           const idx = currentList.findIndex(item => 
             (item.article_number === currentId) || 
             (item.recital_number === currentId) || 
             (item.annex_id === currentId)
           );
           if (idx >= 0 && idx < currentList.length - 1) onPrevNext(selected.kind, idx + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, data, onPrevNext]);

  // Touch swipe navigation
  const touchStartRef = React.useRef(null);
  const touchEndRef = React.useRef(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    touchEndRef.current = null; 
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const { articles, recitals, annexes } = data;
    let currentList = [];
    let currentId = selected.id;
    
    if (selected.kind === "article") currentList = articles;
    else if (selected.kind === "recital") currentList = recitals;
    else if (selected.kind === "annex") currentList = annexes;

    if (currentList && currentList.length > 0) {
       const idx = currentList.findIndex(item => 
         (item.article_number === currentId) || 
         (item.recital_number === currentId) || 
         (item.annex_id === currentId)
       );
       
       if (isLeftSwipe) {
         // Swipe Left -> Next Article
         if (idx >= 0 && idx < currentList.length - 1) onPrevNext(selected.kind, idx + 1);
       } 
       if (isRightSwipe) {
         // Swipe Right -> Prev Article
         if (idx > 0) onPrevNext(selected.kind, idx - 1);
       }
    }
  };


  const onClickArticle = (a) => {
    setReturnToArticle(null); // Clear return path when explicitly selecting an article
    selectArticleIdx(data.articles.findIndex((x) => x.article_number === a.article_number));
  };
  const onClickRecital = (r, fromArticleId = null) => {
    // If we're coming from an article, save that state so we can go back
    if (fromArticleId) {
       setReturnToArticle({ id: fromArticleId });
    } else if (selected.kind !== "recital") {
       // If we navigate away to something else (article/annex), clear the return path
       setReturnToArticle(null);
    }
    
    selectRecitalIdx(data.recitals.findIndex((x) => x.recital_number === r.recital_number));
  };
  const onClickAnnex = (ax) => {
    setReturnToArticle(null);
    selectAnnexIdx(data.annexes.findIndex((x) => x.annex_id === ax.annex_id));
  };

  // Update document title based on current law and selection
  useEffect(() => {
    // Determine the base name of the law:
    // 1. data.title (parsed from HTML)
    // 2. LAWS entry label (if known key)
    // 3. "Custom Law" (if extension mode)
    // 4. key (fallback)
    let lawName = data.title;
    if (!lawName) {
      if (isExtensionMode) {
        lawName = "Custom Law";
      } else if (key) {
        const law = LAWS.find((l) => l.key === key);
        lawName = law ? law.label : key;
      } else {
        lawName = "EU Law Visualiser";
      }
    }

    if (selected.id) {
      const kindLabel =
        selected.kind === "article"
          ? "Article"
          : selected.kind === "recital"
          ? "Recital"
          : "Annex";
      document.title = `${lawName} - ${kindLabel} ${selected.id} | EU Law Visualiser`;
    } else {
      document.title = `${lawName} | EU Law Visualiser`;
    }
  }, [key, selected.kind, selected.id, isExtensionMode, data.title]);

  const eurlexUrl = useMemo(() => {
    if (isExtensionMode) return data.eurlex || null;
    const law = LAWS.find(l => l.key === key);
    return law ? law.eurlex : null;
  }, [key, isExtensionMode, data.eurlex]);

  // Handle printing
  useEffect(() => {
    if (printOptions) {
      const handlePrint = async () => {
        // Create new window
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          alert("Please allow popups to print");
          setPrintOptions(null);
          return;
        }

        // Copy styles
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
        styles.forEach(style => {
          printWindow.document.head.appendChild(style.cloneNode(true));
        });

        // Add extra print-specific styles to force visibility and background
        const extraStyle = printWindow.document.createElement("style");
        extraStyle.textContent = `
          body { background: white !important; margin: 0; }
          .print-container { display: block !important; }
        `;
        printWindow.document.head.appendChild(extraStyle);

        // Render PrintView into the new window
        const container = printWindow.document.createElement("div");
        container.className = "print-container";
        printWindow.document.body.appendChild(container);

        const root = createRoot(container);
        
        // Wrap in a promise to wait for render? 
        // React 18 createRoot is async-ish but text rendering is usually fast.
        // We'll use a small timeout to ensure styles are applied.
        root.render(<PrintView data={data} options={printOptions} />);

        // Wait for styles and content
        setTimeout(() => {
          printWindow.print();
          // Optional: printWindow.close(); // Don't auto-close so user can preview or PDF
          setPrintOptions(null);
        }, 500);
      };

      handlePrint();
    }
  }, [printOptions, data]);

  // --------- Main visualiser UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white print:bg-white">
      <div className="print:hidden">
        <TopBar
          lawKey={isExtensionMode ? "extension" : key}
          title={data.title}
          lists={{ articles: data.articles, recitals: data.recitals, annexes: data.annexes }}
          isExtensionMode={isExtensionMode}
          eurlexUrl={eurlexUrl}
          onPrint={() => setPrintModalOpen(true)}
        />

        <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:flex-row md:px-6">
        {/* Main Content Area (Left/Center) */}
        <div className="min-w-0 flex-1 order-2 md:order-1">
          <section 
            className="rounded-2xl border border-gray-200 bg-white p-8 md:p-12 shadow-sm min-h-[50vh]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-2xl font-bold font-serif text-gray-900 tracking-tight truncate min-w-0">
                {selected.kind === "article" && `Article ${selected.id || ""}`}
                {selected.kind === "recital" && `Recital ${selected.id || ""}`}
                {selected.kind === "annex" && `Annex ${selected.id || ""}`}
                {!selected.id && "No selection"}
              </h2>
            </div>

            <article
              className="prose prose-slate max-w-none md:prose-lg mt-4"
              dangerouslySetInnerHTML={{
                __html:
                  selected.html ||
                  "<div class='text-center text-gray-400 py-10'>Select an article, recital, or annex from the menu to begin reading.</div>",
              }}
            />
          </section>

            {selected.kind === "article" && (
            <RelatedRecitals
              recitals={recitalMap.get(selected.id) || []}
              onSelectRecital={(r) => onClickRecital(r, selected.id)}
            />
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Sidebar (Right) */}
        <aside className="w-full md:w-80 md:shrink-0 order-1 md:order-2 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
          {/* Mobile Navigation */}
          <div className="md:hidden mb-4">
            <NavigationControls
              selected={selected}
              lists={{ articles: data.articles, recitals: data.recitals, annexes: data.annexes }}
              onPrevNext={onPrevNext}
              className="w-full"
            />
          </div>

          {/* Mobile Toggle */}
          <div className="mb-4 md:hidden">
            <Button
              variant="outline"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full justify-between text-gray-900"
            >
              <span className="font-medium">Contents & Navigation</span>
              {mobileMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>

          <div className={`space-y-4 ${mobileMenuOpen ? "block" : "hidden md:block"}`}>
            {/* Quick Navigation */}
            <div>
              <div className="px-1 mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Quick Navigation</span>
                <div className="group relative">
                   <Info size={14} className="text-gray-400 cursor-help" />
                   <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                     Use arrow keys (←/→) or swipe on mobile to navigate between articles/recitals/annexes.
                   </div>
                </div>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:block mb-4">
                <NavigationControls
                  selected={selected}
                  lists={{ articles: data.articles, recitals: data.recitals, annexes: data.annexes }}
                  onPrevNext={onPrevNext}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-3">
                {data.articles?.length > 0 && (
                  <NumberSelector
                    label="Article"
                    total={data.articles.length}
                    onSelect={(n) => {
                      const idx = data.articles.findIndex(a => parseInt(a.article_number) === n);
                      if (idx !== -1) selectArticleIdx(idx);
                      else selectArticleIdx(n - 1);
                      setMobileMenuOpen(false);
                    }}
                  />
                )}

                {data.recitals?.length > 0 && (
                  <NumberSelector
                    label="Recital"
                    total={data.recitals.length}
                    onSelect={(n) => {
                      selectRecitalIdx(n - 1);
                      setMobileMenuOpen(false);
                    }}
                  />
                )}

                {data.annexes?.length > 0 && (
                  <NumberSelector
                    label="Annex"
                    total={data.annexes.length}
                    onSelect={(n) => {
                      selectAnnexIdx(n - 1);
                      setMobileMenuOpen(false);
                    }}
                  />
                )}
              </div>
            </div>

            {/* TOC */}
            <div className="pt-2">
              <div className="px-1 mb-2 text-sm font-semibold text-gray-900">
                Table of Contents
              </div>
              {toc.length > 0 ? (
                <div className="space-y-2">
                  {toc.map((ch) => {
                    const isOpen = openChapter === ch.label;
                    return (
                      <Accordion
                        key={ch.label}
                        title={ch.label || "(Untitled Chapter)"}
                        isOpen={isOpen}
                        onToggle={() => setOpenChapter(isOpen ? null : ch.label)}
                      >
                        {ch.items?.length > 0 && (
                          <ul className="space-y-1">
                            {ch.items.map((a) => (
                              <li key={`toc-${a.article_number}`}>
                                <Button
                                  variant="ghost"
                                  className={`w-full justify-start text-left ${
                                    selected.kind === "article" && selected.id === a.article_number
                                      ? "bg-blue-50 text-blue-700"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    onClickArticle(a);
                                    setMobileMenuOpen(false);
                                  }}
                                >
                                  <span className="truncate text-left w-full">
                                    <span className="font-medium">Art. {a.article_number}</span>
                                    {a.article_title && (
                                      <span className="ml-1 text-gray-500 font-normal opacity-80">
                                        - {a.article_title}
                                      </span>
                                    )}
                                  </span>
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}

                        {ch.sections?.map((sec) => (
                          <div key={sec.label} className="mt-3">
                            <div className="border-t border-gray-100 pt-2 pb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                              {sec.label}
                            </div>
                            <ul className="space-y-1">
                              {sec.items.map((a) => (
                                <li key={`toc-${a.article_number}`}>
                                  <Button
                                    variant="ghost"
                                    className={`w-full justify-start text-left ${
                                      selected.kind === "article" && selected.id === a.article_number
                                        ? "bg-blue-50 text-blue-700"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      onClickArticle(a);
                                      setMobileMenuOpen(false);
                                    }}
                                  >
                                    <span className="truncate text-left w-full">
                                      <span className="font-medium">Art. {a.article_number}</span>
                                      {a.article_title && (
                                        <span className="ml-1 text-gray-500 font-normal opacity-80">
                                          - {a.article_title}
                                        </span>
                                      )}
                                    </span>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </Accordion>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-sm text-gray-500 text-center">No articles available.</div>
              )}
            </div>
          </div>
        </aside>
      </main>
      </div>

      {/* Print View (Hidden unless printing) */}
      {/* Handled via new window now */}
      {/* {printOptions && (
        <div id="print-area" className="hidden print:block">
          <PrintView data={data} options={printOptions} />
        </div>
      )} */}

      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        onPrint={(opts) => setPrintOptions(opts)}
        counts={{
          articles: data.articles?.length || 0,
          recitals: data.recitals?.length || 0,
          annexes: data.annexes?.length || 0,
        }}
      />
    </div>
  );
}

// ---------------- App ----------------

function Layout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Landing />,
      },
      {
        path: "law/:key",
        element: <LawViewer />,
      },
      {
        path: "law/:key/:kind/:id",
        element: <LawViewer />,
      },
      {
        path: "extension",
        element: <LawViewer />,
      },
      {
        path: "extension/:kind/:id",
        element: <LawViewer />,
      },
    ],
  },
], {
  basename: "/eur-lex-visualiser",
});

export default function App() {
  return <RouterProvider router={router} />;
}
