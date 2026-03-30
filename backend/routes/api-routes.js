const fs = require("fs");

const { ClientError } = require("../shared/api-utils");
const { createSearchHandler } = require("../search/search-route");
const { parseFmxXml } = require("../shared/fmx-parser-node");
const { fetchMetadata, fetchAmendments, fetchImplementing, fetchCaseLaw } = require("../shared/law-queries");

function registerApiRoutes(app, deps) {
  const {
    CELEX_NAMES,
    EURLEX_BASE,
    FMX_DIR,
    RATE_LIMIT_MAX,
    RESOLUTION_CACHE_MS,
    cacheGet,
    cacheSet,
    findDownloadUrls,
    findFmx4Uri,
    fetchAndParseHtmlLaw,
    parseReferenceText,
    parseStructuredReference,
    prepareLawPayload,
    rateLimitMiddleware,
    resolutionCache,
    legalCacheStore,
    resolveEurlexUrl,
    resolveReference,
    runSparqlQuery,
    safeErrorResponse,
    sendLawResponse,
    validateCelex,
    validateLang
  } = deps;

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/laws', rateLimitMiddleware, (req, res) => {
    try {
      const files = fs.readdirSync(FMX_DIR);
      const laws = files.filter((filename) => filename.endsWith('.xml') || filename.endsWith('.zip'));
      res.json({ laws });
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to list cached laws');
    }
  });

  app.get('/api/laws/by-reference', rateLimitMiddleware, async (req, res) => {
    try {
      const rawLang = req.query.lang || 'ENG';
      const lang = validateLang(rawLang);
      if (!lang) {
        return res.status(400).json({ error: `Invalid language code: ${rawLang}` });
      }

      const reference = parseStructuredReference(req.query);
      if (!reference.actType || !reference.year || !reference.number) {
        return res.status(400).json({
          error: 'Provide official reference parameters: actType, year, number',
          code: 'invalid_reference',
        });
      }

      const resolution = await resolveReference(reference, lang);
      if (!resolution.resolved?.celex) {
        return res.status(404).json({
          error: 'Could not resolve the official reference to a CELEX identifier',
          code: 'resolution_failed',
          details: {
            parsed: reference,
            tried: resolution.tried,
            fallback: resolution.fallback,
          },
        });
      }

      try {
        const { servePath } = await prepareLawPayload(resolution.resolved.celex, lang);
        res.setHeader('X-Resolved-CELEX', resolution.resolved.celex);
        res.setHeader('X-Resolved-ELI', resolution.resolved.eli);
        sendLawResponse(res, servePath);
      } catch (err) {
        if (err instanceof ClientError && err.statusCode === 404) {
          throw new ClientError(
            `Resolved CELEX ${resolution.resolved.celex}, but no FMX files are available`,
            404,
            'fmx_not_found',
            {
              resolved: resolution.resolved,
              parsed: reference,
              fallback: resolution.fallback,
            }
          );
        }
        throw err;
      }
    } catch (err) {
      if (!res.headersSent) {
        safeErrorResponse(res, err, 'Failed to fetch law by reference');
      }
    }
  });

  app.get('/api/laws/:celex', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;
      const rawLang = req.query.lang || 'ENG';

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format. Expected: 32016R0679' });
      }

      const lang = validateLang(rawLang);
      if (!lang) {
        return res.status(400).json({ error: `Invalid language code: ${rawLang}` });
      }

      const { servePath } = await prepareLawPayload(celex, lang);
      sendLawResponse(res, servePath);
    } catch (err) {
      if (!res.headersSent) {
        safeErrorResponse(res, err, 'Failed to fetch law');
      }
    }
  });

  app.get('/api/laws/:celex/parsed', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;
      const rawLang = req.query.lang || 'ENG';
      const skipFmxProbe = req.query.skipFmxProbe === '1';

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format. Expected: 32016R0679' });
      }

      const lang = validateLang(rawLang);
      if (!lang) {
        return res.status(400).json({ error: `Invalid language code: ${rawLang}` });
      }

      let parsed = null;
      let source = 'fmx';

      if (!skipFmxProbe) {
        try {
          const { servePath } = await prepareLawPayload(celex, lang);
          const xmlText = fs.readFileSync(servePath, 'utf8');
          parsed = await parseFmxXml(xmlText);
        } catch (err) {
          if (!(err instanceof ClientError) || err.statusCode !== 404 || typeof fetchAndParseHtmlLaw !== 'function') {
            throw err;
          }
          parsed = await fetchAndParseHtmlLaw(celex, lang);
          source = parsed.source || 'eurlex-html';
        }
      } else if (typeof fetchAndParseHtmlLaw === 'function') {
        parsed = await fetchAndParseHtmlLaw(celex, lang);
        source = parsed.source || 'eurlex-html';
      } else {
        const { servePath } = await prepareLawPayload(celex, lang);
        const xmlText = fs.readFileSync(servePath, 'utf8');
        parsed = await parseFmxXml(xmlText);
      }

      res.json({
        celex,
        lang,
        name: CELEX_NAMES[celex] || null,
        format: 'combined-v1',
        source,
        ...parsed,
      });
    } catch (err) {
      if (!res.headersSent) {
        safeErrorResponse(res, err, 'Failed to fetch and parse law');
      }
    }
  });

  app.get('/api/laws/:celex/info', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;
      const rawLang = req.query.lang || 'ENG';

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format' });
      }

      const lang = validateLang(rawLang);
      if (!lang) {
        return res.status(400).json({ error: `Invalid language code: ${rawLang}` });
      }

      const fmx4Uri = await findFmx4Uri(celex, lang);
      const { type } = await findDownloadUrls(fmx4Uri);

      res.json({
        celex,
        lang,
        name: CELEX_NAMES[celex] || null,
        type
      });
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to fetch law metadata');
    }
  });

  app.get('/api/laws/:celex/metadata', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format' });
      }

      const cacheKey = `metadata:${celex}`;
      const cached = cacheGet(resolutionCache, cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const payload = await fetchMetadata(celex, runSparqlQuery);
      cacheSet(resolutionCache, cacheKey, payload, RESOLUTION_CACHE_MS);
      res.json(payload);
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to fetch law metadata');
    }
  });

  app.get('/api/laws/:celex/amendments', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format' });
      }

      const cacheKey = `amendments:${celex}`;
      const cached = cacheGet(resolutionCache, cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const payload = await fetchAmendments(celex, runSparqlQuery);
      cacheSet(resolutionCache, cacheKey, payload, RESOLUTION_CACHE_MS);
      res.json(payload);
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to fetch amendment history');
    }
  });

  app.get('/api/laws/:celex/implementing', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format' });
      }

      const cacheKey = `implementing:${celex}`;
      const cached = cacheGet(resolutionCache, cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const payload = await fetchImplementing(celex, runSparqlQuery);
      cacheSet(resolutionCache, cacheKey, payload, RESOLUTION_CACHE_MS);
      res.json(payload);
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to fetch implementing acts');
    }
  });

  app.get('/api/laws/:celex/case-law', rateLimitMiddleware, async (req, res) => {
    try {
      const { celex } = req.params;

      if (!validateCelex(celex)) {
        return res.status(400).json({ error: 'Invalid CELEX format' });
      }

      const cacheKey = `case-law:${celex}`;
      const cached = cacheGet(resolutionCache, cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const payload = await fetchCaseLaw(celex, runSparqlQuery, { cacheDir: FMX_DIR });
      cacheSet(resolutionCache, cacheKey, payload, RESOLUTION_CACHE_MS);
      res.json(payload);
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to fetch case law');
    }
  });

  app.get('/api/search', rateLimitMiddleware, createSearchHandler(legalCacheStore));

  app.get('/api/resolve-reference', rateLimitMiddleware, async (req, res) => {
    try {
      const rawLang = req.query.lang || 'ENG';
      const lang = validateLang(rawLang);
      if (!lang) {
        return res.status(400).json({ error: `Invalid language code: ${rawLang}` });
      }

      let reference = null;
      if (req.query.actType || req.query.year || req.query.number || req.query.ojColl || req.query.ojNo || req.query.ojYear || req.query.raw) {
        reference = parseStructuredReference(req.query);
      } else if (req.query.text) {
        reference = parseReferenceText(String(req.query.text).trim());
      } else {
        return res.status(400).json({
          error: 'Provide FMX-style structured parameters like actType/year/number, optionally with ojColl/ojNo/ojYear',
        });
      }

      if (!reference.year || !reference.number) {
        return res.status(400).json({
          error: 'Could not parse a structured FMX legal reference',
          code: 'invalid_reference',
          parsed: reference,
        });
      }

      const resolution = await resolveReference(reference, lang);
      const payload = {
        query: reference.raw || null,
        parsed: reference,
        resolved: resolution.resolved,
        tried: resolution.tried,
        fallback: resolution.fallback,
      };
      res.status(resolution.resolved ? 200 : 404).json(payload);
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to resolve legal reference');
    }
  });

  app.get('/api/resolve-url', rateLimitMiddleware, async (req, res) => {
    try {
      const rawLang = req.query.lang || 'ENG';
      const lang = validateLang(rawLang);
      if (!lang) {
        return res.status(400).json({ error: `Invalid language code: ${rawLang}` });
      }

      const sourceUrl = String(req.query.url || '').trim();
      if (!sourceUrl) {
        return res.status(400).json({ error: 'Query parameter "url" required' });
      }

      const payload = await resolveEurlexUrl(sourceUrl, lang);
      res.status(payload.resolved ? 200 : 404).json(payload);
    } catch (err) {
      safeErrorResponse(res, err, 'Failed to resolve EUR-Lex URL');
    }
  });

  app.get('/', (req, res) => {
    res.json({
      name: 'EUR-Lex FMX API',
      version: '2.0.0',
      endpoints: {
        'GET /': 'This documentation',
        'GET /health': 'Health check',
        'GET /api/laws': 'List cached FMX files',
        'GET /api/laws/:celex?lang=ENG': 'Get raw FMX XML by CELEX (fetches & caches)',
        'GET /api/laws/:celex/parsed?lang=ENG': 'Get parsed law as structured JSON (articles, recitals, definitions, annexes, cross-references)',
        'GET /api/laws/:celex/info': 'Get metadata only',
        'GET /api/laws/by-reference?actType=directive&year=2018&number=1972&lang=ENG': 'Resolve an official reference and fetch the matching FMX',
        'GET /api/laws/:celex/case-law': 'List CJEU judgments that interpret this law',
        'GET /api/search?q=keyword&limit=10': 'Search cached primary-law metadata',
        'GET /api/resolve-reference?actType=directive&year=2018&number=1972&lang=ENG': 'Resolve an FMX-derived legal reference to CELEX via cache-first lookup with Cellar fallback',
        'GET /api/resolve-url?url=https://eur-lex.europa.eu/...&lang=ENG': 'Resolve a full EUR-Lex URL to a canonical CELEX'
      },
      celexExamples: {
        '32016R0679': 'GDPR',
        '32024R1689': 'AI Act',
        '32022R1925': 'DMA',
        '32022R2065': 'DSA',
        '32022R0868': 'DGA',
        '32023R2854': 'Data Act'
      }
    });
  });
}

module.exports = {
  registerApiRoutes
};
