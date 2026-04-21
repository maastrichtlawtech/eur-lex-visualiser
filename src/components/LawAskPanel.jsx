import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Send, BookOpen, ShieldAlert, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askLawQuestionStream } from "../utils/formexApi.js";

const STAGE_LABELS = {
  loading_law: "Loading the law…",
  planning: "Identifying relevant articles…",
  assembling_bundle: "Gathering recitals and case law…",
  answering: "Answering…",
};

const PRESETS = [
  { id: "overview", label: "What does this law cover?", q: "What does this law cover at a high level? Summarise its scope and the main obligations it creates." },
  { id: "rights", label: "What rights does it grant?", q: "What rights does this law grant to individuals, and what are the corresponding obligations on others?" },
  { id: "enforcement", label: "How is it enforced?", q: "How is this law enforced? Who supervises compliance and what remedies or penalties are available?" },
  { id: "exceptions", label: "What are the main exceptions?", q: "What are the main exceptions, derogations, or carve-outs in this law?" },
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

export function LawAskPanel({ celex, lawTitle, lang = "ENG", onArticleClick }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null);
  const [plan, setPlan] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const resetResult = () => {
    setStage(null);
    setPlan(null);
    setBundle(null);
    setAnswer("");
    setMeta(null);
    setError(null);
  };

  const closePanel = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setLoading(false);
    setStage(null);
    setOpen(false);
  };

  useEffect(() => {
    resetResult();
    setQuestion("");
    if (abortRef.current) abortRef.current.abort();
  }, [celex]);

  const disabled = loading || !celex;

  const ask = async (q) => {
    const trimmed = String(q || "").trim();
    if (!trimmed || disabled) return;
    setLoading(true);
    resetResult();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await askLawQuestionStream(celex, trimmed, {
        lang,
        signal: ctrl.signal,
        handlers: {
          onStage: ({ stage }) => setStage(stage),
          onPlan: (p) => setPlan(p),
          onBundle: (b) => setBundle(b),
          onDelta: ({ text }) => setAnswer((prev) => prev + text),
          onDone: (m) => setMeta(m),
          onError: (e) => setError(e.message || e.code || "Request failed"),
        },
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Request failed");
      }
    } finally {
      setLoading(false);
      setStage(null);
    }
  };

  const label = useMemo(() => `Ask about this law`, []);

  if (!celex) return null;

  return (
    <div className="mb-6">
      <div className="px-6 md:px-12">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-900 transition hover:border-purple-300 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-100 dark:hover:border-purple-700 dark:hover:bg-purple-950/70"
          >
            <BookOpen size={16} />
            {label}
            <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800 dark:bg-purple-800 dark:text-purple-200">beta</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:bg-gray-800 dark:border-purple-800">
            <div className="mb-3 flex items-center justify-between gap-3 text-purple-900 dark:text-purple-300">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen size={18} className="shrink-0" />
                <span className="truncate text-lg font-semibold">{label}</span>
                <span className="shrink-0 rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800 dark:bg-purple-800 dark:text-purple-200">beta</span>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close AI help"
                title="Close AI help"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              A planner first selects the most relevant articles, then an answerer grounds its response in those articles, their recitals, definitions, and any CJEU case law citing them. Every claim cites its source in <span className="font-mono">[brackets]</span>.
            </p>

            <div className="mb-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <p>
                Your question and the selected law excerpts are sent to OpenRouter and Google to generate the answer. Do not include confidential or personal information.
              </p>
            </div>

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
                placeholder={`Ask anything about ${lawTitle || "this law"}…`}
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

            {loading && stage && !answer && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                {STAGE_LABELS[stage] || "Working…"}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {(plan || answer || meta) && (
              <div className="space-y-3">
                {plan?.articles?.length > 0 && (
                  <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 dark:border-purple-900 dark:bg-purple-950/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-900 dark:text-purple-300 mb-1.5">
                      <Sparkles size={12} />
                      Articles consulted
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {plan.articles.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => onArticleClick?.(n)}
                          className="rounded bg-white border border-purple-200 px-2 py-0.5 text-xs font-mono text-purple-800 hover:bg-purple-100 dark:bg-gray-900 dark:border-purple-800 dark:text-purple-200 dark:hover:bg-purple-950/40"
                        >
                          Art. {n}
                        </button>
                      ))}
                    </div>
                    {plan.rationale && (
                      <div className="text-xs italic text-gray-600 dark:text-gray-400">
                        {plan.rationale}
                      </div>
                    )}
                  </div>
                )}

                {(answer || loading) && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                    {answer ? renderAnswer(answer) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 size={14} className="animate-spin" />
                        {STAGE_LABELS[stage] || "Working…"}
                      </div>
                    )}
                    {(meta || bundle) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                        {meta?.model && <span>Model: <span className="font-mono">{meta.model}</span></span>}
                        {bundle?.counts && (
                          <span>
                            Bundle: {bundle.counts.articles} articles · {bundle.counts.definitions} defs · {bundle.counts.recitals} recitals · {bundle.counts.caseLaw} cases
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
        )}
      </div>
    </div>
  );
}
