/**
 * ECJ Decision Extractor MVP
 *
 * Fetches ECJ (CJEU) judgments from EUR-Lex and extracts:
 * - Case metadata (case number, parties, date, court formation)
 * - The operative part (the Court's ruling)
 * - All EU law articles cited in the judgment
 *
 * Works with the EUR-Lex HTML format for preliminary rulings and direct actions.
 * The HTML uses `coj-*` CSS classes (Court of Justice formatting).
 */

import { JSDOM } from 'jsdom';
import { execSync } from 'child_process';

const EURLEX_HTML_BASE = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:';

/**
 * Convert a case number like "C-311/18" to a CELEX identifier like "62018CJ0311".
 */
export function caseNumberToCelex(caseNumber) {
  const match = caseNumber.match(/^C[-‑–](\d+)\/(\d{2,4})$/);
  if (!match) throw new Error(`Invalid case number format: ${caseNumber}`);
  const num = match[1].padStart(4, '0');
  let year = match[2];
  if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year;
  return `6${year}CJ${num}`;
}

/**
 * Convert CELEX back to case number, e.g. "62018CJ0311" -> "C-311/18".
 */
export function celexToCaseNumber(celex) {
  const match = celex.match(/^6(\d{4})CJ(\d{4})$/);
  if (!match) return celex;
  const year = match[1].slice(2);
  const num = parseInt(match[2], 10);
  return `C-${num}/${year}`;
}

/**
 * Fetch the judgment HTML from EUR-Lex using curl (more reliable than Node fetch
 * in environments with restricted network access).
 */
function fetchJudgmentHtml(celex) {
  const url = `${EURLEX_HTML_BASE}${celex}`;
  try {
    const html = execSync(
      `curl -sL --max-time 30 "${url}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    if (!html || html.length < 100) {
      throw new Error(`Empty or too-short response for ${celex}`);
    }
    return html;
  } catch (err) {
    throw new Error(`Failed to fetch ${celex}: ${err.message}`);
  }
}

/**
 * Extract metadata from the judgment, using the structured coj-* CSS classes.
 */
function extractMetadata(document) {
  // Title line: "JUDGMENT OF THE COURT (Grand Chamber)"
  const titleEl = document.querySelector('.coj-sum-title-1');
  const titleText = titleEl?.textContent || '';

  const formationMatch = titleText.match(/\(([^)]*Chamber|full Court)\)/i);
  const formation = formationMatch ? formationMatch[1] : null;

  // Date from second coj-sum-title-1 element
  const titleEls = document.querySelectorAll('.coj-sum-title-1');
  let date = null;
  for (const el of titleEls) {
    const dateMatch = el.textContent.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
    if (dateMatch) {
      date = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`;
      break;
    }
  }

  // Subject matter from coj-index
  const indexEl = document.querySelector('.coj-index');
  const indexText = indexEl?.textContent?.replace(/[\s\n]+/g, ' ').trim() || null;

  // Full text for regex-based extraction
  const text = document.body?.textContent || '';

  // Case number
  const caseMatch = text.match(/(?:In\s+)?(?:Joined\s+)?Cases?\s+(C[-‑–]\d+\/\d{2,4}(?:\s*(?:and|,|to)\s*C[-‑–]\d+\/\d{2,4})*)/i);
  const caseNumber = caseMatch ? caseMatch[1].replace(/[‑–]/g, '-') : null;

  // Parties: bold elements after "In Case C-..." and before "THE COURT"
  const boldEls = document.querySelectorAll('.coj-bold');
  const partyNames = [];
  let inParties = false;
  for (const el of boldEls) {
    const t = el.textContent.trim();
    if (t.match(/^(THE COURT|composed of)/i)) break;
    // Skip non-party bold text
    if (el.closest('.coj-sum-title-1') || el.closest('.coj-index')) continue;
    if (el.closest('.coj-count')) continue;
    // Party names are in bold paragraphs after the case number
    if (t.match(/^[A-Z]/) && t.length > 3 && !t.match(/^(REQUEST|JUDGMENT|ORDER)/)) {
      if (caseNumber && !inParties) {
        // Check if we're past the case number
        const parentText = el.closest('p')?.textContent || '';
        if (!parentText.includes(caseNumber)) inParties = true;
      }
      if (inParties && t.length < 200) {
        partyNames.push(t.replace(/[,;]$/, ''));
      }
    }
  }

  // Build parties string: first party v second party
  let parties = null;
  if (partyNames.length >= 2) {
    parties = `${partyNames[0]} v ${partyNames[1]}`;
  } else if (partyNames.length === 1) {
    parties = partyNames[0];
  }

  // ECLI
  const ecliMatch = text.match(/(ECLI:EU:C:\d{4}:\d+)/);
  const ecli = ecliMatch ? ecliMatch[1] : null;

  return { caseNumber, date, formation, parties, ecli, subject: indexText };
}

