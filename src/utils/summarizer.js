// Chrome Summarizer API utility
// https://developer.mozilla.org/en-US/docs/Web/API/Summarizer_API

/**
 * Check if the Summarizer API is available in the browser
 * @returns {Promise<'readily'|'after-download'|'no'>} Availability status
 */
export async function checkSummarizerAvailability() {
  if (!('Summarizer' in self)) {
    return 'no';
  }
  
  try {
    const availability = await Summarizer.availability();
    return availability; // 'readily', 'after-download', or 'no'
  } catch (e) {
    console.warn('Summarizer availability check failed:', e);
    return 'no';
  }
}

/**
 * Create a summarizer instance for generating titles
 * @returns {Promise<{summarizer: Summarizer|null, error: string|null}>}
 */
export async function createTitleSummarizer() {
  const availability = await checkSummarizerAvailability();
  if (availability === 'no') {
    return { summarizer: null, error: 'Summarizer API not available' };
  }
  
  try {
    const summarizer = await Summarizer.create({
      type: 'headline',
      format: 'plain-text',
      length: 'short',
      outputLanguage: 'en',
    });
    return { summarizer, error: null };
  } catch (e) {
    console.error('Failed to create title summarizer:', e);
    const error = getErrorMessage(e);
    return { summarizer: null, error };
  }
}

/**
 * Create a summarizer instance for generating article summaries
 * @returns {Promise<{summarizer: Summarizer|null, error: string|null}>}
 */
export async function createArticleSummarizer() {
  const availability = await checkSummarizerAvailability();
  if (availability === 'no') {
    return { summarizer: null, error: 'Summarizer API not available' };
  }
  
  try {
    const summarizer = await Summarizer.create({
      type: 'tldr',
      format: 'plain-text',
      length: 'short',
      outputLanguage: 'en',
    });
    return { summarizer, error: null };
  } catch (e) {
    console.error('Failed to create article summarizer:', e);
    const error = getErrorMessage(e);
    return { summarizer: null, error };
  }
}

/**
 * Parse error messages from the Summarizer API
 * @param {Error} e 
 * @returns {string}
 */
function getErrorMessage(e) {
  const message = e?.message || String(e);
  
  if (message.includes('not have enough space')) {
    return 'Not enough storage space to download the AI model. Free up some disk space and try again.';
  }
  if (message.includes('not supported')) {
    return 'AI summarization is not supported on this device.';
  }
  if (message.includes('network')) {
    return 'Network error while downloading AI model. Check your connection.';
  }
  
  return 'Failed to initialize AI summarizer.';
}

/**
 * Strip HTML tags from a string to get plain text
 * @param {string} html 
 * @returns {string}
 */
export function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Generate a title for a recital using the Summarizer API
 * @param {Summarizer} summarizer - The summarizer instance
 * @param {string} recitalText - Plain text of the recital
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<string|null>}
 */
export async function generateRecitalTitle(summarizer, recitalText, signal) {
  if (!summarizer || !recitalText) return null;
  
  try {
    // Truncate very long texts to avoid issues
    const text = recitalText.slice(0, 2000);
    const title = await summarizer.summarize(text, { signal });
    return title;
  } catch (e) {
    if (e.name === 'AbortError') {
      return null;
    }
    console.error('Failed to generate recital title:', e);
    return null;
  }
}

/**
 * Generate a short summary for an article using the Summarizer API
 * @param {Summarizer} summarizer - The summarizer instance
 * @param {string} articleText - Plain text of the article
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<string|null>}
 */
export async function generateArticleSummary(summarizer, articleText, signal) {
  if (!summarizer || !articleText) return null;
  
  try {
    // Truncate very long texts to avoid issues
    const text = articleText.slice(0, 4000);
    const summary = await summarizer.summarize(text, { signal });
    return summary;
  } catch (e) {
    if (e.name === 'AbortError') {
      return null;
    }
    console.error('Failed to generate article summary:', e);
    return null;
  }
}

/**
 * Batch generate titles for multiple recitals
 * @param {Array<{recital_number: string, recital_text: string}>} recitals 
 * @param {Function} onProgress - Callback for progress updates (index, total, title)
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Map<string, string>>} Map of recital_number -> title
 */
export async function generateRecitalTitles(recitals, onProgress, signal) {
  const titles = new Map();
  const summarizer = await createTitleSummarizer();
  
  if (!summarizer) {
    console.warn('Summarizer not available for generating recital titles');
    return titles;
  }
  
  try {
    for (let i = 0; i < recitals.length; i++) {
      if (signal?.aborted) break;
      
      const recital = recitals[i];
      const text = recital.recital_text || stripHtml(recital.recital_html || '');
      const title = await generateRecitalTitle(summarizer, text, signal);
      
      if (title) {
        titles.set(recital.recital_number, title);
      }
      
      onProgress?.(i + 1, recitals.length, title);
    }
  } finally {
    summarizer.destroy();
  }
  
  return titles;
}

/**
 * Batch generate summaries for multiple articles
 * @param {Array<{article_number: string, article_html: string}>} articles 
 * @param {Function} onProgress - Callback for progress updates (index, total, summary)
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Map<string, string>>} Map of article_number -> summary
 */
export async function generateArticleSummaries(articles, onProgress, signal) {
  const summaries = new Map();
  const summarizer = await createArticleSummarizer();
  
  if (!summarizer) {
    console.warn('Summarizer not available for generating article summaries');
    return summaries;
  }
  
  try {
    for (let i = 0; i < articles.length; i++) {
      if (signal?.aborted) break;
      
      const article = articles[i];
      const text = stripHtml(article.article_html || '');
      const summary = await generateArticleSummary(summarizer, text, signal);
      
      if (summary) {
        summaries.set(article.article_number, summary);
      }
      
      onProgress?.(i + 1, articles.length, summary);
    }
  } finally {
    summarizer.destroy();
  }
  
  return summaries;
}

/**
 * Hook-friendly wrapper to manage summarizer state
 */
export class SummarizerManager {
  constructor() {
    this.titleSummarizer = null;
    this.articleSummarizer = null;
    this.available = null;
  }
  
  async checkAvailability() {
    if (this.available === null) {
      this.available = await checkSummarizerAvailability();
    }
    return this.available;
  }
  
  async getTitleSummarizer() {
    if (!this.titleSummarizer) {
      this.titleSummarizer = await createTitleSummarizer();
    }
    return this.titleSummarizer;
  }
  
  async getArticleSummarizer() {
    if (!this.articleSummarizer) {
      this.articleSummarizer = await createArticleSummarizer();
    }
    return this.articleSummarizer;
  }
  
  destroy() {
    if (this.titleSummarizer) {
      this.titleSummarizer.destroy();
      this.titleSummarizer = null;
    }
    if (this.articleSummarizer) {
      this.articleSummarizer.destroy();
      this.articleSummarizer = null;
    }
  }
}


