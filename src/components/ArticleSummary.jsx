import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, AlertCircle, X } from "lucide-react";

export function ArticleSummary({ 
  article, 
  summary, 
  onGenerateSummary, 
  isAiAvailable = false,
  error = null,
  onClearError,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localSummary, setLocalSummary] = useState(summary);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync with prop
  useEffect(() => {
    setLocalSummary(summary);
  }, [summary]);

  const handleGenerate = async () => {
    if (!onGenerateSummary || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const generated = await onGenerateSummary(article);
      if (generated) {
        setLocalSummary(generated);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Don't show anything if AI is not available and there's no summary and no error
  if (!isAiAvailable && !localSummary && !error) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-purple-800">
          <Sparkles size={16} />
          <span className="font-semibold text-sm">AI Summary</span>
          <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
            Chrome Built-in AI
          </span>
        </div>
        {localSummary && (
          isExpanded ? <ChevronUp size={16} className="text-purple-600" /> : <ChevronDown size={16} className="text-purple-600" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          {error ? (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              {onClearError && (
                <button onClick={onClearError} className="p-0.5 hover:bg-red-100 rounded">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : localSummary ? (
            <p className="text-sm text-purple-900 leading-relaxed">
              {localSummary}
            </p>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate Summary
                  </>
                )}
              </button>
              <span className="text-xs text-purple-600">
                Uses your browser's built-in AI to create a short summary
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


