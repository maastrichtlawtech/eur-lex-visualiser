import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "./Button.jsx";
import { searchContent } from "../utils/nlp.js";

function SearchBox({ lists, onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Close when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      // Command/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keyboard navigation within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (q.length >= 2) {
      const res = searchContent(q, lists);
      setResults(res);
    } else {
      setResults([]);
    }
  };

  const handleSelect = (item) => {
    onNavigate(item);
    // setQuery(""); // Keep search term
    // setResults([]); // Keep results
    setIsOpen(false);
  };

  return (
    <>
      {/* Search Input Trigger */}
      <div className="relative md:w-64 transition-all" ref={containerRef}>
        {/* Desktop Input */}
        <div className="relative w-full hidden md:block">
          <input
            ref={inputRef}
            type="text"
            readOnly
            onClick={() => setIsOpen(true)}
            placeholder="Search (Cmd+K)..."
            className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-4 text-sm outline-none hover:bg-white hover:border-blue-300 focus:ring-0 transition-all text-gray-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        </div>

        {/* Mobile Icon Button */}
        <div className="md:hidden">
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* Spotlight Modal Overlay (Rendered in Portal to cover whole screen) */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 transition-all md:p-4 md:pt-[15vh]">
          <div 
            className="w-full max-w-2xl flex flex-col h-full md:h-auto md:max-h-[70vh] bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden fixed inset-0 md:static md:inset-auto md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Auto-focused Input */}
            <div className="flex-none border-b border-gray-100 px-4 py-3 bg-white flex items-center gap-3">
               <button 
                 onClick={() => setIsOpen(false)} 
                 className="md:hidden text-gray-500 hover:text-gray-900 p-1 -ml-1"
               >
                 <ChevronLeft size={24} />
               </button>
               <Search size={20} className="text-gray-400 hidden md:block" />
               <div className="flex-1 relative">
                 <input 
                   autoFocus
                   type="text"
                   value={query}
                   onChange={handleSearch}
                   placeholder="Search..."
                   className="w-full text-lg text-gray-900 placeholder:text-gray-400 outline-none bg-transparent pr-8"
                 />
                 {query && (
                   <button 
                     onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                     className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                     title="Clear search"
                   >
                     <X size={16} />
                   </button>
                 )}
               </div>
               <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
               <button 
                 onClick={() => setIsOpen(false)} 
                 className="hidden md:block text-sm font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
               >
                 Close
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scroll-smooth bg-gray-50/30">
              {results.length > 0 ? (
                <div className="flex flex-col gap-2 p-2 w-full" ref={resultsRef}>
                  {results.map((item, idx) => (
                    <button
                      type="button"
                      key={`${item.type}-${item.id}-${idx}`}
                      onClick={() => handleSelect(item)}
                      className={`group flex flex-col gap-1 p-3 text-left rounded-xl transition-all w-full ${
                        idx === selectedIndex 
                          ? "bg-blue-50 ring-1 ring-blue-200 shadow-sm" 
                          : "hover:bg-blue-50/50 hover:ring-1 hover:ring-blue-200 bg-white md:bg-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 w-full min-w-0">
                        <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          item.type === 'article' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          item.type === 'recital' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          'bg-orange-50 text-orange-700 border-orange-100'
                        }`}>
                          {item.type}
                        </span>
                        <span className="font-semibold text-gray-900 text-base truncate flex-1 min-w-0 group-hover:text-blue-700">
                          {item.title}
                        </span>
                        {item.score > 100 && (
                          <span className="flex-shrink-0 text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full font-medium">Best Match</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 pl-1 leading-relaxed">
                        <span className="opacity-70">...</span>
                        {item.preview}
                        <span className="opacity-70">...</span>
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  {query.length < 2 ? (
                    <>
                      <Search size={48} className="opacity-10 mb-4" />
                      <p className="text-sm">Type to start searching...</p>
                    </>
                  ) : (
                    <>
                      <Search size={48} className="opacity-20 mb-4" />
                      <p className="text-sm">No results found for "{query}"</p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="hidden md:flex flex-none border-t border-gray-100 px-4 py-2 bg-gray-50 text-[10px] text-gray-400 justify-between">
               <span>Select to navigate</span>
               <span>ESC to close</span>
            </div>
          </div>
          
          {/* Click backdrop to close */}
          <div className="absolute inset-0 -z-10" />
        </div>,
        document.body
      )}
    </>
  );
}

export function TopBar({ lawKey, title, lists, selected, onPrevNext, isExtensionMode }) {
  const navigate = useNavigate();
  const { articles, recitals, annexes } = lists;

  const onNavigate = (item) => {
    const extensionParams = isExtensionMode && lawKey === 'extension' 
      ? window.location.search 
      : '';
    
    // Ensure ID is a string before encoding
    const safeId = encodeURIComponent(String(item.id));

    if (isExtensionMode) {
      navigate(`/extension/${item.type}/${safeId}${extensionParams}`);
    } else {
      navigate(`/law/${lawKey}/${item.type}/${safeId}`);
    }
  };

  const getListAndIndex = () => {
    if (selected.kind === "article") {
      const idx = articles.findIndex((a) => a.article_number === selected.id);
      return { kind: "article", index: idx, list: articles, label: "Article" };
    }
    if (selected.kind === "recital") {
      const idx = recitals.findIndex((r) => r.recital_number === selected.id);
      return { kind: "recital", index: idx, list: recitals, label: "Recital" };
    }
    if (selected.kind === "annex") {
      const idx = annexes.findIndex((x) => x.annex_id === selected.id);
      return { kind: "annex", index: idx, list: annexes, label: "Annex" };
    }
    return { kind: null, index: -1, list: [], label: "" };
  };

  const { kind, index, list, label } = getListAndIndex();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
      <div className="relative mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-6">
        {/* Left: Branding */}
        <button
          onClick={() => navigate("/")}
          className="relative z-10 flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003399] text-white shadow-sm">
            <span className="font-serif text-lg font-bold leading-none pb-0.5">§</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            EU Law Visualiser
          </span>
        </button>

        {/* Center: Title */}
        {title && (
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="flex items-center justify-center rounded-full bg-gray-100/80 px-4 py-1.5 backdrop-blur-md">
              <span
                className="max-w-xl truncate text-sm font-medium text-gray-700"
                title={title}
              >
                {title}
              </span>
            </div>
          </div>
        )}

        {/* Right: Navigation Controls */}
        <div className="relative z-10 flex items-center gap-2 md:gap-4">
          <SearchBox lists={lists} onNavigate={onNavigate} />
          
          {kind && (
            <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-1 ring-1 ring-gray-200">
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                disabled={index <= 0}
                onClick={() => onPrevNext(kind, index - 1)}
                title={`Previous ${label}`}
              >
                <ChevronLeft size={18} />
              </Button>

              <span className="hidden md:inline-block min-w-[100px] px-2 text-center text-sm font-medium text-gray-600">
                <span className="text-gray-900">{label} {index + 1}</span>
                <span className="mx-1 text-gray-400">/</span>
                {list.length}
              </span>
              
              <span className="md:hidden text-xs font-medium text-gray-600 px-1">
                {index + 1}/{list.length}
              </span>

              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                disabled={index === -1 || index >= list.length - 1}
                onClick={() => onPrevNext(kind, index + 1)}
                title={`Next ${label}`}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
