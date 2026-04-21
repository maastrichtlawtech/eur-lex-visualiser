const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createEmbeddingCacheService } = require("./embedding-cache-service");
const { createRecitalMapService } = require("./recital-map-service");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "recital-map-service-"));
}

test("getRecitalMap caches results and enriches mapped recitals with keywords", async () => {
  const dir = makeTempDir();
  let callCount = 0;
  const cache = createEmbeddingCacheService({ CACHE_DIR: dir, STORAGE_LIMIT_MB: 10 });
  const service = createRecitalMapService({
    embeddingCache: cache,
    embedBatch: async (texts) => {
      callCount += 1;
      return {
        embeddings: texts.map((text) => {
          if (/risk|transparency/i.test(text)) return [1, 0];
          return [0, 1];
        }),
        usage: { total_tokens: 123 },
      };
    },
    model: "openai/text-embedding-3-large",
    threshold: 0.2,
    alpha: 0.07,
    baseUrl: "https://openrouter.example/api/v1",
    apiKey: "sk-test",
  });

  const parsed = {
    title: "Test law",
    langCode: "EN",
    recitals: [
      {
        recital_number: "1",
        recital_text: "Risk transparency risk and audit.",
        recital_html: "<p>Risk transparency risk and audit.</p>",
      },
      {
        recital_number: "2",
        recital_text: "Other unrelated text.",
        recital_html: "<p>Other unrelated text.</p>",
      },
    ],
    articles: [
      {
        article_number: "1",
        article_title: "Risk management",
        article_html: "<p>Risk transparency rules.</p>",
      },
      {
        article_number: "2",
        article_title: "Other matters",
        article_html: "<p>Other obligations.</p>",
      },
    ],
  };

  const first = await service.getRecitalMap("32024R1689", "ENG", parsed);
  const second = await service.getRecitalMap("32024R1689", "ENG", parsed);

  assert.equal(callCount, 1);
  assert.equal(first.model, "openai/text-embedding-3-large");
  assert.equal(first.langCode, "EN");
  assert.equal(first.byArticle["1"][0].recital_number, "1");
  assert.equal(first.byArticle["2"][0].recital_number, "2");
  assert.ok(first.byArticle["1"][0].keywords.includes("risk"));
  assert.equal(first.orphans.length, 0);
  assert.deepEqual(second, first);

  const files = fs.readdirSync(dir);
  assert.ok(files.some((filename) => filename.endsWith(".recital-map.json.gz")));
});
