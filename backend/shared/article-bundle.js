const MAX_RECITALS_PER_ARTICLE = 6;

function stripTags(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickSkeleton(articles, focusNumber) {
  const byChapter = new Map();
  for (const a of articles || []) {
    const chapter = a.division?.chapter || null;
    const section = a.division?.section || null;
    const chapterKey = chapter?.number || '__none__';
    if (!byChapter.has(chapterKey)) {
      byChapter.set(chapterKey, {
        chapterNo: chapter?.number || null,
        chapterTitle: chapter?.title || null,
        sections: new Map(),
      });
    }
    const entry = byChapter.get(chapterKey);
    const sectionKey = section?.number || '__none__';
    if (!entry.sections.has(sectionKey)) {
      entry.sections.set(sectionKey, {
        sectionNo: section?.number || null,
        sectionTitle: section?.title || null,
        articles: [],
      });
    }
    entry.sections.get(sectionKey).articles.push({
      number: a.article_number,
      title: a.article_title || null,
      isFocus: String(a.article_number) === String(focusNumber),
    });
  }
  return Array.from(byChapter.values()).map((c) => ({
    chapterNo: c.chapterNo,
    chapterTitle: c.chapterTitle,
    sections: Array.from(c.sections.values()),
  }));
}

function definitionsUsedIn(articleText, definitions) {
  if (!articleText || !definitions?.length) return [];
  const lower = articleText.toLowerCase();
  return definitions
    .filter((d) => d.term && lower.includes(d.term.toLowerCase()))
    .map((d) => ({
      term: d.term,
      text: d.definition || d.text || '',
      sourceArticle: d.sourceArticle || d.source_article || null,
    }));
}

function recitalsFromMap(recitalMap, focusNumber, allRecitals) {
  const lookup = new Map();
  for (const r of allRecitals || []) {
    lookup.set(String(r.recital_number), r);
  }
  const entries = recitalMap?.byArticle?.[String(focusNumber)] || [];
  return entries.slice(0, MAX_RECITALS_PER_ARTICLE).map((e) => {
    const full = lookup.get(String(e.recital_number)) || {};
    return {
      number: e.recital_number,
      text: stripTags(full.recital_html || full.recital_text || ''),
      matchScore: e.relevanceScore || null,
    };
  });
}

function caseLawForArticle(cases, celex, focusNumber) {
  if (!cases?.length) return [];
  const matches = [];
  for (const c of cases) {
    const refs = (c.articleRefs || []).filter(
      (r) => r.actCelex === celex && String(r.article) === String(focusNumber)
    );
    if (refs.length === 0) continue;
    matches.push({
      ecli: c.ecli || null,
      caseNumber: c.caseNumber || null,
      celex: c.celex,
      date: c.date || null,
      name: c.name || null,
      declarations: c.declarations || [],
      matchingRefs: refs.map((r) => ({
        article: r.article,
        paragraph: r.paragraph,
        point: r.point,
      })),
    });
  }
  matches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return matches;
}

/**
 * Assemble an article bundle from already-cached sources.
 *
 * @param {object} parsedLaw - parsed law object (articles, recitals, definitions)
 * @param {object} recitalMap - recital-map payload ({ byArticle: {...} }), optional
 * @param {Array} cases - case-law list with articleRefs, optional
 * @param {string} articleNumber - focus article number (string)
 * @returns {object|null} the bundle, or null if the article is not found
 */
function buildArticleBundle(parsedLaw, recitalMap, cases, articleNumber) {
  if (!parsedLaw || !articleNumber) return null;
  const article = (parsedLaw.articles || []).find(
    (a) => String(a.article_number) === String(articleNumber)
  );
  if (!article) return null;

  const articleText = stripTags(article.article_html || '');

  return {
    article: {
      number: article.article_number,
      title: article.article_title || null,
      text: articleText,
    },
    skeleton: pickSkeleton(parsedLaw.articles, articleNumber),
    definitions: definitionsUsedIn(articleText, parsedLaw.definitions || []),
    recitals: recitalsFromMap(recitalMap, articleNumber, parsedLaw.recitals),
    caseLaw: caseLawForArticle(cases, parsedLaw.celex, articleNumber),
    meta: {
      celex: parsedLaw.celex,
      lang: parsedLaw.lang,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Assemble a multi-article bundle — used for whole-law questions after
 * the planner has picked which articles are relevant. Recitals and case
 * law are unioned across the selected articles and de-duplicated, so
 * each recital/case appears once regardless of how many articles pulled
 * it in.
 *
 * @param {object} parsedLaw
 * @param {object} recitalMap
 * @param {Array} cases
 * @param {string[]} articleNumbers - ordered list of article numbers to include
 */
function buildLawBundle(parsedLaw, recitalMap, cases, articleNumbers) {
  if (!parsedLaw || !articleNumbers?.length) return null;

  const articleSet = new Set(articleNumbers.map(String));
  const articlesData = (parsedLaw.articles || [])
    .filter((a) => articleSet.has(String(a.article_number)))
    .map((a) => ({
      number: a.article_number,
      title: a.article_title || null,
      chapter: a.division?.chapter?.title || null,
      section: a.division?.section?.title || null,
      text: stripTags(a.article_html || ''),
    }));

  if (articlesData.length === 0) return null;

  const focusSetForDefs = articlesData.map((a) => a.text).join(' ');
  const definitions = definitionsUsedIn(focusSetForDefs, parsedLaw.definitions || []);

  const recitalLookup = new Map();
  for (const r of parsedLaw.recitals || []) {
    recitalLookup.set(String(r.recital_number), r);
  }
  const recitalScores = new Map();
  for (const artNo of articleNumbers) {
    const entries = recitalMap?.byArticle?.[String(artNo)] || [];
    for (const e of entries.slice(0, MAX_RECITALS_PER_ARTICLE)) {
      const prev = recitalScores.get(String(e.recital_number)) || 0;
      if ((e.relevanceScore || 0) > prev) {
        recitalScores.set(String(e.recital_number), e.relevanceScore || 0);
      }
    }
  }
  const recitals = Array.from(recitalScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([number, score]) => {
      const full = recitalLookup.get(number) || {};
      return {
        number,
        text: stripTags(full.recital_html || full.recital_text || ''),
        matchScore: score,
      };
    });

  const caseByCelex = new Map();
  for (const c of cases || []) {
    const refs = (c.articleRefs || []).filter(
      (r) => r.actCelex === parsedLaw.celex && articleSet.has(String(r.article))
    );
    if (refs.length === 0) continue;
    const existing = caseByCelex.get(c.celex);
    const entry = existing || {
      ecli: c.ecli || null,
      caseNumber: c.caseNumber || null,
      celex: c.celex,
      date: c.date || null,
      name: c.name || null,
      declarations: c.declarations || [],
      matchingRefs: [],
    };
    for (const r of refs) {
      entry.matchingRefs.push({ article: r.article, paragraph: r.paragraph, point: r.point });
    }
    caseByCelex.set(c.celex, entry);
  }
  const caseLaw = Array.from(caseByCelex.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    articles: articlesData,
    definitions,
    recitals,
    caseLaw,
    meta: {
      celex: parsedLaw.celex,
      lang: parsedLaw.lang,
      articleNumbers: articlesData.map((a) => String(a.number)),
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = { buildArticleBundle, buildLawBundle };
