const fsp = require("fs/promises");
const path = require("path");
const { gzip, gunzip } = require("zlib");
const { promisify } = require("util");

const { fetchEurlexHtmlLaw, closeSharedPlaywrightBrowser } = require("../shared/eurlex-html-parser");
const { enrichSearchRecord, inferTypeFromCelex } = require("./search-ranking");
const {
  DEFAULT_SEARCH_CACHE_PATH,
  buildYearQuery,
  ensurePositiveInt,
  findFmx4Uri,
  logProgress,
  normalizeYearQueryActTypes,
  runSparql,
} = require("./search-build");

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "..", "html-fallback-downloads");
const DEFAULT_STATE_PATH = path.join(DEFAULT_OUTPUT_DIR, "download-state.json");
const FINAL_SKIP_STATUSES = new Set(["downloaded", "fmx_available", "law_not_found"]);

function normalizeYearStateStatus(year, status, currentYear = new Date().getUTCFullYear()) {
  if (Number.parseInt(String(year), 10) === Number(currentYear) && status === "complete") {
    return "snapshot_complete";
  }
  return status || "pending";
}

function normalizeTitle(value) {
  const title = String(value || "").trim();
  return title || null;
}

function toRecord(binding) {
  const celex = binding.celex?.value;
  return enrichSearchRecord({
    celex,
    title: normalizeTitle(binding.title?.value || null),
    date: binding.date?.value || null,
    eli: binding.eli?.value || null,
    type: inferTypeFromCelex(celex),
    fmxAvailable: false,
    fmxUnavailable: false,
    enrichError: null,
  });
}

async function writeJsonGzip(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const buffer = await gzipAsync(Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8"));
  await fsp.writeFile(tempPath, buffer);
  await fsp.rename(tempPath, filePath);
}

async function writeTextGzip(filePath, text) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const buffer = await gzipAsync(Buffer.from(String(text || ""), "utf8"));
  await fsp.writeFile(tempPath, buffer);
  await fsp.rename(tempPath, filePath);
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonGzip(filePath, fallback = null) {
  try {
    const compressed = await fsp.readFile(filePath);
    const text = await gunzipAsync(compressed);
    return JSON.parse(String(text));
  } catch {
    return fallback;
  }
}

function createMetadataPayload(record, details = {}) {
  const error = details.error
    ? {
      message: details.error.message,
      code: details.error.code || null,
      status: details.error.statusCode || details.error.status || null,
    }
    : null;

  return {
    celex: record.celex,
    title: record.title || null,
    type: record.type || null,
    date: record.date || null,
    eli: record.eli || null,
    celexYear: record.celexYear || null,
    celexNumber: record.celexNumber || null,
    lang: details.lang || "ENG",
    status: details.status || "unknown",
    source: details.source || null,
    fmxAvailable: Boolean(details.fmxAvailable),
    fmxUnavailable: Boolean(details.fmxUnavailable),
    requestedLang: details.requestedLang || details.lang || "ENG",
    servedLang: details.servedLang || null,
    downloadedAt: new Date().toISOString(),
    error,
  };
}

async function loadSearchCacheHints(searchCachePath) {
  if (!searchCachePath) return new Map();
  const payload = await readJson(searchCachePath, null);
  const records = Array.isArray(payload?.records) ? payload.records : [];
  return new Map(records.map((record) => [record.celex, record]));
}

function createYearManifest(year, lang) {
  return {
    year: String(year),
    lang,
    updatedAt: new Date().toISOString(),
    lastCelex: null,
    counts: {
      harvested: 0,
      downloaded: 0,
      fmxAvailable: 0,
      challenged: 0,
      lawNotFound: 0,
      downloadError: 0,
      skippedExisting: 0,
    },
  };
}

function touchManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  return manifest;
}

