import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askArticleQuestion } from "../utils/formexApi.js";

const PRESETS = [
  { id: "requires", label: "What does this article require?", q: "What does this article require? Summarise the obligations and the people they apply to." },
  { id: "cjeu", label: "How has the CJEU interpreted this?", q: "How has the CJEU interpreted this article? List the key holdings with their case citations." },
  { id: "depends", label: "Which other articles does this depend on?", q: "Which other articles or definitions does this article depend on, and how?" },
];

const CITATION_RE = /(\[[^\]\n]+\])/g;

function wrapCitations(children) {
  return React.Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    const parts = child.split(CITATION_RE);
    if (parts.length === 1) return child;
    return parts.map((chunk, i) =>
      CITATION_RE.test(chunk) ? (
        <span
          key={i}
          className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-mono font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >
          {chunk}
        </span>
      ) : (
        <React.Fragment key={i}>{chunk}</React.Fragment>
      )
    );
  });
}

const MD_COMPONENTS = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{wrapCitations(children)}</p>,
  li: ({ children }) => <li className="mb-1">{wrapCitations(children)}</li>,
  td: ({ children }) => <td className="border border-gray-200 dark:border-gray-700 px-2 py-1 align-top">{wrapCitations(children)}</td>,
  th: ({ children }) => <th className="border border-gray-200 dark:border-gray-700 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-left">{children}</th>,
  table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>,
  h1: ({ children }) => <h3 className="mt-3 mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-2 mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{children}</h5>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-0.5">{children}</ol>,
  code: ({ children }) => <code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">{children}</code>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{children}</a>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
};

function renderAnswer(text) {
  if (!text) return null;
  return (
    <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function ArticleAskPanel({ celex, articleNumber, lang = "ENG" }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const abortRef = useRef(null);

  // Reset when switching article
  useEffect(() => {
    setAnswer(null);
    setError(null);
    setQuestion("");
    setMeta(null);
    if (abortRef.current) abortRef.current.abort();
  }, [celex, articleNumber]);

  const disabled = loading || !celex || !articleNumber;

  const ask = async (q) => {
    const trimmed = String(q || "").trim();
    if (!trimmed || disabled) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setMeta(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await askArticleQuestion(celex, articleNumber, trimmed, { lang, signal: ctrl.signal });
      setAnswer(res.answer || "");
      setMeta({ model: res.model, counts: res.bundle?.counts });
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Request failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const label = useMemo(() => `Ask about Art. ${articleNumber}`, [articleNumber]);

  if (!articleNumber) return null;

  return (
    <div className="mt-8">
      <div className="px-6 md:px-12">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-900 transition hover:border-purple-300 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-100 dark:hover:border-purple-700 dark:hover:bg-purple-950/70"
          >
            <Sparkles size={16} />
            {label}
            <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800 dark:bg-purple-800 dark:text-purple-200">beta</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:bg-gray-800 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-3 text-purple-900 dark:text-purple-300">
              <Sparkles size={18} />
              <span className="font-semibold text-lg">{label}</span>
              <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800 dark:bg-purple-800 dark:text-purple-200">beta</span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Grounded in this article, its related recitals, definitions used, and CJEU judgments that cite it. Every claim cites its source in <span className="font-mono">[brackets]</span>.
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setQuestion(p.q); ask(p.q); }}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 transition disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-purple-700 dark:hover:bg-purple-950/40"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); ask(question); }}
              className="flex items-start gap-2 mb-3"
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about this article…"
                rows={2}
                className="flex-1 resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                disabled={disabled}
              />
              <button
                type="submit"
                disabled={disabled || !question.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 dark:bg-purple-700 dark:hover:bg-purple-600"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Ask
              </button>
            </form>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                Assembling article bundle and consulting the model…
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {answer && !loading && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                {renderAnswer(answer)}
                {meta && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                    {meta.model && <span>Model: <span className="font-mono">{meta.model}</span></span>}
                    {meta.counts && (
                      <span>
                        Bundle: {meta.counts.definitions} defs · {meta.counts.recitals} recitals · {meta.counts.caseLaw} cases
                      </span>
                    )}
                    <span className="italic">Verify citations before relying on this answer.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
