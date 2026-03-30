/**
 * Shared SPARQL-based queries for law metadata, amendments, and implementing acts.
 *
 * Used by both the API routes and the CLI to avoid duplicating queries
 * and result-shaping logic.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

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

async function fetchCaseLaw(celex, runSparqlQuery, { cacheDir } = {}) {
  const cache = cacheDir ? loadCaseLawCache(cacheDir) : {};
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
    const cached = cache[caseCelex];
    return {
      celex: caseCelex,
      caseNumber,
      ecli: b.ecli?.value || null,
      date: b.date?.value || null,
      name: cached?.name || null,
      declarations: cached?.declarations || [],
      articlesCited: cached?.articlesCited || [],
    };
  }).filter((c) => c.celex);

  // Enrich uncached cases with full details (name + decisions + articles)
  const uncached = cases.filter((c) => !cache[c.celex]);
  if (uncached.length > 0) {
    try {
      await enrichWithCaseDetails(uncached, cache);
      if (cacheDir) saveCaseLawCache(cacheDir, cache);
    } catch (err) {
      console.warn(`[case-law] Details enrichment failed for ${celex}: ${err.message}`);
    }
  }

  return { celex, cases };
}

// ---------------------------------------------------------------------------
// Case law cache: { caseCelex: { name, declarations, articlesCited } }
// ---------------------------------------------------------------------------

const CASE_LAW_CACHE_FILE = 'case-law-cache-v3.json';

function loadCaseLawCache(cacheDir) {
  try {
    const filePath = path.join(cacheDir, CASE_LAW_CACHE_FILE);
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveCaseLawCache(cacheDir, cache) {
  try {
    const filePath = path.join(cacheDir, CASE_LAW_CACHE_FILE);
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // best-effort
  }
}

function isChallengeResponse(res) {
  return res.status === 202
    && String(res.headers.get('x-amzn-waf-action') || '').toLowerCase() === 'challenge';
}

function cleanText(text) {
  return text.replace(/[\s\n\t]+/g, ' ').trim();
}

/**
 * Extract the operative part (ruling) from a CJEU judgment DOM.
 */
function extractOperativePart(document) {
  const body = document.body;
  if (!body) return { declarations: [] };

  const allParagraphs = body.querySelectorAll('p.coj-normal');
  let operativeStartIdx = -1;

  for (let i = 0; i < allParagraphs.length; i++) {
    const text = allParagraphs[i].textContent.trim();
    if (text.match(/^On\s+those\s+grounds/i) && text.match(/hereby\s+(rules|declares|orders)/i)) {
      operativeStartIdx = i;
      break;
    }
  }

  if (operativeStartIdx === -1) {
    return extractOperativePartFromText(body.textContent || '');
  }

  const declarations = [];
  let currentNumber = 0;
  let currentText = '';

  const operativeP = allParagraphs[operativeStartIdx];
  let node = operativeP.closest('table') || operativeP.closest('tr') || operativeP;
  node = node.nextElementSibling || node.parentElement?.nextElementSibling;

  while (node) {
    if (node.querySelector?.('.coj-signaturecase') || node.classList?.contains('coj-signaturecase')) break;
    if (node.tagName === 'HR' && node.classList?.contains('coj-note')) break;

    const countEl = node.querySelector?.('.coj-count.coj-bold, .coj-count .coj-bold');
    if (countEl) {
      const numMatch = countEl.textContent.match(/(\d+)\./);
      if (numMatch) {
        if (currentNumber > 0 && currentText.trim()) {
          declarations.push({ number: currentNumber, text: currentText.trim() });
        }
        currentNumber = parseInt(numMatch[1], 10);
        const textCell = countEl.closest('tr')?.querySelector('td:last-child');
        currentText = textCell ? cleanText(textCell.textContent) : '';
        node = node.nextElementSibling;
        continue;
      }
    }

    if (currentNumber > 0) {
      const normalP = node.querySelector?.('p.coj-normal');
      if (normalP) {
        const additionalText = cleanText(normalP.textContent);
        if (additionalText && !additionalText.match(/^Delivered in open court/i)) {
          currentText += ' ' + additionalText;
        }
      }
    }

    node = node.nextElementSibling;
  }

  if (currentNumber > 0 && currentText.trim()) {
    declarations.push({ number: currentNumber, text: currentText.trim() });
  }

  if (declarations.length === 0) {
    return extractOperativePartFromText(body.textContent || '');
  }

  return { declarations };
}

function extractOperativePartFromText(fullText) {
  const operativePatterns = [
    /On\s+those\s+grounds\s*,?\s*(?:the\s+Court\s*\([^)]*\)\s*hereby\s+(?:rules|declares|orders)\s*:?)/i,
    /On\s+those\s+grounds\s*,?\s*THE\s+COURT\s*(?:\([^)]*\))?\s*(?:hereby\s+)?(?:rules|declares|orders)\s*:?/i,
  ];

  let operativeStart = -1;
  for (const pattern of operativePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      operativeStart = match.index + match[0].length;
      break;
    }
  }

  if (operativeStart === -1) return { declarations: [] };

  let rawOperative = fullText.substring(operativeStart).trim();

  const cutoffs = [/Delivered\s+in\s+open\s+court/i, /Language\s+of\s+the\s+case/i];
  for (const pattern of cutoffs) {
    const match = rawOperative.match(pattern);
    if (match) rawOperative = rawOperative.substring(0, match.index).trim();
  }

  const declarations = [];
  const numberedPattern = /(?:^|\s)(\d+)\.\s+/g;
  const matches = [...rawOperative.matchAll(numberedPattern)];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : rawOperative.length;
      const text = cleanText(rawOperative.substring(start, end));
      if (text) declarations.push({ number: parseInt(matches[i][1], 10), text });
    }
  } else {
    const text = cleanText(rawOperative);
    if (text) declarations.push({ number: 1, text });
  }

  return { declarations };
}