/**
 * Extract the operative part (ruling) from the judgment.
 *
 * EUR-Lex ECJ HTML structure:
 * - The operative part starts with a paragraph containing
 *   "On those grounds, the Court (...) hereby rules:"
 * - Followed by numbered declarations (1., 2., 3.) in bold
 * - Ends before the signature block (.coj-signaturecase)
 */
function extractOperativePart(document) {
  const body = document.body;
  if (!body) return { raw: null, declarations: [] };

  // Strategy 1: Find by walking coj-normal paragraphs for "On those grounds"
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
    // Fallback: use full text search
    return extractOperativePartFromText(body.textContent || '');
  }

  // Collect all text after the operative header, stopping at signatures
  const declarations = [];
  let currentNumber = 0;
  let currentText = '';

  // Walk the DOM elements after the operative header
  const operativeP = allParagraphs[operativeStartIdx];
  let node = operativeP.closest('table') || operativeP.closest('tr') || operativeP;

  // Move to the next sibling/table after the operative header
  node = node.nextElementSibling || node.parentElement?.nextElementSibling;

  while (node) {
    // Stop at signature block
    if (node.querySelector?.('.coj-signaturecase') || node.classList?.contains('coj-signaturecase')) {
      break;
    }
    // Stop at footnotes
    if (node.tagName === 'HR' && node.classList?.contains('coj-note')) break;

    // Check for numbered bold items (the actual rulings): "1.", "2.", etc.
    const countEl = node.querySelector?.('.coj-count.coj-bold, .coj-count .coj-bold');
    if (countEl) {
      const numMatch = countEl.textContent.match(/(\d+)\./);
      if (numMatch) {
        // Save previous declaration
        if (currentNumber > 0 && currentText.trim()) {
          declarations.push({ number: currentNumber, text: currentText.trim() });
        }
        currentNumber = parseInt(numMatch[1], 10);
        // Get the ruling text from the adjacent cell
        const textCell = countEl.closest('tr')?.querySelector('td:last-child');
        currentText = textCell ? cleanText(textCell.textContent) : '';
        node = node.nextElementSibling;
        continue;
      }
    }

    // Non-numbered text that's part of the operative section (e.g., costs)
    // Append to current text if we're in a declaration
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

  // Save last declaration
  if (currentNumber > 0 && currentText.trim()) {
    declarations.push({ number: currentNumber, text: currentText.trim() });
  }

  // If DOM walking didn't find numbered declarations, fall back to text-based extraction
  if (declarations.length === 0) {
    return extractOperativePartFromText(body.textContent || '');
  }

  const raw = declarations.map(d => `${d.number}. ${d.text}`).join('\n\n');

  return { raw, declarations };
}

