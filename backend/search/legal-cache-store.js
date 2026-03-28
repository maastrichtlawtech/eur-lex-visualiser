const fs = require("fs");
const path = require("path");

const { enrichSearchRecord, scoreLaw } = require("./search-ranking");

const DEFAULT_SEARCH_CACHE_PATH = process.env.SEARCH_CACHE_PATH ||
  path.join(__dirname, "data", "search-cache.json");

function normalizeCelexLookupKey(celex) {
  const normalized = String(celex || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeEliLookupKey(eli) {
  const normalized = String(eli || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/^https:/i, "http:")
    .toLowerCase();
  return normalized || null;
}

function normalizeReferenceNumber(value) {
  if (value == null) return null;
  const digits = String(value).trim();
  if (!/^\d+$/.test(digits)) return null;
  return String(Number.parseInt(digits, 10));
}

function normalizeOfficialReferenceLookupKey(reference) {
  const actType = String(reference?.actType || "").trim().toLowerCase();
  const year = String(reference?.year || "").trim();
  const number = normalizeReferenceNumber(reference?.number);

  if (!actType || !year || !number) return null;
  return `${actType}|${year}|${number}`;
}

function buildCanonicalEliFromReference(reference) {
  const actType = String(reference?.actType || "").trim().toLowerCase();
  const year = String(reference?.year || "").trim();
  const number = normalizeReferenceNumber(reference?.number);
  const segmentByType = {
    regulation: "reg",
    directive: "dir",
    decision: "dec",
  };
  const segment = segmentByType[actType];

  if (!segment || !year || !number) return null;
  return `http://data.europa.eu/eli/${segment}/${year}/${number}/oj`;
}

function getDeterministicMatch(index, key) {
  if (!key) return null;
  const matches = index.get(key) || [];
  return matches.length === 1 ? matches[0] : null;
}

class JsonLegalCacheStore {
  constructor(cachePath = DEFAULT_SEARCH_CACHE_PATH) {
    this.cachePath = cachePath;
    this.payload = null;
    this.records = [];
    this.loadedAt = null;
    this.loadError = null;
    this.byCelex = new Map();
    this.byEli = new Map();
    this.byOfficialReference = new Map();
  }

  load() {
    try {
      if (!fs.existsSync(this.cachePath)) {
        this.payload = null;
        this.records = [];
        this.loadedAt = null;
        this.loadError = `Search cache not found at ${this.cachePath}`;
        this.byCelex = new Map();
        this.byEli = new Map();
        this.byOfficialReference = new Map();
        return false;
      }

      const raw = fs.readFileSync(this.cachePath, "utf8");
      const parsed = JSON.parse(raw);
      const records = Array.isArray(parsed.records)
        ? parsed.records
          .map((record) => enrichSearchRecord(record))
          .filter((record) => record.isPrimaryAct)
        : [];

      this.payload = parsed;
      this.records = records;
      this.byCelex = new Map();
      this.byEli = new Map();
      this.byOfficialReference = new Map();

      for (const record of records) {
        const celexKey = normalizeCelexLookupKey(record.celex);
        if (celexKey) {
          this.byCelex.set(celexKey, [record]);
        }

        const eliKey = normalizeEliLookupKey(record.eli);
        if (eliKey) {
          const matches = this.byEli.get(eliKey) || [];
          matches.push(record);
          this.byEli.set(eliKey, matches);
        }

        const referenceKey = normalizeOfficialReferenceLookupKey({
          actType: record.type,
          year: record.celexYear,
          number: record.celexNumber,
        });
        if (referenceKey) {
          const matches = this.byOfficialReference.get(referenceKey) || [];
          matches.push(record);
          this.byOfficialReference.set(referenceKey, matches);
        }
      }

      this.loadedAt = new Date().toISOString();
      this.loadError = null;
      return true;
    } catch (error) {
      this.payload = null;
      this.records = [];
      this.loadedAt = null;
      this.loadError = error.message;
      this.byCelex = new Map();
      this.byEli = new Map();
      this.byOfficialReference = new Map();
      return false;
    }
  }

  loadFromDisk() {
    return this.load();
  }

  isReady() {
    return this.records.length > 0;
  }

  getStatus() {
    return {
      ready: this.isReady(),
      cachePath: this.cachePath,
      loadedAt: this.loadedAt,
      count: this.records.length,
      error: this.loadError,
    };
  }

  searchLaws(query, options = {}) {
    if (!this.isReady()) {
      const error = new Error(this.loadError || "Law search cache is not loaded");
      error.code = "search_cache_unavailable";
      throw error;
    }

    const limit = Math.max(1, Math.min(Number.parseInt(options.limit || "10", 10) || 10, 50));
    const disableRewrites = Boolean(options.disableRewrites);

    return this.records
      .map((law) => {
        const { score, matchReason } = scoreLaw(law, query, { disableRewrites });
        return { law, score, matchReason };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.law.date || "").localeCompare(String(a.law.date || ""));
      })
      .slice(0, limit)
      .map((entry) => ({
        celex: entry.law.celex,
        title: entry.law.title,
        type: entry.law.type,
        date: entry.law.date || null,
        eli: entry.law.eli || null,
        fmxAvailable: Boolean(entry.law.fmxAvailable),
        matchReason: entry.matchReason,
      }));
  }

  getByCelex(celex) {
    return getDeterministicMatch(this.byCelex, normalizeCelexLookupKey(celex));
  }

  getByEli(eli) {
    return getDeterministicMatch(this.byEli, normalizeEliLookupKey(eli));
  }

  getByOfficialReference(reference) {
    return getDeterministicMatch(this.byOfficialReference, normalizeOfficialReferenceLookupKey(reference));
  }
}

module.exports = {
  buildCanonicalEliFromReference,
  DEFAULT_SEARCH_CACHE_PATH,
  JsonLegalCacheStore,
  normalizeCelexLookupKey,
  normalizeEliLookupKey,
  normalizeOfficialReferenceLookupKey,
};
