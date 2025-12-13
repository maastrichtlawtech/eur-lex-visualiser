import { useState, useEffect, useRef, useCallback } from 'react';
import {
  checkSummarizerAvailability,
  createTitleSummarizer,
  createArticleSummarizer,
  generateRecitalTitle,
  generateArticleSummary,
  stripHtml,
} from '../utils/summarizer.js';

/**
 * React hook to manage AI summarization for law content
 * @param {Object} data - Law data with articles and recitals
 * @param {string} cacheKey - Unique key for caching results
 * @returns {Object} Summarization state and controls
 */
export function useSummarizer(data, cacheKey) {
  const [availability, setAvailability] = useState(null); // 'readily' | 'after-download' | 'no' | null (checking)
  const [recitalTitles, setRecitalTitles] = useState(new Map());
  const [articleSummaries, setArticleSummaries] = useState(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, type: null });
  const [error, setError] = useState(null); // User-friendly error message
  
  const abortControllerRef = useRef(null);
  const titleSummarizerRef = useRef(null);
  const articleSummarizerRef = useRef(null);

  // Check availability on mount
  useEffect(() => {
    checkSummarizerAvailability().then(setAvailability);
  }, []);

  // Load cached results when cacheKey changes
  useEffect(() => {
    if (!cacheKey) return;
    
    try {
      const cachedTitles = localStorage.getItem(`ai_recital_titles_${cacheKey}`);
      if (cachedTitles) {
        setRecitalTitles(new Map(JSON.parse(cachedTitles)));
      }
      
      const cachedSummaries = localStorage.getItem(`ai_article_summaries_${cacheKey}`);
      if (cachedSummaries) {
        setArticleSummaries(new Map(JSON.parse(cachedSummaries)));
      }
    } catch (e) {
      console.warn('Failed to load cached AI summaries:', e);
    }
  }, [cacheKey]);

  // Cleanup summarizers on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      titleSummarizerRef.current?.destroy();
      articleSummarizerRef.current?.destroy();
    };
  }, []);

  /**
   * Generate a title for a single recital (on-demand)
   */
  const generateSingleRecitalTitle = useCallback(async (recital) => {
    if (availability === 'no' || !recital) return null;
    
    // Check cache first
    if (recitalTitles.has(recital.recital_number)) {
      return recitalTitles.get(recital.recital_number);
    }
    
    try {
      if (!titleSummarizerRef.current) {
        const { summarizer, error: initError } = await createTitleSummarizer();
        if (initError) {
          setError(initError);
          return null;
        }
        titleSummarizerRef.current = summarizer;
      }
      
      if (!titleSummarizerRef.current) return null;
      
      const text = recital.recital_text || stripHtml(recital.recital_html || '');
      const title = await generateRecitalTitle(titleSummarizerRef.current, text);
      
      if (title) {
        setRecitalTitles(prev => {
          const next = new Map(prev);
          next.set(recital.recital_number, title);
          
          // Cache to localStorage
          if (cacheKey) {
            try {
              localStorage.setItem(`ai_recital_titles_${cacheKey}`, JSON.stringify(Array.from(next.entries())));
            } catch (e) { /* ignore storage errors */ }
          }
          
          return next;
        });
      }
      
      return title;
    } catch (e) {
      console.error('Failed to generate recital title:', e);
      return null;
    }
  }, [availability, recitalTitles, cacheKey]);

  /**
   * Generate a summary for a single article (on-demand)
   */
  const generateSingleArticleSummary = useCallback(async (article) => {
    if (availability === 'no' || !article) return null;
    
    // Check cache first
    if (articleSummaries.has(article.article_number)) {
      return articleSummaries.get(article.article_number);
    }
    
    try {
      if (!articleSummarizerRef.current) {
        const { summarizer, error: initError } = await createArticleSummarizer();
        if (initError) {
          setError(initError);
          return null;
        }
        articleSummarizerRef.current = summarizer;
      }
      
      if (!articleSummarizerRef.current) return null;
      
      const text = stripHtml(article.article_html || '');
      const summary = await generateArticleSummary(articleSummarizerRef.current, text);
      
      if (summary) {
        setArticleSummaries(prev => {
          const next = new Map(prev);
          next.set(article.article_number, summary);
          
          // Cache to localStorage
          if (cacheKey) {
            try {
              localStorage.setItem(`ai_article_summaries_${cacheKey}`, JSON.stringify(Array.from(next.entries())));
            } catch (e) { /* ignore storage errors */ }
          }
          
          return next;
        });
      }
      
      return summary;
    } catch (e) {
      console.error('Failed to generate article summary:', e);
      return null;
    }
  }, [availability, articleSummaries, cacheKey]);

  /**
   * Generate titles for all recitals in the current law
   */
  const generateAllRecitalTitles = useCallback(async () => {
    if (availability === 'no' || !data?.recitals?.length) return;
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: data.recitals.length, type: 'recitals' });
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      if (!titleSummarizerRef.current) {
        const { summarizer, error: initError } = await createTitleSummarizer();
        if (initError) {
          setError(initError);
          setIsGenerating(false);
          return;
        }
        titleSummarizerRef.current = summarizer;
      }
      
      const summarizer = titleSummarizerRef.current;
      if (!summarizer) {
        setIsGenerating(false);
        return;
      }
      
      const newTitles = new Map(recitalTitles);
      
      for (let i = 0; i < data.recitals.length; i++) {
        if (signal.aborted) break;
        
        const recital = data.recitals[i];
        
        // Skip if already generated
        if (newTitles.has(recital.recital_number)) {
          setProgress({ current: i + 1, total: data.recitals.length, type: 'recitals' });
          continue;
        }
        
        const text = recital.recital_text || stripHtml(recital.recital_html || '');
        const title = await generateRecitalTitle(summarizer, text, signal);
        
        if (title) {
          newTitles.set(recital.recital_number, title);
          setRecitalTitles(new Map(newTitles));
        }
        
        setProgress({ current: i + 1, total: data.recitals.length, type: 'recitals' });
      }
      
      // Cache final results
      if (cacheKey) {
        try {
          localStorage.setItem(`ai_recital_titles_${cacheKey}`, JSON.stringify(Array.from(newTitles.entries())));
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Failed to generate all recital titles:', e);
      }
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, type: null });
    }
  }, [availability, data?.recitals, isGenerating, recitalTitles, cacheKey]);

  /**
   * Generate summaries for all articles in the current law
   */
  const generateAllArticleSummaries = useCallback(async () => {
    if (availability === 'no' || !data?.articles?.length) return;
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: data.articles.length, type: 'articles' });
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      if (!articleSummarizerRef.current) {
        const { summarizer, error: initError } = await createArticleSummarizer();
        if (initError) {
          setError(initError);
          setIsGenerating(false);
          return;
        }
        articleSummarizerRef.current = summarizer;
      }
      
      const summarizer = articleSummarizerRef.current;
      if (!summarizer) {
        setIsGenerating(false);
        return;
      }
      
      const newSummaries = new Map(articleSummaries);
      
      for (let i = 0; i < data.articles.length; i++) {
        if (signal.aborted) break;
        
        const article = data.articles[i];
        
        // Skip if already generated
        if (newSummaries.has(article.article_number)) {
          setProgress({ current: i + 1, total: data.articles.length, type: 'articles' });
          continue;
        }
        
        const text = stripHtml(article.article_html || '');
        const summary = await generateArticleSummary(summarizer, text, signal);
        
        if (summary) {
          newSummaries.set(article.article_number, summary);
          setArticleSummaries(new Map(newSummaries));
        }
        
        setProgress({ current: i + 1, total: data.articles.length, type: 'articles' });
      }
      
      // Cache final results
      if (cacheKey) {
        try {
          localStorage.setItem(`ai_article_summaries_${cacheKey}`, JSON.stringify(Array.from(newSummaries.entries())));
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Failed to generate all article summaries:', e);
      }
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, type: null });
    }
  }, [availability, data?.articles, isGenerating, articleSummaries, cacheKey]);

  /**
   * Stop any ongoing generation
   */
  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  /**
   * Clear all cached AI content
   */
  const clearCache = useCallback(() => {
    setRecitalTitles(new Map());
    setArticleSummaries(new Map());
    
    if (cacheKey) {
      try {
        localStorage.removeItem(`ai_recital_titles_${cacheKey}`);
        localStorage.removeItem(`ai_article_summaries_${cacheKey}`);
      } catch (e) { /* ignore */ }
    }
  }, [cacheKey]);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    availability,
    isAvailable: availability === 'readily' || availability === 'after-download',
    recitalTitles,
    articleSummaries,
    isGenerating,
    progress,
    error,
    
    // Actions
    generateSingleRecitalTitle,
    generateSingleArticleSummary,
    generateAllRecitalTitles,
    generateAllArticleSummaries,
    cancelGeneration,
    clearCache,
    clearError,
  };
}


