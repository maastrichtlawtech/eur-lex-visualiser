import React from "react";
import { Info } from "lucide-react";

export function RelatedRecitals({ recitals, onSelectRecital }) {
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
        <span className="font-semibold text-xl">Related Recitals</span>
        <span className="bg-blue-100 text-blue-800 text-sm px-2.5 py-0.5 rounded-full font-medium dark:bg-blue-900/40 dark:text-blue-200">
          {recitals.length}
        </span>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 px-6 md:px-12">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These recitals appear to be related to this article based on text analysis using simple AI (known as <a href="https://ebooks.iospress.nl/volumearticle/56169" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">TF-IDF similarity</a>). Sorted by relevance score.
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
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-gray-900 dark:text-gray-100">
                    Recital {r.recital_number}
                  </span>
                  {r.relevanceScore && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreColor(r.relevanceScore)}`}>
                      {formatScore(r.relevanceScore)}% match
                    </span>
                  )}
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 font-medium dark:text-blue-400">
                  Read →
                </span>
              </div>
              {r.keywords && r.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium dark:bg-purple-900/30 dark:text-purple-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="text-sm text-gray-600 line-clamp-3 font-serif dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: r.recital_html }}
              />
            </div>
          ))}
        </div>


      </div>
    </div>
  );
}

