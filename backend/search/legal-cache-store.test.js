const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  JsonLegalCacheStore,
} = require("./legal-cache-store");

const fixturePath = path.join(__dirname, "__fixtures__", "search-fixture.json");

test("legal cache store loads fixture successfully", () => {
  const store = new JsonLegalCacheStore(fixturePath);
  assert.equal(store.load(), true);
  assert.equal(store.getStatus().ready, true);
  assert.equal(store.getStatus().count, 10);
});

test("legal cache store reports missing file", () => {
  const missingPath = path.join(os.tmpdir(), `missing-${Date.now()}.json`);
  const store = new JsonLegalCacheStore(missingPath);
  assert.equal(store.load(), false);
  assert.equal(store.getStatus().ready, false);
  assert.match(store.getStatus().error, /Search cache not found/);
});

test("legal cache store reports malformed JSON", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "legal-cache-store-bad-"));
  const tempPath = path.join(tempDir, "broken.json");
  fs.writeFileSync(tempPath, "{not valid json", "utf8");

  const store = new JsonLegalCacheStore(tempPath);
  assert.equal(store.load(), false);
  assert.equal(store.getStatus().ready, false);
  assert.match(store.getStatus().error, /Unexpected token|Expected property name|JSON/i);
});

test("legal cache store resolves exact CELEX", () => {
  const store = new JsonLegalCacheStore(fixturePath);
  store.load();
  assert.equal(store.getByCelex("32016r0679")?.title.includes("General Data Protection Regulation"), true);
});

test("legal cache store resolves exact ELI", () => {
  const store = new JsonLegalCacheStore(fixturePath);
  store.load();
  const match = store.getByEli("https://data.europa.eu/eli/dir/2015/2366/oj/");
  assert.equal(match?.celex, "32015L2366");
});

test("legal cache store resolves exact official reference", () => {
  const store = new JsonLegalCacheStore(fixturePath);
  store.load();
  const match = store.getByOfficialReference({
    actType: "Directive",
    year: "2015",
    number: "02366",
  });
  assert.equal(match?.celex, "32015L2366");
});

test("legal cache store returns null for ambiguous official reference key", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "legal-cache-store-"));
  const tempPath = path.join(tempDir, "ambiguous.json");
  fs.writeFileSync(tempPath, JSON.stringify({
    generatedAt: "2026-03-28T00:00:00.000Z",
    count: 2,
    records: [
      {
        celex: "32020R0123",
        title: "Regulation (EU) 2020/123",
        type: "regulation",
        date: "2020-01-01",
        eli: "http://data.europa.eu/eli/reg/2020/123/oj",
        fmxAvailable: true,
        fmxUnavailable: false,
      },
      {
        celex: "32020R0123",
        title: "Regulation (EU) 2020/123 duplicate",
        type: "regulation",
        date: "2020-01-02",
        eli: "http://data.europa.eu/eli/reg/2020/123/oj",
        fmxAvailable: true,
        fmxUnavailable: false,
      },
    ],
  }, null, 2));

  const store = new JsonLegalCacheStore(tempPath);
  store.load();
  assert.equal(store.getByOfficialReference({
    actType: "regulation",
    year: "2020",
    number: "123",
  }), null);
  assert.equal(store.getByEli("http://data.europa.eu/eli/reg/2020/123/oj"), null);
});
