const { computeRecitalMap } = require('./scoring');
const { tokenize } = require('./tokenize');

const RECITAL_MAP_SERVICE_VERSION = 3;
const MAX_TEXT_CHARS = 6000;

function stripTags(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) return [];
  let sumSq = 0;
  for (const value of vector) {
    sumSq += value * value;
  }
  if (sumSq === 0) {
    return vector.map(() => 0);
  }
  const magnitude = Math.sqrt(sumSq);
  return vector.map((value) => value / magnitude);
}

async function buildKeywords(text, langCode) {
  const tokens = await tokenize(text, langCode);
  if (tokens.length === 0) return [];

  const counts = new Map();
  const firstIndex = new Map();
  tokens.forEach((token, index) => {
    counts.set(token, (counts.get(token) || 0) + 1);
    if (!firstIndex.has(token)) {
      firstIndex.set(token, index);
    }
  });

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (firstIndex.get(a[0]) || 0) - (firstIndex.get(b[0]) || 0);
    })
    .slice(0, 3)
    .map(([token]) => token);
}

function createRecitalMapService({
  embeddingCache,
  embedBatch,
  model,
  scoring = computeRecitalMap,
  threshold = 0.6,
  alpha = 0.03,
  maxPerRecital = 4,
  maxScoreGapFromBest = 0.02,
  baseUrl,
  apiKey,
}) {
  const inFlight = new Map();

  async function getRecitalMap(celex, lang, { recitals = [], articles = [], title = null, langCode = null } = {}) {
    const cacheKey = `${celex}|${lang}`;
    const cached = await embeddingCache.get(celex, lang);
    if (cached && cached.meta?.serviceVersion === RECITAL_MAP_SERVICE_VERSION) {
      return cached;
    }
    if (cached) {
      await embeddingCache.remove(celex, lang);
    }

    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }

    const job = (async () => {
      const recitalList = Array.isArray(recitals) ? recitals : [];
      const articleList = Array.isArray(articles) ? articles : [];

      if (recitalList.length === 0 || articleList.length === 0) {
        const empty = {
          celex,
          lang,
          langCode,
          model,
          scoringVersion: 1,
          threshold,
          alpha,
          maxScoreGapFromBest,
          createdAt: new Date().toISOString(),
          byArticle: Object.fromEntries(articleList.map((article) => [article.article_number, []])),
          orphans: [],
          meta: {
            serviceVersion: RECITAL_MAP_SERVICE_VERSION,
            articleCount: articleList.length,
            recitalCount: recitalList.length,
            scoringVersion: 1,
            threshold,
            alpha,
            maxScoreGapFromBest,
            model,
          },
        };
        if (articleList.length > 0 || recitalList.length > 0) {
          await embeddingCache.put(celex, lang, empty);
        }
        return empty;
      }

      const recitalInputs = [];
      const articleInputs = [];
      const recitalMetaById = new Map();
      const articleIds = [];
      const recitalIds = [];

      for (const recital of recitalList) {
        const recitalId = String(recital.recital_number || '').trim();
        const recitalText = stripTags(recital.recital_html || recital.recital_text || '');
        const combinedText = `Recital ${recitalId}${recitalText ? `\n\n${recitalText}` : ''}`.slice(0, MAX_TEXT_CHARS);
        const keywords = await buildKeywords(recitalText || combinedText, langCode || recital.langCode || 'EN');
        recitalMetaById.set(recitalId, {
          keywords,
        });
        recitalIds.push(recitalId);
        recitalInputs.push(combinedText);
      }

      for (const article of articleList) {
        const articleId = String(article.article_number || '').trim();
        const articleTitle = String(article.article_title || '').trim();
        const articleText = stripTags(article.article_html || article.article_text || '');
        const combinedText = `${title ? `${title}\n\n` : ''}${articleTitle ? `${articleTitle}\n\n` : ''}${articleText}`
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_TEXT_CHARS);
        articleIds.push(articleId);
        articleInputs.push(combinedText);
      }

      const texts = [...recitalInputs, ...articleInputs];
      const startedAt = Date.now();
      const embeddingResult = await embedBatch(texts, { model, apiKey, baseUrl });
      const embeddings = Array.isArray(embeddingResult?.embeddings) ? embeddingResult.embeddings : [];

      if (embeddings.length < texts.length) {
        throw new Error(`Embedding provider returned ${embeddings.length} vectors for ${texts.length} texts`);
      }

      const recitalVecs = embeddings.slice(0, recitalInputs.length).map(normalizeVector);
      const articleVecs = embeddings.slice(recitalInputs.length).map(normalizeVector);

      const computed = scoring({
        recitalVecs,
        articleVecs,
        recitalIds,
        articleIds,
        options: {
          threshold,
          alpha,
          maxPerRecital,
          maxScoreGapFromBest,
          scoringVersion: 1,
        },
      });

      const enrich = (entries) => entries.map((entry) => ({
        recital_number: entry.recital_number,
        relevanceScore: entry.relevanceScore,
        keywords: recitalMetaById.get(String(entry.recital_number || ''))?.keywords || [],
      }));

      const payload = {
        celex,
        lang,
        langCode,
        model,
        scoringVersion: 1,
        threshold,
        alpha,
        maxScoreGapFromBest,
        createdAt: new Date().toISOString(),
        byArticle: Object.fromEntries(
          Object.entries(computed.byArticle).map(([articleId, entries]) => [articleId, enrich(entries)])
        ),
        orphans: enrich(computed.orphans),
        meta: {
          serviceVersion: RECITAL_MAP_SERVICE_VERSION,
          articleCount: articleList.length,
          recitalCount: recitalList.length,
          scoringVersion: 1,
          threshold,
          alpha,
          maxScoreGapFromBest,
          model,
          tokens: embeddingResult?.usage?.total_tokens || null,
          elapsedMs: Date.now() - startedAt,
          stats: computed.stats,
        },
      };

      console.log(
        `[RecitalMap] ${celex}_${lang} R=${recitalList.length} A=${articleList.length} tokens=${payload.meta.tokens || 0} ms=${payload.meta.elapsedMs}`
      );

      await embeddingCache.put(celex, lang, payload);
      return payload;
    })()
      .finally(() => {
        inFlight.delete(cacheKey);
      });

    inFlight.set(cacheKey, job);
    return job;
  }

  return { getRecitalMap };
}

module.exports = {
  RECITAL_MAP_SERVICE_VERSION,
  createRecitalMapService,
};
