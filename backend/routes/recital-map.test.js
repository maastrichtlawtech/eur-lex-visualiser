const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { registerApiRoutes } = require("./api-routes");
const { createEmbeddingCacheService } = require("../shared/embedding-cache-service");
const { createRecitalMapService } = require("../shared/recital-map-service");
const { MissingApiKeyError, EmbeddingProviderError } = require("../shared/openrouter-embeddings");
const { ClientError, safeErrorResponse, cacheGet, cacheSet } = require("../shared/api-utils");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "recital-map-route-"));
}

function createAppRecorder() {
  const routes = new Map();
  return {
    routes,
    get(routePath, ...handlers) {
      routes.set(routePath, handlers[handlers.length - 1]);
    },
  };
}

function createResponseRecorder() {
  return {
    headers: {},
    headersSent: false,
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      this.headersSent = true;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

function registerTestRoutes(overrides = {}) {
  const app = createAppRecorder();
  registerApiRoutes(app, {
    CELEX_NAMES: {},
    EURLEX_BASE: "https://eur-lex.europa.eu",
    FMX_DIR: makeTempDir(),
    RATE_LIMIT_MAX: 100,
    RESOLUTION_CACHE_MS: 60_000,
    cacheGet,
    cacheSet,
    findDownloadUrls: async () => ({ type: "xml", urls: [] }),
    findFmx4Uri: async () => "unused",
    fetchAndParseHtmlLaw: async (celex, lang) => ({
      celex,
      lang,
      source: "eurlex-html",
      format: "combined-v1",
      title: "Test law",
      langCode: "EN",
      articles: [
        { article_number: "1", article_title: "Risk management", article_html: "<p>Risk and transparency.</p>" },
        { article_number: "2", article_title: "Other matters", article_html: "<p>Other obligations.</p>" },
      ],
      recitals: [
        { recital_number: "1", recital_text: "Risk and transparency.", recital_html: "<p>Risk and transparency.</p>" },
        { recital_number: "2", recital_text: "Other topic.", recital_html: "<p>Other topic.</p>" },
      ],
      annexes: [],
      definitions: [],
      crossReferences: {},
    }),
    legalCacheStore: { getStatus: () => ({ ready: true }) },
    parseReferenceText: (text) => ({ raw: text, year: "2015", number: "2366", actType: "directive" }),
    parseStructuredReference: (input) => input,
    prepareLawPayload: async () => {
      throw new ClientError("no FMX files", 404, "fmx_not_found");
    },
    rateLimitMiddleware: (req, res, next) => next?.(),
    resolutionCache: new Map(),
    resolveEurlexUrl: async () => ({}),
    resolveReference: async () => ({}),
    runSparqlQuery: async () => ({ results: { bindings: [] } }),
    safeErrorResponse,
    sendLawResponse: () => {},
    validateCelex: () => true,
    validateLang: (lang) => String(lang || "ENG").toUpperCase(),
    ...overrides,
  });

  return { app };
}

test("GET /api/laws/:celex/recital-map returns the computed map", async () => {
  const cacheDir = makeTempDir();
  const embeddingCache = createEmbeddingCacheService({ CACHE_DIR: cacheDir, STORAGE_LIMIT_MB: 10 });
  const recitalMapService = createRecitalMapService({
    embeddingCache,
    embedBatch: async (texts) => ({
      embeddings: texts.map((text) => (/risk|transparency/i.test(text) ? [1, 0] : [0, 1])),
      usage: { total_tokens: 12 },
    }),
    model: "openai/text-embedding-3-large",
    threshold: 0.2,
    alpha: 0.07,
    apiKey: "sk-test",
    baseUrl: "https://openrouter.example/api/v1",
  });
  const { app } = registerTestRoutes({ recitalMapService });
  const handler = app.routes.get("/api/laws/:celex/recital-map");
  const res = createResponseRecorder();

  await handler({
    params: { celex: "32024R1689" },
    query: { lang: "ENG" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.celex, "32024R1689");
  assert.equal(res.payload.byArticle["1"][0].recital_number, "1");
  assert.equal(res.payload.byArticle["2"][0].recital_number, "2");
});

test("GET /api/laws/:celex/recital-map maps missing key and upstream errors", async () => {
  const cacheDir = makeTempDir();
  const embeddingCache = createEmbeddingCacheService({ CACHE_DIR: cacheDir, STORAGE_LIMIT_MB: 10 });
  const { app: appMissing } = registerTestRoutes({
    recitalMapService: createRecitalMapService({
      embeddingCache,
      embedBatch: async () => { throw new MissingApiKeyError(); },
      model: "openai/text-embedding-3-large",
      apiKey: null,
      baseUrl: "https://openrouter.example/api/v1",
    }),
  });
  const handlerMissing = appMissing.routes.get("/api/laws/:celex/recital-map");
  const resMissing = createResponseRecorder();

  await handlerMissing({
    params: { celex: "32024R1689" },
    query: { lang: "ENG" },
  }, resMissing);

  assert.equal(resMissing.statusCode, 503);
  assert.equal(resMissing.payload.code, "openrouter_unconfigured");

  const { app: appUpstream } = registerTestRoutes({
    recitalMapService: createRecitalMapService({
      embeddingCache: createEmbeddingCacheService({ CACHE_DIR: makeTempDir(), STORAGE_LIMIT_MB: 10 }),
      embedBatch: async () => {
        throw new EmbeddingProviderError("bad gateway", { status: 502 });
      },
      model: "openai/text-embedding-3-large",
      apiKey: "sk-test",
      baseUrl: "https://openrouter.example/api/v1",
    }),
  });
  const handlerUpstream = appUpstream.routes.get("/api/laws/:celex/recital-map");
  const resUpstream = createResponseRecorder();

  await handlerUpstream({
    params: { celex: "32024R1689" },
    query: { lang: "ENG" },
  }, resUpstream);

  assert.equal(resUpstream.statusCode, 502);
  assert.equal(resUpstream.payload.code, "embedding_upstream_failed");
});
