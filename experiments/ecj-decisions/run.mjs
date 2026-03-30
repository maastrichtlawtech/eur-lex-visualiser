#!/usr/bin/env node

/**
 * CLI runner for ECJ Decision Extractor.
 *
 * Usage:
 *   node run.mjs C-311/18              # Single case by case number
 *   node run.mjs 62018CJ0311           # Single case by CELEX
 *   node run.mjs --gdpr                # Run all famous GDPR cases
 *   node run.mjs --json C-311/18       # Output raw JSON
 */

import { extractDecision, caseNumberToCelex } from './extract.mjs';

// Famous GDPR-related ECJ rulings
const GDPR_CASES = [
  { id: 'C-131/12', name: 'Google Spain — Right to be forgotten' },
  { id: 'C-362/14', name: 'Schrems I — Safe Harbor invalidation' },
  { id: 'C-673/17', name: 'Planet49 — Cookie consent' },
  { id: 'C-40/17',  name: 'Fashion ID — Joint controllership (like buttons)' },
  { id: 'C-311/18', name: 'Schrems II — Privacy Shield invalidation' },
  { id: 'C-252/21', name: 'Meta Platforms — Competition authority & GDPR' },
  { id: 'C-683/21', name: 'Nacionalinis — Credit scoring & automated decisions' },
];

function formatDecision(result) {
  const lines = [];
  const hr = '═'.repeat(80);
  const thin = '─'.repeat(80);

  lines.push(hr);
  lines.push(`  ${result.caseNumber}  —  ${result.metadata.ecli || ''}`);
  if (result.metadata.parties) {
    lines.push(`  ${result.metadata.parties.substring(0, 76)}`);
  }
  lines.push(`  Date: ${result.metadata.date || 'unknown'}  |  Formation: ${result.metadata.formation || 'unknown'}`);
  lines.push(hr);

  // Operative part
  lines.push('');
  lines.push('  OPERATIVE PART (Ruling)');
  lines.push(thin);
  if (result.operativePart.declarations.length === 0) {
    lines.push('  [Could not extract operative part]');
  } else {
    for (const d of result.operativePart.declarations) {
      const wrapped = wordWrap(`${d.number}. ${d.text}`, 76);
      for (const line of wrapped) {
        lines.push(`  ${line}`);
      }
      lines.push('');
    }
  }

  // Articles cited in the operative part
  if (result.operativePart.articlesCited.length > 0) {
    lines.push('  ARTICLES CITED IN RULING');
    lines.push(thin);
    for (const c of result.operativePart.articlesCited) {
      lines.push(`  • ${c.citation}`);
    }
    lines.push('');
  }

  // All articles by act
  lines.push('  ALL ARTICLES CITED (by legal act)');
  lines.push(thin);
  for (const [act, citations] of Object.entries(result.citationsByAct)) {
    lines.push(`  ${act}:`);
    for (const c of citations) {
      lines.push(`    • ${c.citation}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

function wordWrap(text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const gdprMode = args.includes('--gdpr');
  const identifiers = args.filter(a => !a.startsWith('--'));

  let cases;
  if (gdprMode) {
    cases = GDPR_CASES.map(c => c.id);
    console.log(`\nExtracting ${cases.length} famous GDPR-related ECJ decisions...\n`);
  } else if (identifiers.length > 0) {
    cases = identifiers;
  } else {
    console.log('Usage:');
    console.log('  node run.mjs C-311/18          # Single case');
    console.log('  node run.mjs --gdpr            # All famous GDPR cases');
    console.log('  node run.mjs --json C-311/18   # JSON output');
    process.exit(0);
  }

  const results = [];

  for (const id of cases) {
    try {
      const result = await extractDecision(id);
      results.push(result);

      if (jsonMode) {
        // JSON mode: collect and print at end
      } else {
        const label = GDPR_CASES.find(c => c.id === id);
        if (label) console.log(`\n>> ${label.name}\n`);
        console.log(formatDecision(result));
      }
    } catch (err) {
      console.error(`Error extracting ${id}: ${err.message}`);
      results.push({ celex: id, error: err.message });
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  }

  // Summary
  if (!jsonMode && results.length > 1) {
    console.log('\n' + '═'.repeat(80));
    console.log('  SUMMARY');
    console.log('─'.repeat(80));
    const successful = results.filter(r => !r.error);
    const withOperative = successful.filter(r => r.operativePart?.declarations?.length > 0);
    console.log(`  Cases processed:  ${results.length}`);
    console.log(`  Successful:       ${successful.length}`);
    console.log(`  Operative found:  ${withOperative.length}`);
    console.log(`  Total citations:  ${successful.reduce((sum, r) => sum + (r.allArticlesCited?.length || 0), 0)}`);
    console.log('═'.repeat(80));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
