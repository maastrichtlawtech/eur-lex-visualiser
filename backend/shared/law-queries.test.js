const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { fetchCaseLaw, parseCitationsToRefs } = require("./law-queries");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("fetchCaseLaw returns quickly while warming uncached details in the background", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "case-law-cache-"));
  const caseCelex = "61999CJ0465";
  const startedAt = Date.now();

  const payload = await fetchCaseLaw("31995L0046", async () => ({
    results: {
      bindings: [
        {
          caseCelex: { value: caseCelex },
          ecli: { value: "ECLI:EU:C:2000:000" },
          date: { value: "2000-05-01" },
        },
      ],
    },
  }), {
    cacheDir,
    enrichBudgetMs: 10,
    detailsFetcher: async () => {
      await sleep(80);
      return {
        name: "Example v Example",
        declarations: [{ number: 1, text: "Example ruling." }],
        articlesCited: ["Art. 6 GDPR"],
      };
    },
  });

  const elapsedMs = Date.now() - startedAt;
  assert.equal(payload.celex, "31995L0046");
  assert.equal(payload.cases.length, 1);
  assert.equal(payload.cases[0].name, null);
  assert.deepEqual(payload.cases[0].declarations, []);
  assert.ok(elapsedMs < 70, `Expected a bounded response, got ${elapsedMs}ms`);

  await sleep(140);

  const cachePath = path.join(cacheDir, "case-law-cache-v4.json");
  const saved = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  assert.deepEqual(saved[caseCelex], {
    name: "Example v Example",
    declarations: [{ number: 1, text: "Example ruling." }],
    articlesCited: ["Art. 6 GDPR"],
    articleRefs: [
      {
        raw: "Art. 6 GDPR",
        act: "GDPR",
        actCelex: "32016R0679",
        article: "6",
        paragraph: null,
        point: null,
      },
    ],
  });
});

test("parseCitationsToRefs handles plain, paragraph, point, and 95/46-style tokens", () => {
  const refs = parseCitationsToRefs([
    "Art. 6 GDPR",
    "Art. 6(1) GDPR",
    "Art. 6(1)(a) GDPR",
    "Art. 7(a) 95/46",
    "Art. 267 TFEU",
  ]);
  assert.deepEqual(refs, [
    { raw: "Art. 6 GDPR", act: "GDPR", actCelex: "32016R0679", article: "6", paragraph: null, point: null },
    { raw: "Art. 6(1) GDPR", act: "GDPR", actCelex: "32016R0679", article: "6", paragraph: "1", point: null },
    { raw: "Art. 6(1)(a) GDPR", act: "GDPR", actCelex: "32016R0679", article: "6", paragraph: "1", point: "a" },
    { raw: "Art. 7(a) 95/46", act: "95/46", actCelex: "31995L0046", article: "7", paragraph: null, point: "a" },
    { raw: "Art. 267 TFEU", act: "TFEU", actCelex: "12012E", article: "267", paragraph: null, point: null },
  ]);
});

test("parseCitationsToRefs resolves actCelex for all mapped acts", () => {
  const cases = [
    ["Art. 5 2002/58",   "32002L0058"],
    ["Art. 1 2016/680",  "32016L0680"],
    ["Art. 8 Charter",   "12012P"],
    ["Art. 5 2016/679",  "32016R0679"],
    ["Art. 3 TEU",       "12012M"],
    ["Art. 1 2022/2065", "32022R2065"],
    ["Art. 1 2022/1925", "32022R1925"],
    ["Art. 1 2024/1689", "32024R1689"],
    ["Art. 1 2016/943",  null],   // unmapped — left null
  ];
  for (const [str, expectedCelex] of cases) {
    const refs = parseCitationsToRefs([str]);
    assert.equal(refs.length, 1, `expected one ref for "${str}"`);
    assert.equal(refs[0].actCelex, expectedCelex, `actCelex mismatch for "${str}"`);
  }
});

test("parseCitationsToRefs splits composite 'N and M' / 'N, M and P' strings", () => {
  const refs = parseCitationsToRefs([
    "Art. 45 and 46 GDPR",
    "Art. 5, 6 and 10 GDPR",
  ]);
  assert.equal(refs.length, 5);
  assert.deepEqual(
    refs.map((r) => ({ art: r.article, raw: r.raw })),
    [
      { art: "45", raw: "Art. 45 and 46 GDPR" },
      { art: "46", raw: "Art. 45 and 46 GDPR" },
      { art: "5", raw: "Art. 5, 6 and 10 GDPR" },
      { art: "6", raw: "Art. 5, 6 and 10 GDPR" },
      { art: "10", raw: "Art. 5, 6 and 10 GDPR" },
    ]
  );
});

test("parseCitationsToRefs deduplicates repeated (act, article, paragraph, point) tuples", () => {
  const refs = parseCitationsToRefs([
    "Art. 6(1)(a) GDPR",
    "Art. 6(1)(a) GDPR",
  ]);
  assert.equal(refs.length, 1);
});

test("parseCitationsToRefs tolerates malformed strings without throwing", () => {
  const refs = parseCitationsToRefs([
    "",
    "not a citation",
    "Article 6 of Regulation (EU) 2016/679", // long form, not compact
    null,
  ]);
  assert.deepEqual(refs, []);
});

test("fetchCaseLaw migrates v3 cache on load by populating articleRefs", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "case-law-cache-"));
  const caseCelex = "62019CJ0439";

  // Seed a v3-style cache file (no articleRefs).
  const v3Path = path.join(cacheDir, "case-law-cache-v3.json");
  fs.writeFileSync(v3Path, JSON.stringify({
    [caseCelex]: {
      name: "B v Latvijas Republikas Saeima",
      declarations: [{ number: 1, text: "The Court rules." }],
      articlesCited: ["Art. 5, 6 and 10 GDPR"],
    },
  }));

  const payload = await fetchCaseLaw("32016R0679", async () => ({
    results: {
      bindings: [
        {
          caseCelex: { value: caseCelex },
          ecli: { value: "ECLI:EU:C:2021:504" },
          date: { value: "2021-06-22" },
        },
      ],
    },
  }), {
    cacheDir,
    enrichBudgetMs: 10,
    detailsFetcher: async () => null, // should not be called — entry is cached
  });

  const caseEntry = payload.cases[0];
  assert.equal(caseEntry.articleRefs.length, 3);
  assert.deepEqual(
    caseEntry.articleRefs.map((r) => r.article),
    ["5", "6", "10"]
  );

  // v4 file should have been written with migrated refs.
  const v4Path = path.join(cacheDir, "case-law-cache-v4.json");
  assert.ok(fs.existsSync(v4Path), "expected v4 cache file to be written");
  const v4 = JSON.parse(fs.readFileSync(v4Path, "utf8"));
  assert.equal(v4[caseCelex].articleRefs.length, 3);
});