function incrementManifestCount(manifest, status) {
  if (status === "downloaded") manifest.counts.downloaded += 1;
  else if (status === "fmx_available") manifest.counts.fmxAvailable += 1;
  else if (status === "challenged") manifest.counts.challenged += 1;
  else if (status === "law_not_found") manifest.counts.lawNotFound += 1;
  else if (status === "download_error" || status === "fmx_error") manifest.counts.downloadError += 1;
  else if (status === "skipped_existing") manifest.counts.skippedExisting += 1;
  return touchManifest(manifest);
}

function normalizeExistingManifest(manifest, year, lang) {
  if (!manifest || typeof manifest !== "object") {
    return createYearManifest(year, lang);
  }
  const normalized = {
    year: String(manifest.year || year),
    lang: manifest.lang || lang,
    updatedAt: manifest.updatedAt || new Date().toISOString(),
    lastCelex: manifest.lastCelex || null,
    counts: {
      harvested: Number(manifest.counts?.harvested || 0),
      downloaded: Number(manifest.counts?.downloaded || 0),
      fmxAvailable: Number(manifest.counts?.fmxAvailable || 0),
      challenged: Number(manifest.counts?.challenged || 0),
      lawNotFound: Number(manifest.counts?.lawNotFound || 0),
      downloadError: Number(manifest.counts?.downloadError || 0),
      skippedExisting: Number(manifest.counts?.skippedExisting || 0),
    },
  };

  if (Array.isArray(manifest.records) && !normalized.lastCelex) {
    normalized.lastCelex = manifest.records[manifest.records.length - 1]?.celex || null;
  }

  return normalized;
}

function getRecordOutputPaths(record, options) {
  const yearDir = path.join(options.outputDir, options.lang, String(record.celexYear || options.year));
  return {
    yearDir,
    metadataPath: path.join(yearDir, `${record.celex}.metadata.json.gz`),
    htmlPath: path.join(yearDir, `${record.celex}.source.html.gz`),
  };
}

async function readExistingRecordStatus(record, options) {
  const { metadataPath, htmlPath } = getRecordOutputPaths(record, options);
  const metadata = await readJsonGzip(metadataPath, null);
  if (!metadata?.status) return null;
  return {
    status: metadata.status,
    metadataPath,
    htmlPath: metadata.status === "downloaded" ? htmlPath : null,
  };
}

function shouldSkipManifestEntry(entry) {
  return FINAL_SKIP_STATUSES.has(entry?.status);
}

async function writeManifest(manifestPath, manifest) {
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  await fsp.writeFile(manifestPath, `${JSON.stringify(touchManifest(manifest), null, 2)}\n`, "utf8");
}