/**
 * Fallback: extract operative part from plain text.
 */
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

  if (operativeStart === -1) {
    return { raw: null, declarations: [] };
  }

  let rawOperative = fullText.substring(operativeStart).trim();

  // Remove signatures and delivered text
  const cutoffs = [
    /Delivered\s+in\s+open\s+court/i,
    /Language\s+of\s+the\s+case/i,
  ];
  for (const pattern of cutoffs) {
    const match = rawOperative.match(pattern);
    if (match) {
      rawOperative = rawOperative.substring(0, match.index).trim();
    }
  }

  // Split numbered declarations
  const declarations = [];
  const numberedPattern = /(?:^|\s)(\d+)\.\s+/g;
  const matches = [...rawOperative.matchAll(numberedPattern)];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : rawOperative.length;
      const text = cleanText(rawOperative.substring(start, end));
      if (text) {
        declarations.push({ number: parseInt(matches[i][1], 10), text });
      }
    }
  } else {
    const text = cleanText(rawOperative);
    if (text) declarations.push({ number: 1, text });
  }

  return {
    raw: cleanText(rawOperative),
    declarations,
  };
}

function cleanText(text) {
  return text.replace(/[\s\n\t]+/g, ' ').trim();
}

/**
 * Extract all EU law article citations from the judgment text.
 */
