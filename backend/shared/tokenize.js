let getStopWordsPromise = null;

async function loadGetStopWords() {
  if (!getStopWordsPromise) {
    getStopWordsPromise = import('./formex-parser/languages.mjs').then((mod) => mod.getStopWords);
  }

  return getStopWordsPromise;
}

async function tokenize(text, langCode) {
  if (!text) return [];

  const getStopWords = await loadGetStopWords();
  const stopWords = langCode ? getStopWords(langCode) : getStopWords('EN');

  return String(text)
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

module.exports = { tokenize };
