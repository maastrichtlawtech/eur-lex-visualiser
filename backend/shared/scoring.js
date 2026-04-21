function dotProduct(vecA, vecB) {
  const length = Math.min(vecA.length, vecB.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += vecA[index] * vecB[index];
  }
  return sum;
}

function normalizePosition(index, count) {
  if (count <= 1) return 0;
  return index / (count - 1);
}

function computeRecitalMap({
  recitalVecs = [],
  articleVecs = [],
  recitalIds = [],
  articleIds = [],
  options = {},
}) {
  const threshold = options.threshold ?? 0.6;
  const alpha = options.alpha ?? 0.03;
  const maxPerRecital = options.maxPerRecital ?? 4;
  const maxScoreGapFromBest = options.maxScoreGapFromBest ?? 0.02;
  const scoringVersion = options.scoringVersion ?? 1;

  const recitalCount = Math.min(recitalVecs.length, recitalIds.length);
  const articleCount = Math.min(articleVecs.length, articleIds.length);
  const byArticle = {};
  for (let index = 0; index < articleCount; index += 1) {
    byArticle[articleIds[index]] = [];
  }

  if (recitalCount === 0 || articleCount === 0) {
    return {
      byArticle,
      orphans: [],
      stats: {
        scoringVersion,
        threshold,
        alpha,
        maxPerRecital,
        maxScoreGapFromBest,
        recitalCount,
        articleCount,
        matchedRecitals: 0,
        orphanCount: recitalCount,
        multiAttachedRecitals: 0,
        maxScore: null,
      },
    };
  }

  const orphans = [];
  let matchedRecitals = 0;
  let multiAttachedRecitals = 0;
  let maxScore = -Infinity;

  for (let recitalIndex = 0; recitalIndex < recitalCount; recitalIndex += 1) {
    const scores = [];
    const recitalPos = normalizePosition(recitalIndex, recitalCount);

    for (let articleIndex = 0; articleIndex < articleCount; articleIndex += 1) {
      const cosine = dotProduct(recitalVecs[recitalIndex], articleVecs[articleIndex]);
      const articlePos = normalizePosition(articleIndex, articleCount);
      const score = cosine + alpha * (1 - Math.abs(recitalPos - articlePos));
      scores.push({ articleId: articleIds[articleIndex], score });
    }

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0] || { score: 0 };
    if (best.score > maxScore) {
      maxScore = best.score;
    }

    const qualifying = scores
      .filter((entry) => entry.score >= threshold && best.score - entry.score <= maxScoreGapFromBest)
      .slice(0, maxPerRecital);
    if (qualifying.length === 0) {
      orphans.push({
        recital_number: recitalIds[recitalIndex],
        relevanceScore: best.score,
      });
      continue;
    }

    matchedRecitals += 1;
    if (qualifying.length > 1) {
      multiAttachedRecitals += 1;
    }

    for (const entry of qualifying) {
      byArticle[entry.articleId].push({
        recital_number: recitalIds[recitalIndex],
        relevanceScore: entry.score,
      });
    }
  }

  for (const articleId of Object.keys(byArticle)) {
    byArticle[articleId].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  orphans.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    byArticle,
    orphans,
    stats: {
      scoringVersion,
      threshold,
      alpha,
      maxPerRecital,
      maxScoreGapFromBest,
      recitalCount,
      articleCount,
      matchedRecitals,
      orphanCount: orphans.length,
      multiAttachedRecitals,
      maxScore: Number.isFinite(maxScore) ? maxScore : null,
    },
  };
}

module.exports = { computeRecitalMap };
