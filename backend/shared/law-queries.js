/**
 * Shared SPARQL-based queries for law metadata, amendments, and implementing acts.
 *
 * Used by both the API routes and the CLI to avoid duplicating queries
 * and result-shaping logic.
 */

async function fetchMetadata(celex, runSparqlQuery) {
  const celexUri = `http://publications.europa.eu/resource/celex/${celex}`;
  const query = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT
  ?dateEntryIntoForce ?dateEndOfValidity ?inForce
  ?eli ?dateSignature ?dateDocument ?eea
WHERE {
  ?work owl:sameAs <${celexUri}> .
  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?dateEntryIntoForce }
  OPTIONAL { ?work cdm:resource_legal_date_end-of-validity ?dateEndOfValidity }
  OPTIONAL { ?work cdm:resource_legal_in-force ?inForce }
  OPTIONAL { ?work cdm:resource_legal_eli ?eli }
  OPTIONAL { ?work cdm:resource_legal_date_signature ?dateSignature }
  OPTIONAL { ?work cdm:work_date_document ?dateDocument }
  OPTIONAL { ?work cdm:resource_legal_eea ?eea }
}
LIMIT 10`;

  const data = await runSparqlQuery(query);
  const bindings = data.results?.bindings || [];
  const entryDates = [...new Set(bindings.map((b) => b.dateEntryIntoForce?.value).filter(Boolean))].sort();
  const first = bindings[0] || {};

  return {
    celex,
    entryIntoForce: entryDates,
    endOfValidity: first.dateEndOfValidity?.value || null,
    inForce: first.inForce?.value === 'true',
    eli: first.eli?.value || null,
    dateSignature: first.dateSignature?.value || null,
    dateDocument: first.dateDocument?.value || null,
    eea: first.eea?.value === 'true',
  };
}

async function fetchAmendments(celex, runSparqlQuery) {
  const celexUri = `http://publications.europa.eu/resource/celex/${celex}`;
  const query = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?type ?sourceCelex ?date WHERE {
  ?work owl:sameAs <${celexUri}> .
  ?ax owl:annotatedTarget ?work ;
      owl:annotatedProperty ?p ;
      owl:annotatedSource ?sourceWork .
  FILTER(?p IN (cdm:resource_legal_amends_resource_legal, cdm:resource_legal_corrects_resource_legal))
  BIND(IF(?p = cdm:resource_legal_corrects_resource_legal, "corrigendum", "amendment") AS ?type)
  ?sourceWork owl:sameAs ?sourceCelex .
  FILTER(STRSTARTS(STR(?sourceCelex), "http://publications.europa.eu/resource/celex/"))
  OPTIONAL { ?sourceWork cdm:work_date_document ?date }
}
ORDER BY ?date
LIMIT 50`;

  const data = await runSparqlQuery(query);
  const amendments = (data.results?.bindings || []).map((b) => {
    const raw = b.sourceCelex?.value?.split('/').pop() || null;
    return {
      celex: raw ? decodeURIComponent(raw) : null,
      date: b.date?.value || null,
      type: b.type?.value || 'amendment',
    };
  }).filter((a) => a.celex);

  return { celex, amendments };
}

async function fetchImplementing(celex, runSparqlQuery) {
  const celexUri = `http://publications.europa.eu/resource/celex/${celex}`;
  const query = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?actCelex ?date ?title WHERE {
  ?work owl:sameAs <${celexUri}> .
  ?ax owl:annotatedTarget ?work ;
      owl:annotatedProperty cdm:resource_legal_based_on_resource_legal ;
      owl:annotatedSource ?actWork .
  ?actWork owl:sameAs ?actCelex .
  FILTER(STRSTARTS(STR(?actCelex), "http://publications.europa.eu/resource/celex/"))
  OPTIONAL { ?actWork cdm:work_date_document ?date }
  OPTIONAL {
    ?actWork cdm:resource_legal_title ?titleExpr .
    FILTER(LANG(?titleExpr) = "en")
    BIND(STR(?titleExpr) AS ?title)
  }
}
ORDER BY ?date
LIMIT 100`;

  const data = await runSparqlQuery(query);
  const acts = (data.results?.bindings || []).map((b) => {
    const raw = b.actCelex?.value?.split('/').pop() || null;
    return {
      celex: raw ? decodeURIComponent(raw) : null,
      date: b.date?.value || null,
      title: b.title?.value || null,
    };
  }).filter((a) => a.celex);

  return { celex, acts };
}

async function fetchCaseLaw(celex, runSparqlQuery) {
  const celexUri = `http://publications.europa.eu/resource/celex/${celex}`;
  const query = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?caseCelex ?ecli ?date WHERE {
  ?caseWork cdm:case-law_interpretes_resource_legal ?law .
  ?law owl:sameAs <${celexUri}> .
  ?caseWork cdm:resource_legal_id_celex ?caseCelex .
  FILTER(REGEX(?caseCelex, "^6[0-9]{4}CJ"))
  OPTIONAL { ?caseWork cdm:case-law_ecli ?ecli }
  OPTIONAL { ?caseWork cdm:work_date_document ?date }
}
ORDER BY ?date
LIMIT 200`;

  const data = await runSparqlQuery(query);
  const cases = (data.results?.bindings || []).map((b) => {
    const caseCelex = b.caseCelex?.value || null;
    let caseNumber = caseCelex;
    const m = caseCelex?.match(/^6(\d{4})CJ(\d{4})$/);
    if (m) {
      caseNumber = `C-${parseInt(m[2], 10)}/${m[1].slice(2)}`;
    }
    return {
      celex: caseCelex,
      caseNumber,
      ecli: b.ecli?.value || null,
      date: b.date?.value || null,
      name: null,
    };
  }).filter((c) => c.celex);

  // Enrich with party names extracted from EUR-Lex HTML (first ~5 KB only).
  // Run in parallel with limited concurrency to avoid overwhelming EUR-Lex.
  await enrichWithPartyNames(cases);

  return { celex, cases };
}

/**
 * Fetch the first party name from each judgment's EUR-Lex HTML.
 * Uses HTTP Range requests (first 5 KB) so it's lightweight.
 */
async function enrichWithPartyNames(cases, concurrency = 6) {
  let i = 0;
  async function next() {
    while (i < cases.length) {
      const c = cases[i++];
      try {
        c.name = await fetchPartyName(c.celex);
      } catch {
        // leave name as null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, next));
}

async function fetchPartyName(caseCelex) {
  const url = `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${caseCelex}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-5000' },
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 206) return null;

    const html = await res.text();
    // First <span class="bold"> or <span class="coj-bold"> after "In Case" is the first party
    const match = html.match(/<span class="(?:coj-)?bold">([^<]+)<\/span>/);
    if (!match) return null;

    // Decode HTML entities and clean up trailing punctuation
    let name = match[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/[,;]+$/, '').trim();

    // Shorten overly long names (e.g. "Bundesverband der Verbraucherzentralen...")
    if (name.length > 60) {
      const dash = name.indexOf(' — ');
      if (dash > 0 && dash < 60) name = name.substring(0, dash);
      else name = name.substring(0, 57) + '…';
    }

    return name || null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchMetadata, fetchAmendments, fetchImplementing, fetchCaseLaw };
