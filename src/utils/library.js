import { LAWS } from "../constants/laws.js";

const IMPORTED_LAWS_STORAGE_KEY = "eurlex_imported_laws";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write failures
  }
}

function normalizeImportedLaw(entry) {
  if (!entry?.celex) return null;

  return {
    id: entry.id || `import:${entry.celex}`,
    kind: "imported",
    celex: entry.celex,
    label: entry.label || entry.raw || `CELEX ${entry.celex}`,
    raw: entry.raw || null,
    eurlex: entry.eurlex || null,
    addedAt: entry.addedAt || Date.now(),
  };
}

export function getImportedLaws() {
  const entries = readJson(IMPORTED_LAWS_STORAGE_KEY, []);
  return entries
    .map(normalizeImportedLaw)
    .filter(Boolean)
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

export function upsertImportedLaw(entry) {
  const normalized = normalizeImportedLaw(entry);
  if (!normalized) return null;

  const existing = getImportedLaws();
  const next = [
    normalized,
    ...existing.filter((item) => item.celex !== normalized.celex),
  ];

  writeJson(IMPORTED_LAWS_STORAGE_KEY, next);
  return normalized;
}

export function getLibraryLaws({ hiddenLaws = [], lastOpened = {} } = {}) {
  const hidden = new Set(hiddenLaws);
  const bundled = LAWS.map((law) => ({
    ...law,
    id: law.key,
    kind: "bundled",
    route: `/law/${law.key}`,
    timestamp: lastOpened[law.key] || lastOpened[`law:${law.key}`] || null,
  }));

  const bundledCelexes = new Set(bundled.map((law) => law.celex).filter(Boolean));

  const imported = getImportedLaws()
    .filter((law) => !bundledCelexes.has(law.celex))
    .map((law) => ({
      ...law,
      route: `/import?celex=${encodeURIComponent(law.celex)}${law.raw ? `&raw=${encodeURIComponent(law.raw)}` : ""}`,
      timestamp: lastOpened[law.id] || lastOpened[law.celex] || null,
    }));

  return [...bundled, ...imported]
    .filter((law) => !hidden.has(law.id) && !hidden.has(law.key) && !hidden.has(law.celex))
    .sort((a, b) => {
      const timeDiff = (b.timestamp || 0) - (a.timestamp || 0);
      if (timeDiff !== 0) return timeDiff;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
}