/**
 * Extract article citations from judgment text.
 * Returns compact strings like "Art. 6 GDPR", "Art. 47 Charter".
 */
function extractArticleCitations(document) {
  const text = cleanText(document.body?.textContent || '');
  const citations = [];
  const seen = new Set();

  const articlePatterns = [
    /Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?\s+of\s+(?:Regulation|Directive|Decision)\s+\(?(?:EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?\d{2,4}\/\d+/gi,
    /Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?\s+of\s+(?:Regulation|Directive|Decision)\s+\d{2,4}\/\d+/gi,
    /Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?\s+of\s+(?:the\s+)?(?:GDPR|Charter|TFEU|TEU|ECHR)/gi,
    /Articles\s+[\d,\s]+(?:and\s+\d+)?\s+of\s+(?:Regulation|Directive|Decision)\s+\(?(?:EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?\d{2,4}\/\d+/gi,
    /Articles\s+[\d,\s]+(?:and\s+\d+)?\s+of\s+(?:the\s+)?(?:GDPR|Charter|TFEU|TEU|ECHR)/gi,
    /Article\s+\d+(?:\(\d+\))?\s+(?:TFEU|TEU|ECHR)/gi,
  ];

  for (const pattern of articlePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const key = match[0].toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) {
        seen.add(key);
        citations.push(formatArticlePill(match[0].trim()));
      }
    }
  }

  return citations;
}

/**
 * Convert a full citation like "Article 6(1) of Regulation (EU) 2016/679"
 * into a compact pill label like "Art. 6(1) GDPR".
 */
function formatArticlePill(citation) {
  let label = citation.replace(/^Articles?\s+/i, 'Art. ');

  const shortNames = [
    { pattern: /\s+of\s+(?:the\s+)?GDPR/i, short: ' GDPR' },
    { pattern: /\s+of\s+(?:the\s+)?Charter/i, short: ' Charter' },
    { pattern: /\s+of\s+(?:the\s+)?TFEU/i, short: ' TFEU' },
    { pattern: /\s+of\s+(?:the\s+)?TEU/i, short: ' TEU' },
    { pattern: /\s+of\s+(?:the\s+)?ECHR/i, short: ' ECHR' },
    { pattern: /\s+of\s+(?:Regulation|Directive|Decision)\s+\(?(?:EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?2016\/679/i, short: ' GDPR' },
    { pattern: /\s+of\s+(?:Regulation|Directive|Decision)\s+\(?(?:EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?(\d{2,4}\/\d+)/i, short: null },
  ];

  for (const { pattern, short } of shortNames) {
    const m = label.match(pattern);
    if (m) {
      if (short) {
        label = label.substring(0, m.index) + short;
      } else {
        label = label.substring(0, m.index) + ' ' + m[1];
      }
      break;
    }
  }

  return label;
}

/**
 * Fetch full HTML for a case and extract decision + article citations.
 */
async function fetchCaseDetails(caseCelex) {
  const url = `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${caseCelex}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (isChallengeResponse(res)) {
        clearTimeout(timeout);
        const delay = 2000 * (2 ** attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) return null;

      const html = await res.text();
      if (!html || html.length < 200) return null;

      const dom = new JSDOM(html);
      const doc = dom.window.document;

      const operative = extractOperativePart(doc);
      const articlesCited = extractArticleCitations(doc);

      // Also extract party name from the full HTML (more reliable than Range request)
      const boldPattern = /<span class="(?:coj-)?bold">([^<]+)<\/span>/g;
      const boldMatches = [...html.matchAll(boldPattern)];
      let name = null;
      if (boldMatches.length > 0) {
        const cleanBold = (raw) => raw
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
          .replace(/[,;]+$/, '').trim();
        const first = cleanBold(boldMatches[0][1]);
        if (first && boldMatches.length >= 2) {
          const second = cleanBold(boldMatches[1][1]);
          name = second ? `${first} v ${second}` : first;
        } else {
          name = first || null;
        }
      }

      return {
        name,
        declarations: operative.declarations,
        articlesCited,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

/**
 * Enrich cases with full details (decisions + articles). Lower concurrency
 * than party-name enrichment since we fetch full pages.
 */
async function enrichWithCaseDetails(cases, detailsCache, concurrency = 3) {
  let consecutiveFails = 0;
  let blocked = false;
  let i = 0;

  async function next() {
    while (i < cases.length && !blocked) {
      const c = cases[i++];
      try {
        const details = await fetchCaseDetails(c.celex);
        if (details) {
          detailsCache[c.celex] = details;
          c.declarations = details.declarations;
          c.articlesCited = details.articlesCited;
          if (details.name && !c.name) c.name = details.name;
        }
        consecutiveFails = 0;
      } catch (err) {
        consecutiveFails++;
        if (consecutiveFails >= 5) {
          blocked = true;
          console.warn(`[case-law] Stopping details enrichment after ${consecutiveFails} consecutive failures: ${err.message}`);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, next));
}

module.exports = { fetchMetadata, fetchAmendments, fetchImplementing, fetchCaseLaw };
