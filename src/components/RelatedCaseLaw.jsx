import React, { useMemo, useState } from "react";
import { Loader2, Scale, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "../i18n/useI18n.js";
import { useCaseLaw } from "../hooks/law-viewer/useCaseLaw.js";

function formatDate(isoDate) {
  if (!isoDate) return null;
  try {
    return new Date(isoDate).toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return isoDate; }
}

function matchesArticle(c, celex, articleNumber) {
  if (!c?.articleRefs || !articleNumber) return false;
  const target = String(articleNumber);
  return c.articleRefs.some(
    (ref) => ref && ref.actCelex === celex && String(ref.article) === target
  );
}

function CaseCard({ c, currentLang }) {
  const [expanded, setExpanded] = useState(false);
  const eurlexUrl = `https://eur-lex.europa.eu/legal-content/${currentLang || "EN"}/TXT/?uri=CELEX:${c.celex}`;
  const dateLabel = formatDate(c.date);
  const hasDecision = c.declarations && c.declarations.length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-md dark:bg-gray-800 dark:border-gray-700 dark:hover:border-teal-600">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
          CJEU
        </span>
        {dateLabel && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{dateLabel}</span>
        )}
      </div>
      <div className="text-sm">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{c.caseNumber || c.celex}</span>
        {c.name && <span className="text-gray-600 dark:text-gray-300"> — {c.name}</span>}
      </div>
      {hasDecision && (
        <div>
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full text-left"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                {c.declarations.map((d) => `${d.number}. ${d.text}`).join(" ")}
              </p>
              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300">
                <ChevronDown size={10} />
                Expand decision
              </span>
            </button>
          ) : (
            <div>
              <ol className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed list-none">
                {c.declarations.map((d) => (
                  <li key={d.number}>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{d.number}.</span>{" "}
                    {d.text}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
              >
                <ChevronUp size={10} />
                Collapse
              </button>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-700/50">
        {c.ecli && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{c.ecli}</span>
        )}
        <a
          href={eurlexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-100 transition-colors dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50"
        >
          Read full judgment
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

export function RelatedCaseLaw({ celex, articleNumber, currentLang = "EN" }) {
  const { t } = useI18n();
  const { cases, loading, loaded } = useCaseLaw(celex, { autoLoad: true });

  const matching = useMemo(() => {
    if (!cases) return [];
    return cases
      .filter((c) => matchesArticle(c, celex, articleNumber))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [cases, celex, articleNumber]);

  if (!articleNumber) return null;

  if (loading && !loaded) {
    return (
      <div className="mt-8 px-6 md:px-12">
        <div className="flex items-center gap-2 text-teal-900 dark:text-teal-300 mb-4">
          <Scale size={18} />
          <span className="font-semibold text-xl">{t("metadata.caseLaw")}</span>
          <span className="rounded bg-teal-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:bg-teal-800 dark:text-teal-200">beta</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          Loading CJEU judgments…
        </div>
      </div>
    );
  }

  if (!loaded || matching.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-teal-900 mb-4 px-6 md:px-12 dark:text-teal-300">
        <Scale size={18} />
        <span className="font-semibold text-xl">{t("metadata.caseLaw")}</span>
        <span className="bg-teal-100 text-teal-800 text-sm px-2.5 py-0.5 rounded-full font-medium dark:bg-teal-900/40 dark:text-teal-200">
          {matching.length}
        </span>
        <span className="rounded bg-teal-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:bg-teal-800 dark:text-teal-200">beta</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 px-6 md:px-12">
        {matching.map((c) => (
          <CaseCard key={c.celex} c={c} currentLang={currentLang} />
        ))}
      </div>
    </div>
  );
}