function extractArticleCitations(document) {
  const text = cleanText(document.body?.textContent || '');

  const citations = [];
  const seen = new Set();

  const articlePatterns = [
    // Article X(Y)(Z) of Regulation/Directive/Decision (EU/EC) YYYY/NNN
    /Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?\s+of\s+(?:Regulation|Directive|Decision)\s+\(?(?:EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?\d{2,4}\/\d+/gi,
    // Article X(Y) of Directive YYYY/NNN (without EU/EC prefix)
    /Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?\s+of\s+(?:Regulation|Directive|Decision)\s+\d{2,4}\/\d+/gi,
    // Article X of the GDPR / Charter / TFEU / TEU
    /Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?\s+of\s+(?:the\s+)?(?:GDPR|Charter|TFEU|TEU|ECHR)/gi,
    // Articles X, Y and Z of Regulation/Directive ...
    /Articles\s+[\d,\s]+(?:and\s+\d+)?\s+of\s+(?:Regulation|Directive|Decision)\s+\(?(?:EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?\d{2,4}\/\d+/gi,
    // Articles X, Y and Z of the GDPR/Charter
    /Articles\s+[\d,\s]+(?:and\s+\d+)?\s+of\s+(?:the\s+)?(?:GDPR|Charter|TFEU|TEU|ECHR)/gi,
    // Article X TFEU / TEU (standalone treaty references)
    /Article\s+\d+(?:\(\d+\))?\s+(?:TFEU|TEU|ECHR)/gi,
    // Point (x) of the first subparagraph of Article Y(Z)
    /point\s+\([a-z]\)\s+of\s+(?:the\s+)?(?:first|second|third)?\s*(?:subparagraph\s+of\s+)?Article\s+\d+\(\d+\)/gi,
  ];

  for (const pattern of articlePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const key = fullMatch.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) {
        seen.add(key);
        citations.push(parseArticleCitation(fullMatch));
      }
    }
  }

  return deduplicateAndSort(citations);
}

/**
 * Parse a single article citation string into a structured object.
 */
function parseArticleCitation(citation) {
  const result = { citation: citation.trim() };

  // Extract article number(s)
  const artMatch = citation.match(/Articles?\s+([\d,\s]+(?:and\s+\d+)?(?:\(\d+\))*(?:\([a-z]\))*)/i);
  if (artMatch) {
    const artStr = artMatch[1].trim();
    const singleMatch = artStr.match(/^(\d+)(?:\((\d+)\))?(?:\(([a-z])\))?$/);
    if (singleMatch) {
      result.article = singleMatch[1];
      if (singleMatch[2]) result.paragraph = singleMatch[2];
      if (singleMatch[3]) result.point = singleMatch[3];
    } else {
      const nums = artStr.match(/\d+/g);
      if (nums && nums.length > 1) {
        result.articles = nums;
      } else if (nums) {
        result.article = nums[0];
      }
    }
  }

  // Extract the legal act
  const actPatterns = [
    { pattern: /\bGDPR\b/i, act: 'GDPR', formal: 'Regulation (EU) 2016/679' },
    { pattern: /\bCharter\b/i, act: 'Charter of Fundamental Rights', formal: 'Charter of Fundamental Rights of the EU' },
    { pattern: /\bTFEU\b/i, act: 'TFEU', formal: 'Treaty on the Functioning of the EU' },
    { pattern: /\bTEU\b/i, act: 'TEU', formal: 'Treaty on European Union' },
    { pattern: /\bECHR\b/i, act: 'ECHR', formal: 'European Convention on Human Rights' },
    { pattern: /(Regulation|Directive|Decision)\s+\(?(EU|EC|EEC|Euratom)?\)?\s*(?:No\s+)?(\d{2,4}\/\d+)/i, act: null },
  ];

  for (const { pattern, act, formal } of actPatterns) {
    const match = citation.match(pattern);
    if (match) {
      if (act) {
        result.act = act;
        result.formalAct = formal;
      } else {
        const type = match[1];
        const prefix = match[2] || '';
        const number = match[3];
        result.act = `${type} ${prefix ? `(${prefix}) ` : ''}${number}`;
        result.formalAct = result.act;
      }
      break;
    }
  }

  return result;
}

function deduplicateAndSort(citations) {
  const unique = new Map();
  for (const c of citations) {
    const key = c.citation.toLowerCase().replace(/\s+/g, ' ');
    if (!unique.has(key)) unique.set(key, c);
  }
  return [...unique.values()].sort((a, b) => {
    const actCmp = (a.act || '').localeCompare(b.act || '');
    if (actCmp !== 0) return actCmp;
    const aNum = parseInt(a.article || a.articles?.[0] || '999', 10);
    const bNum = parseInt(b.article || b.articles?.[0] || '999', 10);
    return aNum - bNum;
  });
}

/**
 * Extract articles cited specifically within the operative part declarations.
 */
function extractOperativeArticles(declarations) {
  if (!declarations.length) return [];

  const operativeText = declarations.map(d => d.text).join(' ');
  const dom = new JSDOM(`<body>${operativeText}</body>`);
  return extractArticleCitations(dom.window.document);
}

/**
 * Main extraction function. Fetches and parses an ECJ judgment.
 *
 * @param {string} identifier - CELEX number (e.g. "62018CJ0311") or case number (e.g. "C-311/18")
 * @returns {object} Extracted judgment data
 */
export async function extractDecision(identifier) {
  let celex;
  if (identifier.match(/^6\d{4}CJ\d{4}$/)) {
    celex = identifier;
  } else {
    celex = caseNumberToCelex(identifier);
  }

  const caseNumber = celexToCaseNumber(celex);

  console.log(`Fetching judgment ${caseNumber} (${celex})...`);
  const html = fetchJudgmentHtml(celex);

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const metadata = extractMetadata(document);
  const operative = extractOperativePart(document);
  const allCitations = extractArticleCitations(document);
  const operativeCitations = extractOperativeArticles(operative.declarations);

  // Group citations by legal act
  const citationsByAct = {};
  for (const c of allCitations) {
    const act = c.act || 'Unknown';
    if (!citationsByAct[act]) citationsByAct[act] = [];
    citationsByAct[act].push(c);
  }

  return {
    celex,
    caseNumber: metadata.caseNumber || caseNumber,
    metadata: {
      date: metadata.date,
      formation: metadata.formation,
      parties: metadata.parties,
      ecli: metadata.ecli,
      subject: metadata.subject,
      eurlexUrl: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`,
    },
    operativePart: {
      declarations: operative.declarations,
      articlesCited: operativeCitations,
    },
    allArticlesCited: allCitations,
    citationsByAct,
  };
}
