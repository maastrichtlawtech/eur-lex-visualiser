// Basic stop words list for EU law context (English)
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "befolat", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "heatere", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "don", "should", "now",
  "union", "member", "states", "commission", "regulation", "directive", "decision", "article", "paragraph", "eu", "european", "law", "act", "provisions", "measures", "shall", "may", "accordance", "order", "laying", "establishing", "regarding", "whereas"
]);

/**
 * Tokenize text into an array of words, removing punctuation and stop words.
 * @param {string} text 
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // replace punctuation with space
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Compute Term Frequency (TF) for a document.
 * Returns a Map: term -> count
 */
function computeTF(tokens) {
  const tf = new Map();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  return tf;
}

/**
 * Compute Inverse Document Frequency (IDF) for a set of documents.
 * Returns a Map: term -> idf_score
 * idf(t) = log(N / df(t))
 */
function computeIDF(documents) {
  const N = documents.length;
  const df = new Map(); // term -> number of documents containing term

  for (const doc of documents) {
    const uniqueTokens = new Set(doc.tokens);
    for (const t of uniqueTokens) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [term, count] of df) {
    // Using log10. Adding 1 to denominator to be safe (though logic ensures count >= 1)
    idf.set(term, Math.log10(N / count));
  }
  return idf;
}

/**
 * Convert document tokens to a TF-IDF Vector (represented as a Map: term -> score).
 */
function computeTFIDFVector(tokens, idf) {
  const tf = computeTF(tokens);
  const vec = new Map();
  
  // Vector length (magnitude) for cosine normalization
  let magnitude = 0;

  for (const [term, count] of tf) {
    if (idf.has(term)) {
      const score = count * idf.get(term);
      vec.set(term, score);
      magnitude += score * score;
    }
  }
  
  return { vec, magnitude: Math.sqrt(magnitude) };
}

/**
 * Compute Cosine Similarity between two TF-IDF vectors.
 */
function cosineSimilarity(vec1Obj, vec2Obj) {
  if (vec1Obj.magnitude === 0 || vec2Obj.magnitude === 0) return 0;

  let dotProduct = 0;
  
  // Iterate over the smaller vector for efficiency
  const [smaller, larger] = vec1Obj.vec.size < vec2Obj.vec.size 
    ? [vec1Obj.vec, vec2Obj.vec] 
    : [vec2Obj.vec, vec1Obj.vec];

  for (const [term, score1] of smaller) {
    if (larger.has(term)) {
      dotProduct += score1 * larger.get(term);
    }
  }

  return dotProduct / (vec1Obj.magnitude * vec2Obj.magnitude);
}

/**
 * Map recitals to articles based on TF-IDF Cosine Similarity.
 * 
 * @param {Array} recitals - Array of { recital_number, recital_text, ... }
 * @param {Array} articles - Array of { article_number, article_title, article_html, ... }
 * @returns {Map} - Map where key is article_number, value is array of matching recitals
 */
export function mapRecitalsToArticles(recitals, articles) {
  const stripTags = (html) => html ? html.replace(/<[^>]+>/g, " ") : "";

  // 1. Prepare Article Documents (Corpus)
  const articleDocs = articles.map(a => ({
    id: a.article_number,
    tokens: tokenize(a.article_title + " " + stripTags(a.article_html)),
    original: a
  }));

  // 2. Compute IDF on Articles
  const idf = computeIDF(articleDocs);

  // 3. Vectorize Articles
  const articleVectors = articleDocs.map(doc => ({
    id: doc.id,
    ...computeTFIDFVector(doc.tokens, idf)
  }));

  const articleToRecitals = new Map();
  articles.forEach(a => articleToRecitals.set(a.article_number, []));

  // 4. Process Recitals
  recitals.forEach(r => {
    const tokens = tokenize(r.recital_text);
    // Use the same IDF as derived from articles (treating articles as the reference corpus)
    const recitalVec = computeTFIDFVector(tokens, idf);

    let bestScore = 0;
    let bestArticleId = null;

    articleVectors.forEach(aVec => {
      const score = cosineSimilarity(recitalVec, aVec);
      if (score > bestScore) {
        bestScore = score;
        bestArticleId = aVec.id;
      }
    });

    // Similarity threshold (tunable)
    if (bestScore > 0.1 && bestArticleId) {
      const list = articleToRecitals.get(bestArticleId);
      if (list) list.push(r);
    }
  });

  return articleToRecitals;
}
