#!/usr/bin/env node
/**
 * Read-only reconnaissance for GDPR amendment tracking.
 *
 * Goals (no code generated, just findings printed):
 *   1. List consolidated versions of GDPR (32016R0679) via Cellar SPARQL + RDF.
 *   2. Locate an FMX URL for one of them and download it.
 *   3. Report the top-level structure: root element, presence of recitals,
 *      article count, schema hints (ACT vs CONS.ACT).
 *
 * Usage:
 *   node scripts/recon-consolidated-gdpr.mjs
 */

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
const CELLAR_BASE = "https://publications.europa.eu/resource";
const BASE_CELEX = "32016R0679";
const UA = "LegalViz Recon/0.1 (+https://legalviz.eu)";
const LANG = "ENG";

async function runSparql(query) {
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "application/sparql-results+json");
  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": UA,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SPARQL HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

async function getText(url, headers = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    redirect: "follow",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 100)}`);
  }
  return response.text();
}

function extractUris(rdf) {
  return [...rdf.matchAll(/rdf:resource="([^"]+)"/g)].map((m) => m[1]);
}

async function listConsolidationsViaSparql() {
  const queries = [
    {
      label: "resource_legal_id_celex STRSTARTS '02016R0679-'",
      q: `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STRSTARTS(STR(?celex), "02016R0679-"))
  OPTIONAL { ?work cdm:work_date_document ?date }
}
ORDER BY ?celex
LIMIT 100`,
    },
    {
      label: "owl:sameAs uri STRSTARTS cellar/celex/02016R0679-",
      q: `PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celexUri ?date WHERE {
  ?work owl:sameAs ?celexUri .
  FILTER(STRSTARTS(STR(?celexUri), "http://publications.europa.eu/resource/celex/02016R0679-"))
  OPTIONAL { ?work cdm:work_date_document ?date }
}
ORDER BY ?celexUri
LIMIT 100`,
    },
    {
      label: "cdm:work_consolidates_work_act -> base",
      q: `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?celexUri ?date WHERE {
  ?base owl:sameAs <${CELLAR_BASE}/celex/${BASE_CELEX}> .
  ?cons cdm:work_consolidates_work_act ?base ;
        owl:sameAs ?celexUri .
  FILTER(STRSTARTS(STR(?celexUri), "${CELLAR_BASE}/celex/"))
  OPTIONAL { ?cons cdm:work_date_document ?date }
}
ORDER BY ?date
LIMIT 100`,
    },
  ];

  for (const { label, q } of queries) {
    try {
      const data = await runSparql(q);
      const rows = (data.results?.bindings || []).map((b) => {
        const raw = b.celex?.value || b.celexUri?.value?.split("/").pop() || null;
        return { celex: raw ? decodeURIComponent(raw) : null, date: b.date?.value || null };
      }).filter((r) => r.celex);
      console.log(`\n[SPARQL: ${label}] -> ${rows.length} rows`);
      for (const row of rows.slice(0, 20)) {
        console.log(`  ${row.celex}${row.date ? "  " + row.date : ""}`);
      }
      if (rows.length > 20) console.log(`  ... (+${rows.length - 20} more)`);
      if (rows.length > 0) return rows;
    } catch (err) {
      console.log(`[SPARQL: ${label}] error: ${err.message}`);
    }
  }
  return [];
}

async function probeCelexDirect(celex) {
  console.log(`\n[Direct] Trying ${CELLAR_BASE}/celex/${celex}`);
  try {
    const rdf = await getText(`${CELLAR_BASE}/celex/${celex}`, {
      Accept: "application/rdf+xml",
      "Accept-Language": "eng",
    });
    const uris = extractUris(rdf);
    console.log(`  RDF ${rdf.length} bytes, ${uris.length} URIs`);
    const fmx4 = uris.filter((u) => /\.fmx4$/.test(u));
    console.log(`  fmx4 manifests visible: ${fmx4.length}`);
    const xmlDirect = uris.filter((u) => u.match(/\.fmx\.xml$/) || u.match(/\.doc\.xml$/));
    console.log(`  direct xml URIs: ${xmlDirect.length}`);
    const zips = uris.filter((u) => u.endsWith(".zip"));
    console.log(`  zips: ${zips.length}`);

    const withCelex = uris.filter((u) => u.includes("/celex/"));
    const distinctCelexTargets = [...new Set(withCelex.map((u) => u.match(/\/celex\/([^/?#]+)/)?.[1]).filter(Boolean))];
    console.log(`  distinct celex references in RDF: ${distinctCelexTargets.length}`);
    for (const c of distinctCelexTargets.slice(0, 10)) console.log(`    ${c}`);
    if (distinctCelexTargets.length > 10) console.log(`    ... (+${distinctCelexTargets.length - 10} more)`);
    return { fmx4, xmlDirect, zips, uris };
  } catch (err) {
    console.log(`  error: ${err.message}`);
    return null;
  }
}

async function downloadSampleAndReport(xmlUri) {
  console.log(`  fetching sample XML: ${xmlUri}`);
  try {
    const text = await getText(xmlUri);
    reportShape(text);
    return text;
  } catch (err) {
    console.log(`  fetch error: ${err.message}`);
    return null;
  }
}

function reportShape(xml) {
  const size = xml.length;
  const preview = xml.slice(0, 400).replace(/\n/g, " ");
  const rootMatch = xml.match(/<([A-Z][A-Z0-9.]*)[\s>]/);
  const root = rootMatch ? rootMatch[1] : "(unknown)";
  const hasConsAct = /<CONS\.ACT[\s>]/.test(xml);
  const hasAct = /<ACT[\s>]/.test(xml);
  const hasEnacting = /<ENACTING\.TERMS[\s>]/.test(xml);
  const hasGrConsid = /<GR\.CONSID[\s>]/.test(xml);
  const recitalCount = (xml.match(/<CONSID[\s>]/g) || []).length;
  const articleCount = (xml.match(/<ARTICLE[\s>]/g) || []).length;
  const preamble = /<PREAMBLE[\s>]/.test(xml);

  console.log(`  -- Shape --`);
  console.log(`    size: ${(size / 1024).toFixed(1)} KB`);
  console.log(`    root element: <${root}>`);
  console.log(`    has <CONS.ACT>: ${hasConsAct}`);
  console.log(`    has <ACT>: ${hasAct}`);
  console.log(`    has <PREAMBLE>: ${preamble}`);
  console.log(`    has <ENACTING.TERMS>: ${hasEnacting}`);
  console.log(`    has <GR.CONSID>: ${hasGrConsid}`);
  console.log(`    <CONSID> count (recitals): ${recitalCount}`);
  console.log(`    <ARTICLE> count: ${articleCount}`);
  console.log(`    existing isFmxDocument() would accept? ${xml.includes("<ACT") && xml.includes("formex") && xml.includes("<ENACTING.TERMS")}`);
  console.log(`    preview: ${preview.slice(0, 250)}...`);
}

async function probeFullFetch(celex) {
  console.log(`\n[Probe] ${celex}`);
  const direct = await probeCelexDirect(celex);
  if (!direct) return;
  const manifest = direct.fmx4.find((u) => u.includes(`.${LANG}.fmx4`)) || direct.fmx4[0];
  if (!manifest) {
    console.log(`  no fmx4 manifest — cannot proceed`);
    return;
  }
  console.log(`  using manifest: ${manifest}`);
  let manifestRdf;
  try {
    manifestRdf = await getText(manifest, { Accept: "application/rdf+xml" });
  } catch (err) {
    console.log(`  manifest fetch error: ${err.message}`);
    return;
  }
  const uris = extractUris(manifestRdf);
  const zip = uris.find((u) => u.endsWith(".zip"));
  const xmls = uris.filter((u) => u.match(/\.fmx4\.[^/]+\.xml$/) && !u.endsWith(".doc.xml"));
  const docXmls = uris.filter((u) => u.endsWith(".doc.xml"));
  console.log(`  downloads: zip=${zip ? "yes" : "no"}, xmls=${xmls.length}, docXmls=${docXmls.length}`);

  if (zip) {
    console.log(`  ZIP: ${zip}`);
    console.log(`  (skipping ZIP extraction in recon)`);
    return;
  }
  const xmlUri = xmls[0] || docXmls[0];
  if (!xmlUri) {
    console.log(`  no direct xml URI found`);
    return;
  }
  await downloadSampleAndReport(xmlUri);
}

async function main() {
  console.log(`=== Recon: consolidated versions of GDPR (${BASE_CELEX}) ===`);

  const sparqlRows = await listConsolidationsViaSparql();

  const knownGuesses = ["02016R0679-20160504", "02016R0679-20180525"];
  const combined = new Map();
  for (const row of sparqlRows) {
    if (row.celex) combined.set(row.celex, row.date);
  }
  for (const guess of knownGuesses) {
    if (!combined.has(guess)) combined.set(guess, null);
  }

  console.log(`\nCandidates to probe (SPARQL + educated guesses):`);
  for (const [c, d] of combined) console.log(`  ${c}${d ? "  " + d : ""}`);

  for (const celex of combined.keys()) {
    await probeFullFetch(celex);
  }

  console.log(`\nProbing BASE act for comparison: ${BASE_CELEX}`);
  await probeFullFetch(BASE_CELEX);

  console.log(`\n=== Done ===`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
