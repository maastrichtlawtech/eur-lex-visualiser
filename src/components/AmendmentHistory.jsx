import React from "react";
import { buildEurlexCelexUrl } from "../utils/url.js";
import { Accordion } from "./Accordion.jsx";
import { useI18n } from "../i18n/useI18n.js";

function formatDate(isoDate) {
  if (!isoDate) return null;
  try {
    return new Date(isoDate).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

const TYPE_BADGE = {
  corrigendum: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  amendment:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

/**
 * Sidebar panel showing acts that have amended the currently viewed law,
 * fetched live from the Cellar SPARQL endpoint.
 *
 * Props:
 *  - amendments: array of { celex: string, date: string|null, type: 'amendment'|'corrigendum' }
 *  - loading: boolean
 *  - currentLang: 2-letter language code used for EUR-Lex links
 *  - onOpenAmendment: (celex) => void  — opens the amending act in the reader
 */
export function AmendmentHistory({ amendments, loading, currentLang = "EN", onOpenAmendment }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="pt-4">
        <Accordion title={t("amendmentHistory.title")} defaultOpen={false}>
          <div className="py-2 text-sm text-gray-400 dark:text-gray-500 animate-pulse">
            {t("amendmentHistory.loading")}
          </div>
        </Accordion>
      </div>
    );
  }

  if (!amendments || amendments.length === 0) return null;

  return (
    <div className="pt-4">
      <Accordion
        title={`${t("amendmentHistory.title")} (${amendments.length})`}
        defaultOpen={false}
      >
        <ul className="space-y-1.5">
          {amendments.map((a) => {
            const eurlexUrl = buildEurlexCelexUrl(a.celex, currentLang);
            const dateLabel = formatDate(a.date);
            const badgeCls = TYPE_BADGE[a.type] || TYPE_BADGE.amendment;
            return (
              <li key={a.celex} className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
                      {a.type === "corrigendum" ? t("amendmentHistory.corrigendum") : t("amendmentHistory.amendment")}
                    </span>
                    {dateLabel && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {dateLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenAmendment && onOpenAmendment(a.celex)}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 truncate max-w-[200px]"
                      title={a.celex}
                    >
                      {a.celex}
                    </button>
                    {eurlexUrl && (
                      <a
                        href={eurlexUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline underline-offset-2"
                      >
                        EUR-Lex ↗
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Accordion>
    </div>
  );
}
