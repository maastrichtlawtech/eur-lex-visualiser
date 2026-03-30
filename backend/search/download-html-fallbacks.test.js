const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  createMetadataPayload,
  downloadPrimaryActHtmlFallbacks,
  harvestYearPrimaryActs,
  processRecord,
  readJsonGzip,
  normalizeYearStateStatus,
  writeTextGzip,
  writeJsonGzip,
} = require("./download-html-fallbacks");

function sampleRecord(overrides = {}) {
  return {
    celex: "32015L2366",
    title: "Directive (EU) 2015/2366",
    type: "directive",
    date: "2015-11-25",
    eli: "http://data.europa.eu/eli/dir/2015/2366/oj",
    celexYear: "2015",
    celexNumber: "2366",
    ...overrides,
  };
}

async function withTempDir(run) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "legalviz-html-fallbacks-"));
  try {
    await run(tempDir);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function readTextGzip(filePath) {
  const { gunzip } = require("zlib");
  const { promisify } = require("util");
  const gunzipAsync = promisify(gunzip);
  return String(await gunzipAsync(await fsp.readFile(filePath)));
}

test("createMetadataPayload keeps relevant metadata and error details", () => {
  const payload = createMetadataPayload(sampleRecord(), {
    lang: "ENG",
    status: "challenged",
    source: "eurlex-html",
    fmxUnavailable: true,
    error: Object.assign(new Error("blocked"), { code: "eurlex_html_challenged", statusCode: 503 }),
  });

  assert.equal(payload.celex, "32015L2366");
  assert.equal(payload.status, "challenged");
  assert.equal(payload.fmxUnavailable, true);
  assert.equal(payload.error.code, "eurlex_html_challenged");
  assert.equal(payload.error.status, 503);
});

test("normalizeYearStateStatus treats current-year complete as snapshot_complete", () => {
  assert.equal(normalizeYearStateStatus("2026", "complete", 2026), "snapshot_complete");
  assert.equal(normalizeYearStateStatus("2025", "complete", 2026), "complete");
});

test("processRecord writes compressed metadata and source HTML for a no-FMX law", async () => {
  await withTempDir(async (tempDir) => {
    const record = sampleRecord();
    const result = await processRecord(
      record,
      {
        outputDir: tempDir,
        lang: "ENG",
        year: 2015,
        eurlexBase: "https://eur-lex.europa.eu",
        timeoutMs: 1_000,
        stopOnChallenge: true,
      },
      {
        findFmx4UriImpl: async () => {
          throw new Error(`No FMX URI found for ${record.celex}`);
        },
        fetchHtmlLawImpl: async () => ({
          celex: record.celex,
          lang: "ENG",
          requestedLang: "ENG",
          servedLang: "ENG",
          source: "eurlex-html",
          rawHtml: "<html><body>source law</body></html>",
        }),
      }
    );

    assert.equal(result.status, "downloaded");
    const metadata = await readJsonGzip(result.metadataPath);
    const sourceHtml = await readTextGzip(result.htmlPath);
    assert.equal(metadata.status, "downloaded");
    assert.equal(metadata.fmxUnavailable, true);
    assert.match(sourceHtml, /source law/);
  });
});

test("processRecord records challenge status and stops early without payload output", async () => {
  await withTempDir(async (tempDir) => {
    const record = sampleRecord({ celex: "31995L0046", celexYear: "1995", celexNumber: "46" });
    const result = await processRecord(
      record,
      {
        outputDir: tempDir,
        lang: "ENG",
        year: 1995,
        eurlexBase: "https://eur-lex.europa.eu",
        timeoutMs: 1_000,
        stopOnChallenge: true,
      },
      {
        findFmx4UriImpl: async () => {
          throw new Error(`No FMX URI found for ${record.celex}`);
        },
        fetchHtmlLawImpl: async () => {
          throw Object.assign(new Error("challenged"), {
            code: "eurlex_html_challenged",
            statusCode: 503,
          });
        },
      }
    );

    assert.equal(result.status, "challenged");
    assert.equal(result.shouldStop, true);
    const metadata = await readJsonGzip(result.metadataPath);
    assert.equal(metadata.status, "challenged");
    assert.equal(metadata.error.code, "eurlex_html_challenged");
    assert.equal(fs.existsSync(path.join(tempDir, "ENG", "1995", `${record.celex}.combined-v1.json.gz`)), false);
  });
});

test("processRecord trusts search-cache FMX hints before probing live", async () => {
  await withTempDir(async (tempDir) => {
    const record = sampleRecord();
    let liveProbeCalled = false;

    const result = await processRecord(
      record,
      {
        outputDir: tempDir,
        lang: "ENG",
        year: 2015,
        eurlexBase: "https://eur-lex.europa.eu",
        timeoutMs: 1_000,
        stopOnChallenge: true,
      },
      {
        searchCacheHints: new Map([[record.celex, { celex: record.celex, fmxAvailable: true }]]),
        findFmx4UriImpl: async () => {
          liveProbeCalled = true;
          return "unexpected";
        },
        fetchHtmlLawImpl: async () => {
          throw new Error("html fetch should not run");
        },
      }
    );

    assert.equal(result.status, "fmx_available");
    assert.equal(liveProbeCalled, false);
    const metadata = await readJsonGzip(result.metadataPath);
    assert.equal(metadata.source, "search-cache");
  });
});

test("harvestYearPrimaryActs paginates based on raw bindings, not filtered page size", async () => {
  const pages = [
    {
      results: {
        bindings: [
          {
            celex: { value: "32001D0006(01)" },
            eli: { value: "http://data.europa.eu/eli/dec/2001/566/oj" },
          },
          {
            celex: { value: "32001D0011" },
            eli: { value: "http://data.europa.eu/eli/dec/2001/912/oj" },
          },
        ],
      },
    },
    {
      results: {
        bindings: [
          {
            celex: { value: "32001R0045" },
            eli: { value: "http://data.europa.eu/eli/reg/2001/45/oj" },
          },
        ],
      },
    },
  ];
  let calls = 0;

  const records = await harvestYearPrimaryActs(2001, {
    limit: 2,
    actTypes: ["decision", "regulation"],
    runSparqlImpl: async () => pages[calls++] || { results: { bindings: [] } },
  });

  assert.equal(calls, 2);
  assert.deepEqual(records.map((record) => record.celex), ["32001D0011", "32001R0045"]);
 });

test("harvestYearPrimaryActs excludes decisions by default", async () => {
  let capturedQuery = "";
  const records = await harvestYearPrimaryActs(2001, {
    limit: 10,
    runSparqlImpl: async (query) => {
      capturedQuery = query;
      return {
        results: {
          bindings: [
            { celex: { value: "32001D0011" }, eli: { value: "http://data.europa.eu/eli/dec/2001/912/oj" } },
            { celex: { value: "32001R0045" }, eli: { value: "http://data.europa.eu/eli/reg/2001/45/oj" } },
            { celex: { value: "32001L0029" }, eli: { value: "http://data.europa.eu/eli/dir/2001/29/oj" } },
          ],
        },
      };
    },
  });

  assert.match(capturedQuery, /\^32001\[RL\]/);
  assert.doesNotMatch(capturedQuery, /dec/);
  assert.deepEqual(records.map((record) => record.celex), ["32001L0029", "32001R0045"]);
});

test("downloadPrimaryActHtmlFallbacks writes year manifests and stops on challenge", async () => {
  await withTempDir(async (tempDir) => {
    const statePath = path.join(tempDir, "state.json");
    const outputDir = path.join(tempDir, "downloads");

    const result = await downloadPrimaryActHtmlFallbacks(
      {
        fromYear: 2015,
        toYear: 2015,
        outputDir,
        statePath,
        stopOnChallenge: true,
      },
      {
        harvestYearPrimaryActsImpl: async () => [
          sampleRecord(),
          sampleRecord({ celex: "31995L0046", celexYear: "1995", celexNumber: "46", title: "Directive 95/46/EC", date: "1995-10-24" }),
        ],
        findFmx4UriImpl: async (celex) => {
          if (celex === "32015L2366") {
            throw new Error("No FMX URI found for 32015L2366");
          }
          throw new Error("No FMX URI found for 31995L0046");
        },
        fetchHtmlLawImpl: async ({ celex }) => {
          if (celex === "31995L0046") {
            throw Object.assign(new Error("challenged"), {
              code: "eurlex_html_challenged",
              statusCode: 503,
            });
          }
          return {
            celex,
            lang: "ENG",
            requestedLang: "ENG",
            servedLang: "ENG",
            source: "eurlex-html",
            rawHtml: `<html>${celex}</html>`,
          };
        },
        sleepImpl: async () => {},
        logProgressImpl: () => {},
      }
    );

    assert.equal(result.stoppedEarly, true);
    assert.equal(result.challengeCelex, "31995L0046");

    const manifest = JSON.parse(await fsp.readFile(path.join(outputDir, "ENG", "2015", "manifest.json"), "utf8"));
    assert.equal(manifest.counts.downloaded, 1);
    assert.equal(manifest.counts.challenged, 1);
    assert.equal("records" in manifest, false);
    assert.equal(manifest.lastCelex, "31995L0046");

    const state = JSON.parse(await fsp.readFile(statePath, "utf8"));
    assert.equal(state.years["2015"].status, "challenged");
    assert.equal(state.years["2015"].lastCelex, "31995L0046");
  });
});

test("downloadPrimaryActHtmlFallbacks resumes from existing compressed metadata without manifest records", async () => {
  await withTempDir(async (tempDir) => {
    const statePath = path.join(tempDir, "state.json");
    const outputDir = path.join(tempDir, "downloads");
    const yearDir = path.join(outputDir, "ENG", "2015");
    const record = sampleRecord();

    await fsp.mkdir(yearDir, { recursive: true });
    await fsp.writeFile(
      path.join(yearDir, "manifest.json"),
      JSON.stringify({
        year: "2015",
        lang: "ENG",
        counts: {
          harvested: 1,
          downloaded: 1,
          fmxAvailable: 0,
          challenged: 0,
          lawNotFound: 0,
          downloadError: 0,
          skippedExisting: 0,
        },
        records: [{ celex: record.celex, status: "downloaded" }],
      }),
      "utf8"
    );

    const existingMetadata = createMetadataPayload(record, {
      lang: "ENG",
      status: "downloaded",
      source: "eurlex-html",
      fmxUnavailable: true,
      requestedLang: "ENG",
      servedLang: "ENG",
    });
    await writeJsonGzip(path.join(yearDir, `${record.celex}.metadata.json.gz`), existingMetadata);
    await writeTextGzip(path.join(yearDir, `${record.celex}.source.html.gz`), "<html>cached source</html>");

    let fetchCalls = 0;
    const result = await downloadPrimaryActHtmlFallbacks(
      {
        fromYear: 2015,
        toYear: 2015,
        outputDir,
        statePath,
        stopOnChallenge: true,
      },
      {
        harvestYearPrimaryActsImpl: async () => [record],
        findFmx4UriImpl: async () => {
          throw new Error("live FMX probe should not run");
        },
        fetchHtmlLawImpl: async () => {
          fetchCalls += 1;
          throw new Error("html fetch should not run");
        },
        sleepImpl: async () => {},
        logProgressImpl: () => {},
      }
    );

    assert.equal(result.stoppedEarly, false);
    assert.equal(fetchCalls, 0);
    const manifest = JSON.parse(await fsp.readFile(path.join(yearDir, "manifest.json"), "utf8"));
    assert.equal(manifest.counts.downloaded, 1);
    assert.equal(manifest.lastCelex, record.celex);
    assert.equal("records" in manifest, false);
  });
});

test("downloadPrimaryActHtmlFallbacks stops cleanly at a checkpoint limit", async () => {
  await withTempDir(async (tempDir) => {
    const statePath = path.join(tempDir, "state.json");
    const outputDir = path.join(tempDir, "downloads");
    const records = [
      sampleRecord({ celex: "32015L2366", celexNumber: "2366" }),
      sampleRecord({ celex: "32015L2367", celexNumber: "2367", eli: "http://data.europa.eu/eli/dir/2015/2367/oj" }),
      sampleRecord({ celex: "32015L2368", celexNumber: "2368", eli: "http://data.europa.eu/eli/dir/2015/2368/oj" }),
    ];

    const result = await downloadPrimaryActHtmlFallbacks(
      {
        fromYear: 2015,
        toYear: 2015,
        outputDir,
        statePath,
        stopOnChallenge: true,
        maxAttemptsPerRun: 2,
      },
      {
        harvestYearPrimaryActsImpl: async () => records,
        findFmx4UriImpl: async () => {
          throw new Error("No FMX URI found");
        },
        fetchHtmlLawImpl: async ({ celex }) => ({
          celex,
          lang: "ENG",
          requestedLang: "ENG",
          servedLang: "ENG",
          source: "eurlex-html",
          rawHtml: `<html>${celex}</html>`,
        }),
        sleepImpl: async () => {},
        logProgressImpl: () => {},
      }
    );

    assert.equal(result.stoppedEarly, true);
    assert.equal(result.stopReason, "checkpoint");
    assert.equal(result.attemptsThisRun, 2);
    assert.equal(result.checkpointCelex, "32015L2367");

    const state = JSON.parse(await fsp.readFile(statePath, "utf8"));
    assert.equal(state.years["2015"].status, "in_progress");
    assert.equal(state.years["2015"].lastCelex, "32015L2367");

    const manifest = JSON.parse(await fsp.readFile(path.join(outputDir, "ENG", "2015", "manifest.json"), "utf8"));
    assert.equal(manifest.counts.downloaded, 2);
    assert.equal(manifest.counts.harvested, 3);
  });
});

test("downloadPrimaryActHtmlFallbacks skips years already marked complete in state", async () => {
  await withTempDir(async (tempDir) => {
    const statePath = path.join(tempDir, "state.json");
    const outputDir = path.join(tempDir, "downloads");

    await fsp.writeFile(
      statePath,
      JSON.stringify({
        fromYear: 2016,
        toYear: 2015,
        lang: "ENG",
        years: {
          "2016": { status: "complete" },
        },
      }),
      "utf8"
    );

    const harvestedYears = [];
    const result = await downloadPrimaryActHtmlFallbacks(
      {
        fromYear: 2016,
        toYear: 2015,
        outputDir,
        statePath,
        stopOnChallenge: true,
      },
      {
        harvestYearPrimaryActsImpl: async (year) => {
          harvestedYears.push(year);
          return year === 2015 ? [sampleRecord()] : [];
        },
        findFmx4UriImpl: async () => {
          throw new Error("No FMX URI found");
        },
        fetchHtmlLawImpl: async ({ celex }) => ({
          celex,
          lang: "ENG",
          requestedLang: "ENG",
          servedLang: "ENG",
          source: "eurlex-html",
          rawHtml: `<html>${celex}</html>`,
        }),
        sleepImpl: async () => {},
        logProgressImpl: () => {},
      }
    );

    assert.equal(result.stoppedEarly, false);
    assert.deepEqual(harvestedYears, [2015]);
  });
});

test("downloadPrimaryActHtmlFallbacks marks the current year as snapshot_complete", async () => {
  await withTempDir(async (tempDir) => {
    const statePath = path.join(tempDir, "state.json");
    const outputDir = path.join(tempDir, "downloads");

    const result = await downloadPrimaryActHtmlFallbacks(
      {
        fromYear: 2026,
        toYear: 2026,
        currentYear: 2026,
        outputDir,
        statePath,
        stopOnChallenge: true,
      },
      {
        harvestYearPrimaryActsImpl: async () => [],
        sleepImpl: async () => {},
        logProgressImpl: () => {},
      }
    );

    assert.equal(result.stoppedEarly, false);
    const state = JSON.parse(await fsp.readFile(statePath, "utf8"));
    assert.equal(state.years["2026"].status, "snapshot_complete");
  });
});
