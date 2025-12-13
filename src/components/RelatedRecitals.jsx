import React, { useEffect, useState } from "react";
import { Info, Sparkles, Loader2 } from "lucide-react";

export function RelatedRecitals({ 
  recitals, 
  onSelectRecital,
  recitalTitles = new Map(),
  onGenerateTitle,
  isAiAvailable = false,
}) {
  if (!recitals || recitals.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-blue-900 mb-4 px-6 md:px-12">
        <span className="font-semibold text-xl">Related Recitals</span>
        <span className="bg-blue-100 text-blue-800 text-sm px-2.5 py-0.5 rounded-full font-medium">
          {recitals.length}
        </span>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 px-6 md:px-12">
          <p className="text-sm text-gray-500">
            These recitals appear to be related to this article based text analysis using simple AI (known as <a href="https://ebooks.iospress.nl/volumearticle/56169" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">TF-IDF similarity</a>). This approach does not have the quality of manually curated legal databases but exist for any EU law loaded in this visualiser.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 px-6 md:px-12">
          {recitals.map((r) => (
            <RecitalCard
              key={r.recital_number}
              recital={r}
              title={recitalTitles.get(r.recital_number)}
              onSelect={() => onSelectRecital(r)}
              onGenerateTitle={onGenerateTitle}
              isAiAvailable={isAiAvailable}
            />
          ))}
        </div>

        <div className="px-6 md:px-12">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2 items-start">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="hidden md:inline">
              <strong>Pro Tip:</strong> Use the <strong>Print / PDF</strong> button in the top bar to generate a document with these related recitals included next to their articles.
            </span>
            <span className="md:hidden">
              <strong>Pro Tip:</strong> Switch to a desktop computer to generate a PDF with these related recitals included next to their articles.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecitalCard({ recital, title, onSelect, onGenerateTitle, isAiAvailable }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  // Sync with prop
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const handleGenerateTitle = async (e) => {
    e.stopPropagation();
    if (!onGenerateTitle || isGenerating || localTitle) return;
    
    setIsGenerating(true);
    try {
      const generated = await onGenerateTitle(recital);
      if (generated) {
        setLocalTitle(generated);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-serif font-bold text-gray-900">
          Recital {recital.recital_number}
        </span>
        <div className="flex items-center gap-2">
          {isAiAvailable && !localTitle && !isGenerating && (
            <button
              onClick={handleGenerateTitle}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50"
              title="Generate AI title"
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline">Title</span>
            </button>
          )}
          {isGenerating && (
            <Loader2 size={14} className="animate-spin text-purple-500" />
          )}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 font-medium">
            Read →
          </span>
        </div>
      </div>
      
      {localTitle && (
        <div className="flex items-start gap-1.5 text-sm text-purple-700 bg-purple-50 px-2 py-1.5 rounded -mt-1">
          <Sparkles size={12} className="mt-0.5 flex-shrink-0" />
          <span className="font-medium">{localTitle}</span>
        </div>
      )}
      
      <div 
        className="text-sm text-gray-600 line-clamp-3 font-serif"
        dangerouslySetInnerHTML={{ __html: recital.recital_html }}
      />
    </div>
  );
}
