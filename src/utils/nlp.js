// Basic stop words list for EU law context (English)
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "don", "should", "now",
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
 * Helper to strip HTML tags and normalize whitespace
 */
const stripTags = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Map recitals to articles based on TF-IDF Cosine Similarity.
 * 
 * @param {Array} recitals - Array of { recital_number, recital_text, ... }
 * @param {Array} articles - Array of { article_number, article_title, article_html, ... }
 * @param {boolean} exclusive - If true, assigns each recital ONLY to the best matching article
 * @returns {Map} - Map where key is article_number, value is array of matching recitals
 */
export function mapRecitalsToArticles(recitals, articles, exclusive = false) {
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
      
      if (exclusive) {
        // Keep track of the absolute best match
        if (score > bestScore) {
          bestScore = score;
          bestArticleId = aVec.id;
        }
      } else {
        // Multi-assignment logic (existing)
        if (score > bestScore) {
           bestScore = score;
           bestArticleId = aVec.id;
        }
      }
    });

    // Similarity threshold (tunable)
    if (exclusive) {
       // For exclusive mode, assign only to the single best article if above threshold
       if (bestScore > 0.1 && bestArticleId) {
         const list = articleToRecitals.get(bestArticleId);
         if (list) list.push(r);
       }
    } else {
       // For existing non-exclusive mode (visualiser sidebar), we stick to the original "best match" logic
       // Currently the logic above effectively finds ONE best match anyway for the sidebar too, 
       // but we could expand this to top-N in future. 
       // For now, let's keep it consistent: assigns to best match > threshold.
       if (bestScore > 0.1 && bestArticleId) {
          const list = articleToRecitals.get(bestArticleId);
          if (list) list.push(r);
       }
    }
  });

  return articleToRecitals;
}

/**
 * Simple search function using TF-IDF and cosine similarity.
 * 
 * For better relevance, this treats the query as a "document" and compares it 
 * against all content (articles, recitals, annexes) using the same TF-IDF model.
 */
export function searchContent(query, data) {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  const qTokens = tokenize(q);
  
  // If query is too short/stopwords only, fallback to simple matching
  if (qTokens.length === 0) {
    // Very basic substring match fallback
    return simpleSearch(query, data);
  }

  // 1. Prepare Corpus (All searchable items)
  const docs = [];
  
  data.articles.forEach(a => {
    const text = stripTags(a.article_html);
    docs.push({
      type: 'article',
      id: a.article_number,
      title: a.article_title ? `Art. ${a.article_number} - ${a.article_title}` : `Article ${a.article_number}`,
      text: text,
      tokens: tokenize(text + " " + (a.article_title || "") + " Article " + a.article_number),
      preview: text.substring(0, 150) + "..."
    });
  });

  data.recitals.forEach(r => {
    const text = stripTags(r.recital_html);
    docs.push({
      type: 'recital',
      id: r.recital_number,
      title: `Recital ${r.recital_number}`,
      text: text,
      tokens: tokenize(text + " Recital " + r.recital_number),
      preview: text.substring(0, 150) + "..."
    });
  });

  data.annexes.forEach(a => {
    const text = stripTags(a.annex_html);
    docs.push({
      type: 'annex',
      id: a.annex_id,
      title: `Annex ${a.annex_id} - ${a.annex_title}`,
      text: text,
      tokens: tokenize(text + " " + (a.annex_title || "") + " Annex " + a.annex_id),
      preview: text.substring(0, 150) + "..."
    });
  });

  // 2. Compute IDF for the entire corpus
  const idf = computeIDF(docs);

  // 3. Vectorize Query
  const queryVec = computeTFIDFVector(qTokens, idf);

  // 4. Compute Similarity & Score
  const results = docs.map(doc => {
    const docVec = computeTFIDFVector(doc.tokens, idf);
    let score = cosineSimilarity(queryVec, docVec) * 100; // Base score

    // Boost exact matches significantly
    const titleLower = doc.title.toLowerCase();
    const idStr = String(doc.id).toLowerCase();
    
    // Exact ID match (e.g. query "5" matches Article 5)
    if (q === idStr) score += 200;
    
    // "Article X" type match
    if (doc.type === 'article' && q.replace(/\s/g, '') === `article${idStr}`) score += 200;
    if (doc.type === 'recital' && q.replace(/\s/g, '') === `recital${idStr}`) score += 200;

    // Title substring match
    if (titleLower.includes(q)) score += 50;

    return {
      ...doc,
      score
    };
  });

  // Filter and sort
  return results
    .filter(r => r.score > 0.5) // Threshold to remove noise
    .sort((a, b) => b.score - a.score);
}

/**
 * Fallback simple search if tokenization yields nothing useful (e.g. stopwords only)
 */
function simpleSearch(query, data) {
  const q = query.toLowerCase();
  const results = [];
  
  const addItem = (type, id, title, text) => {
    if (text.toLowerCase().includes(q) || title.toLowerCase().includes(q)) {
      results.push({
        type,
        id,
        title,
        preview: text.substring(0, 150) + "...",
        score: 1 // low score
      });
    }
  };

  data.articles.forEach(a => addItem('article', a.article_number, a.article_title ? `Art. ${a.article_number} - ${a.article_title}` : `Article ${a.article_number}`, stripTags(a.article_html)));
  data.recitals.forEach(r => addItem('recital', r.recital_number, `Recital ${r.recital_number}`, stripTags(r.recital_html)));
  data.annexes.forEach(a => addItem('annex', a.annex_id, `Annex ${a.annex_id}`, stripTags(a.annex_html)));

  return results;
}
