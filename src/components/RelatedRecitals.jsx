import React from "react";
import { Info } from "lucide-react";

export function RelatedRecitals({ recitals, onSelectRecital }) {
  if (!recitals || recitals.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-blue-900 mb-4 px-6 md:px-12 dark:text-blue-300">
        <span className="font-semibold text-xl">Related Recitals</span>
        <span className="bg-blue-100 text-blue-800 text-sm px-2.5 py-0.5 rounded-full font-medium dark:bg-blue-900/40 dark:text-blue-200">
          {recitals.length}
        </span>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 px-6 md:px-12">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These recitals appear to be related to this article based text analysis using simple AI (known as <a href="https://ebooks.iospress.nl/volumearticle/56169" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">TF-IDF similarity</a>). This approach does not have the quality of manually curated legal databases but exist for any EU law loaded in this visualiser.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 px-6 md:px-12">
          {recitals.map((r) => (
            <div
              key={r.recital_number}
              className="group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md cursor-pointer dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:shadow-blue-900/20"
              onClick={() => onSelectRecital(r)}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-gray-900 dark:text-gray-100">
                  Recital {r.recital_number}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 font-medium dark:text-blue-400">
                  Read →
                </span>
              </div>
              <div
                className="text-sm text-gray-600 line-clamp-3 font-serif dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: r.recital_html }}
              />
            </div>
          ))}
        </div>

        <div className="px-6 md:px-12">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2 items-start dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-200">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="inline">
              <strong>Pro Tip:</strong> Use the <strong>Print / PDF</strong> button in the top bar to generate a document with these related recitals included next to their articles.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

