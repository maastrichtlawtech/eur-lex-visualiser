import { parseOfficialReference } from "./officialReferences.js";
import { getCanonicalLawRoute, buildImportedLawCandidate, getBundledLaws } from "./lawRouting.js";
import { buildEurlexCelexUrl } from "./url.js";
import { getAllLawMeta, listCachedCelexes, upsertLawMeta } from "./formexApi.js";

function normalizeOfficialReference(reference) {
  if (!reference) return null;

  const actType = String(reference.actType || "").trim().toLowerCase();
  const year = String(reference.year || "").trim();
  const number = String(reference.number || "").trim();

  if (!actType || !year || !number) return null;
  return { actType, year, number };
}

function sameOfficialReference(left, right) {
  const normalizedLeft = normalizeOfficialReference(left);
  const normalizedRight = normalizeOfficialReference(right);
  if (!normalizedLeft || !normalizedRight) return false;

  return (
    normalizedLeft.actType === normalizedRight.actType &&
    normalizedLeft.year === normalizedRight.year &&
    normalizedLeft.number === normalizedRight.number
  );
}

function dispatchLibraryUpdate() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("legalviz-library-updated"));
  } catch {
    // ignore
  }
}

function normalizeLawMetaEntry(entry) {
  if (!entry?.celex) return null;

  const parsedReference = entry.officialReference
    || parseOfficialReference(entry.raw || "")
    || parseOfficialReference(entry.label || "");
  const routeCandidate = buildImportedLawCandidate({
    ...entry,
    officialReference: parsedReference,
  });

  return {
    celex: entry.celex,
    label: entry.label || entry.raw || `CELEX ${entry.celex}`,
    raw: entry.raw || null,
    officialReference: routeCandidate?.officialReference || null,
    slug: routeCandidate?.slug || null,
    eurlex: entry.eurlex || null,
    addedAt: entry.addedAt || Date.now(),
  };
}

function inferOfficialReferenceFromCelex(celex) {
  const match = String(celex || "").match(/^3(\d{4})([RLD])(\d{4})$/);
  if (!match) return null;

  const actTypeMap = {
    R: "regulation",
    L: "directive",
    D: "decision",
  };

  const actType = actTypeMap[match[2]] || null;
  if (!actType) return null;

  return {
    actType,
    year: match[1],
    number: String(Number(match[3])),
  };
}

function getFallbackLabel(celex, officialReference) {
  if (officialReference?.actType && officialReference?.year && officialReference?.number) {
    const actTypeLabel = officialReference.actType.charAt(0).toUpperCase() + officialReference.actType.slice(1);
    return `${actTypeLabel} ${officialReference.year}/${officialReference.number}`;
  }
  return `CELEX ${celex}`;
}

export async function saveLawMeta(entry) {
  if (!entry?.celex) return null;

  const normalized = normalizeLawMetaEntry(entry);
  if (!normalized) return null;

  const saved = await upsertLawMeta(normalized.celex, {
    label: normalized.label,
    raw: normalized.raw,
    officialReference: normalized.officialReference,
    eurlex: normalized.eurlex || buildEurlexCelexUrl(normalized.celex),
    addedAt: normalized.addedAt || Date.now(),
  });
  dispatchLibraryUpdate();
  return saved;
}

export async function markLawOpened(celex) {
  if (!celex) return null;
  const saved = await upsertLawMeta(celex, {
    lastOpened: Date.now(),
  });
  dispatchLibraryUpdate();
  return saved;
}

export async function getLibraryLaws() {
  const metaEntries = await getAllLawMeta();
  const metaByCelex = new Map(metaEntries.filter((entry) => entry?.celex).map((entry) => [entry.celex, entry]));
  const cachedCelexes = await listCachedCelexes();
  const bundledLaws = getBundledLaws();
  const knownCelexes = Array.from(new Set([
    ...bundledLaws.map((law) => law.celex).filter(Boolean),
    ...metaByCelex.keys(),
    ...cachedCelexes,
  ]));

  const cached = knownCelexes.map((celex) => {
    const bundled = bundledLaws.find((law) => law.celex === celex) || null;
    const meta = metaByCelex.get(celex);
    const officialReference = meta?.officialReference || bundled?.officialReference || inferOfficialReferenceFromCelex(celex);
    const candidate = buildImportedLawCandidate({
      ...bundled,
      celex,
      officialReference,
    });

    return {
      ...candidate,
      id: bundled?.key || `import:${celex}`,
      key: bundled?.key || null,
      kind: bundled ? "bundled" : "imported",
      celex,
      label: meta?.label || bundled?.label || meta?.raw || getFallbackLabel(celex, officialReference),
      raw: meta?.raw || null,
      officialReference: candidate?.officialReference || officialReference || null,
      slug: candidate?.slug || null,
      eurlex: meta?.eurlex || buildEurlexCelexUrl(celex),
      addedAt: meta?.addedAt || 0,
      timestamp: meta?.lastOpened || null,
      route: getCanonicalLawRoute(candidate),
    };
  });

  return cached
    .sort((a, b) => {
      const timeDiff = (b.timestamp || 0) - (a.timestamp || 0);
      if (timeDiff !== 0) return timeDiff;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
}

export async function findStoredLawMetaByOfficialReference(reference) {
  const target = normalizeOfficialReference(reference);
  if (!target) return null;

  const metaEntries = await getAllLawMeta();
  return metaEntries.find((entry) => {
    if (!entry?.celex) return false;
    const entryReference = entry.officialReference
      || parseOfficialReference(entry.raw || "")
      || parseOfficialReference(entry.label || "");
    return sameOfficialReference(entryReference, target);
  }) || null;
}

export async function findCachedCelexByOfficialReference(reference) {
  return (await findStoredLawMetaByOfficialReference(reference))?.celex || null;
}
