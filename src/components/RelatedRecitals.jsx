import React, { useMemo, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";

function useRecitalLookup(allRecitals) {
  return useMemo(() => {
    const map = new Map();
    if (allRecitals) {
      for (const r of allRecitals) {
        map.set(r.recital_number, r);
      }
    }
    return map;
  }, [allRecitals]);
}

export function RelatedRecitals({ recitals, allRecitals, onSelectRecital }) {
  const { t } = useI18n();

  const recitalLookup = useRecitalLookup(allRecitals);

  if (!recitals || recitals.length === 0) return null;

  // Helper to format relevance score as percentage
  const formatScore = (score) => {
    if (!score) return null;
    const percentage = Math.round(score * 100);
    return percentage;
  };

  // Get color class based on score
  const getScoreColor = (score) => {
    if (!score) return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
    if (score >= 0.3) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    if (score >= 0.2) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-blue-900 mb-4 px-6 md:px-12 dark:text-blue-300">
        <span className="font-semibold text-xl">{t("relatedRecitals.title")}</span>
        <span className="bg-blue-100 text-blue-800 text-sm px-2.5 py-0.5 rounded-full font-medium dark:bg-blue-900/40 dark:text-blue-200">
          {recitals.length}
        </span>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 px-6 md:px-12">
          <p
            className="text-sm text-gray-500 dark:text-gray-400 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:hover:underline"
            dangerouslySetInnerHTML={{ __html: t("relatedRecitals.description") }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 px-6 md:px-12">
          {recitals.map((r) => {
            // Look up full recital data for HTML content
            const fullRecital = recitalLookup.get(r.recital_number) || r;
            const recitalHtml = fullRecital.recital_html || "";

            return (
              <div
                key={r.recital_number}
                className="group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md cursor-pointer dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:shadow-blue-900/20"
                onClick={() => onSelectRecital(fullRecital)}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5">
                  <span className="font-serif font-bold text-gray-900 dark:text-gray-100">
                    {t("common.recital")} {r.recital_number}
                  </span>
                  {r.relevanceScore ? (
                    <span className={`justify-self-end text-xs px-2 py-0.5 rounded-full font-medium ${getScoreColor(r.relevanceScore)}`}>
                      {t("relatedRecitals.match", { score: formatScore(r.relevanceScore) })}
                    </span>
                  ) : null}
                  {fullRecital.recital_title ? (
                    <div className="col-span-2 line-clamp-2 text-sm font-semibold leading-5 text-gray-700 dark:text-gray-200">
                      {fullRecital.recital_title}
                    </div>
                  ) : null}
                </div>
                <div
                  className="text-sm text-gray-600 line-clamp-3 font-serif dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: recitalHtml }}
                />
              </div>
            );
          })}
        </div>


      </div>
    </div>
  );
}

export function GeneralRecitals({ recitalNumbers, allRecitals, onSelectRecital }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const recitalLookup = useRecitalLookup(allRecitals);
  const recitals = useMemo(
    () => (recitalNumbers || [])
      .map((recitalNumber) => recitalLookup.get(recitalNumber))
      .filter(Boolean),
    [recitalLookup, recitalNumbers]
  );

  if (recitals.length === 0) return null;

  const handleRecitalKeyDown = (event, recital) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectRecital(recital);
  };

  return (
    <div className="mt-6 px-6 md:px-12">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-y border-gray-200 py-3 text-left transition hover:border-blue-200 dark:border-gray-800 dark:hover:border-blue-900/70"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {t("relatedRecitals.generalTitle")}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {recitals.length}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-sm text-gray-500 transition-transform dark:text-gray-400 ${isOpen ? "rotate-90" : ""}`}
        >
          &gt;
        </span>
      </button>

      {isOpen ? (
        <div className="divide-y divide-gray-100 border-b border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {recitals.map((recital) => (
            <div
              key={recital.recital_number}
              role="button"
              tabIndex={0}
              className="block w-full cursor-pointer py-3 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:hover:bg-gray-900/70 dark:focus:ring-offset-gray-950"
              onClick={() => onSelectRecital(recital)}
              onKeyDown={(event) => handleRecitalKeyDown(event, recital)}
            >
              <span className="block font-serif font-bold text-gray-900 dark:text-gray-100">
                {t("common.recital")} {recital.recital_number}
                {recital.recital_title ? (
                  <span className="font-sans text-sm font-medium text-gray-600 dark:text-gray-300">
                    {" "}— {recital.recital_title}
                  </span>
                ) : null}
              </span>
              <span
                className="mt-1 block line-clamp-2 font-serif text-sm text-gray-600 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: recital.recital_html || "" }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
