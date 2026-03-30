const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { fetchCaseLaw } = require("./law-queries");

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

  const cachePath = path.join(cacheDir, "case-law-cache-v3.json");
  const saved = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  assert.deepEqual(saved[caseCelex], {
    name: "Example v Example",
    declarations: [{ number: 1, text: "Example ruling." }],
    articlesCited: ["Art. 6 GDPR"],
  });
});