async function writeState(statePath, state) {
  await fsp.mkdir(path.dirname(statePath), { recursive: true });
  await fsp.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function harvestYearPrimaryActs(year, {
  limit = 200,
  actTypes = ["regulation", "directive"],
  runSparqlImpl = runSparql,
} = {}) {
  const records = new Map();
  let offset = 0;
  const normalizedActTypes = normalizeYearQueryActTypes(actTypes);

  while (true) {
    const data = await runSparqlImpl(buildYearQuery({ year, limit, offset, actTypes: normalizedActTypes }));
    const bindings = data.results?.bindings || [];
    const incoming = bindings
      .map(toRecord)
      .filter((record) => record.celex && record.eli && record.isPrimaryAct)
      .filter((record) => normalizedActTypes.includes(record.type));

    for (const record of incoming) {
      records.set(record.celex, record);
    }

    if (bindings.length < limit) break;
    offset += limit;
  }

  return [...records.values()].sort((left, right) => String(left.celex).localeCompare(String(right.celex)));
}

async function processRecord(record, options, deps) {
  const { metadataPath, htmlPath } = getRecordOutputPaths(record, options);
  const cachedHint = deps.searchCacheHints?.get(record.celex) || null;

  if (cachedHint?.fmxAvailable) {
    const metadata = createMetadataPayload(record, {
      lang: options.lang,
      status: "fmx_available",
      fmxAvailable: true,
      source: "search-cache",
    });
    await writeJsonGzip(metadataPath, metadata);
    return {
      celex: record.celex,
      status: "fmx_available",
      metadataPath,
      htmlPath: null,
      shouldStop: false,
    };
  }

  if (!cachedHint?.fmxUnavailable) {
    try {
      await deps.findFmx4UriImpl(record.celex, options.lang);
      const metadata = createMetadataPayload(record, {
        lang: options.lang,
        status: "fmx_available",
        fmxAvailable: true,
        source: "fmx",
      });
      await writeJsonGzip(metadataPath, metadata);
      return {
        celex: record.celex,
        status: "fmx_available",
        metadataPath,
        htmlPath: null,
        shouldStop: false,
      };
    } catch (error) {
      const message = String(error?.message || error || "");
      if (!message.includes("No FMX URI found")) {
        const metadata = createMetadataPayload(record, {
          lang: options.lang,
          status: "fmx_error",
          source: "fmx",
          error,
        });
        await writeJsonGzip(metadataPath, metadata);
        return {
          celex: record.celex,
          status: "fmx_error",
          metadataPath,
          htmlPath: null,
          error: metadata.error,
          shouldStop: false,
        };
      }
    }
  }

  try {
    const fetched = await deps.fetchHtmlLawImpl({
      celex: record.celex,
      lang: options.lang,
      eurlexBase: options.eurlexBase,
      timeoutMs: options.timeoutMs,
      usePlaywright: options.usePlaywright,
      usePlaywrightOnChallenge: options.usePlaywrightOnChallenge,
      playwrightModulePath: options.playwrightModulePath,
      playwrightBrowsersPath: options.playwrightBrowsersPath,
      playwrightHeadless: options.playwrightHeadless,
    });
    const metadata = createMetadataPayload(record, {
      lang: options.lang,
      status: "downloaded",
      source: fetched.source || "eurlex-html",
      fmxUnavailable: true,
      requestedLang: fetched.requestedLang || options.lang,
      servedLang: fetched.servedLang || options.lang,
    });
    await writeJsonGzip(metadataPath, metadata);
    if (fetched.rawHtml) {
      await writeTextGzip(htmlPath, fetched.rawHtml);
    }
    return {
      celex: record.celex,
      status: "downloaded",
      metadataPath,
      htmlPath: fetched.rawHtml ? htmlPath : null,
      shouldStop: false,
    };
  } catch (error) {
    const status = error.code === "eurlex_html_challenged"
      ? "challenged"
      : error.code === "law_not_found"
        ? "law_not_found"
        : "download_error";
    const metadata = createMetadataPayload(record, {
      lang: options.lang,
      status,
      source: "eurlex-html",
      fmxUnavailable: true,
      error,
    });
    await writeJsonGzip(metadataPath, metadata);
      return {
        celex: record.celex,
        status,
        metadataPath,
        htmlPath: null,
        error: metadata.error,
        shouldStop: status === "challenged" && options.stopOnChallenge,
    };
  }
}

async function downloadPrimaryActHtmlFallbacks(rawOptions = {}, rawDeps = {}) {
  try {
  const options = {
    fromYear: Number.parseInt(rawOptions.fromYear || String(new Date().getUTCFullYear()), 10),
    toYear: Number.parseInt(rawOptions.toYear || "1990", 10),
    currentYear: Number.parseInt(rawOptions.currentYear || String(new Date().getUTCFullYear()), 10),
    outputDir: path.resolve(rawOptions.outputDir || DEFAULT_OUTPUT_DIR),
    statePath: path.resolve(rawOptions.statePath || DEFAULT_STATE_PATH),
    lang: String(rawOptions.lang || "ENG").toUpperCase(),
    harvestLimit: ensurePositiveInt(rawOptions.harvestLimit, 200),
    limitPerYear: rawOptions.limitPerYear ? ensurePositiveInt(rawOptions.limitPerYear, 0) : 0,
    delayMs: Math.max(0, Number.parseInt(String(rawOptions.delayMs || "0"), 10) || 0),
    maxAttemptsPerRun: rawOptions.maxAttemptsPerRun ? ensurePositiveInt(rawOptions.maxAttemptsPerRun, 0) : 0,
    timeoutMs: ensurePositiveInt(rawOptions.timeoutMs, 30_000),
    stopOnChallenge: rawOptions.stopOnChallenge !== "false" && rawOptions.stopOnChallenge !== false,
    actTypes: normalizeYearQueryActTypes(
      rawOptions.actTypes
        ? String(rawOptions.actTypes).split(",")
        : ["regulation", "directive"]
    ),
    usePlaywright: rawOptions.usePlaywright === "true" || rawOptions.usePlaywright === true,
    usePlaywrightOnChallenge: rawOptions.usePlaywrightOnChallenge === "true" || rawOptions.usePlaywrightOnChallenge === true,
    playwrightModulePath: rawOptions.playwrightModulePath ? path.resolve(String(rawOptions.playwrightModulePath)) : null,
    playwrightBrowsersPath: rawOptions.playwrightBrowsersPath ? path.resolve(String(rawOptions.playwrightBrowsersPath)) : null,
    playwrightHeadless: rawOptions.playwrightHeadless !== "false" && rawOptions.playwrightHeadless !== false,
    eurlexBase: rawOptions.eurlexBase || "https://eur-lex.europa.eu",
    searchCachePath: path.resolve(rawOptions.searchCachePath || DEFAULT_SEARCH_CACHE_PATH),
  };
  const searchCacheHints = rawDeps.searchCacheHints || await loadSearchCacheHints(options.searchCachePath);

  const deps = {
    fetchHtmlLawImpl: rawDeps.fetchHtmlLawImpl || fetchEurlexHtmlLaw,
    findFmx4UriImpl: rawDeps.findFmx4UriImpl || findFmx4Uri,
    harvestYearPrimaryActsImpl: rawDeps.harvestYearPrimaryActsImpl || ((year) => harvestYearPrimaryActs(year, {
      limit: options.harvestLimit,
      actTypes: options.actTypes,
      runSparqlImpl: rawDeps.runSparqlImpl || runSparql,
    })),
    sleepImpl: rawDeps.sleepImpl || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    logProgressImpl: rawDeps.logProgressImpl || logProgress,
    searchCacheHints,
  };

  const state = (await readJson(options.statePath, null)) || {
    fromYear: options.fromYear,
    toYear: options.toYear,
    lang: options.lang,
    updatedAt: null,
    years: {},
  };
  let attemptsThisRun = 0;

  for (let year = options.fromYear; year >= options.toYear; year -= 1) {
    const existingYearState = state.years[String(year)] || null;
    const existingYearStatus = normalizeYearStateStatus(year, existingYearState?.status, options.currentYear);
    if (existingYearStatus === "complete" || existingYearStatus === "snapshot_complete") {
      continue;
    }

    const yearDir = path.join(options.outputDir, options.lang, String(year));
    const manifestPath = path.join(yearDir, "manifest.json");
    const manifest = normalizeExistingManifest(await readJson(manifestPath, null), year, options.lang);
    deps.logProgressImpl(`Downloading HTML fallbacks for primary acts in ${year}`);

    const harvested = await deps.harvestYearPrimaryActsImpl(year);
    const selected = options.limitPerYear > 0 ? harvested.slice(0, options.limitPerYear) : harvested;
    manifest.counts.harvested = Math.max(manifest.counts.harvested, selected.length);
    touchManifest(manifest);
    let completedForYear = 0;

    for (const record of selected) {
      const existingEntry = await readExistingRecordStatus(record, { ...options, year });
      if (shouldSkipManifestEntry(existingEntry)) {
        completedForYear += 1;
        deps.logProgressImpl(
          `[skip ${completedForYear}/${selected.length}] ${record.celex} existing ${existingEntry.status}`
        );
        continue;
      }

      const result = await processRecord(record, { ...options, year }, deps);
      attemptsThisRun += 1;
      completedForYear += 1;
      manifest.lastCelex = record.celex;
      incrementManifestCount(manifest, result.status);
      if (result.status === "downloaded") {
        deps.logProgressImpl(
          `[ok ${completedForYear}/${selected.length}] ${record.celex} [downloaded] ${record.title || ""}`.trim()
        );
      } else if (result.status === "fmx_available") {
        deps.logProgressImpl(`[ok ${completedForYear}/${selected.length}] ${record.celex} [fmx_available]`);
      } else if (result.status === "challenged") {
        deps.logProgressImpl(
          `[challenge ${completedForYear}/${selected.length}] ${record.celex} ${result.error?.message || ""}`.trim()
        );
      } else if (result.status === "law_not_found") {
        deps.logProgressImpl(`[miss ${completedForYear}/${selected.length}] ${record.celex} law_not_found`);
      } else {
        deps.logProgressImpl(
          `[fail ${completedForYear}/${selected.length}] ${record.celex} ${result.error?.message || result.status}`
        );
      }
      await writeManifest(manifestPath, manifest);

      state.years[String(year)] = {
        status: result.shouldStop ? "challenged" : "in_progress",
        updatedAt: new Date().toISOString(),
        counts: manifest.counts,
        lastCelex: record.celex,
      };
      state.updatedAt = new Date().toISOString();
      await writeState(options.statePath, state);

      if (result.shouldStop) {
        deps.logProgressImpl(`Challenge detected for ${record.celex}; stopping early so the run can be resumed later`);
        return {
          stoppedEarly: true,
          stopReason: "challenge",
          challengeYear: year,
          challengeCelex: record.celex,
          statePath: options.statePath,
          outputDir: options.outputDir,
        };
      }

      if (options.maxAttemptsPerRun > 0 && attemptsThisRun >= options.maxAttemptsPerRun) {
        deps.logProgressImpl(
          `Checkpoint reached after ${attemptsThisRun} attempted records; stopping cleanly at ${record.celex} so the run can be resumed`
        );
        return {
          stoppedEarly: true,
          stopReason: "checkpoint",
          checkpointYear: year,
          checkpointCelex: record.celex,
          attemptsThisRun,
          statePath: options.statePath,
          outputDir: options.outputDir,
        };
      }

      if (options.delayMs > 0) {
        await deps.sleepImpl(options.delayMs);
      }
    }

    state.years[String(year)] = {
      status: year === options.currentYear ? "snapshot_complete" : "complete",
      updatedAt: new Date().toISOString(),
      counts: manifest.counts,
      lastCelex: manifest.lastCelex,
    };
    state.updatedAt = new Date().toISOString();
    await writeState(options.statePath, state);
    await writeManifest(manifestPath, manifest);
    deps.logProgressImpl(
      `[year ${year}] harvested=${manifest.counts.harvested} downloaded=${manifest.counts.downloaded} fmx=${manifest.counts.fmxAvailable} challenged=${manifest.counts.challenged} missing=${manifest.counts.lawNotFound} failed=${manifest.counts.downloadError}`
    );
  }

  return {
    stoppedEarly: false,
    statePath: options.statePath,
    outputDir: options.outputDir,
  };
  } finally {
    await closeSharedPlaywrightBrowser();
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await downloadPrimaryActHtmlFallbacks(options);
  if (result.stoppedEarly) {
    if (result.stopReason === "challenge") {
      console.log(`[download-html-fallbacks] stopped after challenge for ${result.challengeCelex} in ${result.challengeYear}`);
      return;
    }
    if (result.stopReason === "checkpoint") {
      console.log(
        `[download-html-fallbacks] checkpoint after ${result.attemptsThisRun} attempted records at ${result.checkpointCelex} in ${result.checkpointYear}`
      );
      return;
    }
    return;
  }
  console.log(`[download-html-fallbacks] completed into ${result.outputDir}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[download-html-fallbacks] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_STATE_PATH,
  createMetadataPayload,
  createYearManifest,
  downloadPrimaryActHtmlFallbacks,
  harvestYearPrimaryActs,
  loadSearchCacheHints,
  normalizeYearStateStatus,
  processRecord,
  readJsonGzip,
  writeJsonGzip,
  writeTextGzip,
};
