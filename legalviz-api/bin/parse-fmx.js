#!/usr/bin/env node

/**
 * CLI tool to parse a Formex XML file and output structured JSON.
 *
 * Usage:
 *   parse-fmx <input.xml> [-o output.json]
 *   parse-fmx < input.xml > output.json
 *   cat input.xml | parse-fmx
 *   parse-fmx --help
 */

const fs = require('fs');
const path = require('path');
const { parseFmxXml } = require('../shared/fmx-parser-node');

function printHelp() {
  console.log(`
parse-fmx — Convert Formex XML to structured JSON

Usage:
  parse-fmx <input.xml>                 Parse file, print JSON to stdout
  parse-fmx <input.xml> -o out.json     Parse file, write JSON to out.json
  parse-fmx < input.xml                 Read from stdin, print JSON to stdout
  parse-fmx --help                      Show this help

Output contains: title, langCode, articles, recitals, definitions, annexes, crossReferences
`.trim());
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Parse arguments
  let inputPath = null;
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-o' || args[i] === '--output') && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (!args[i].startsWith('-')) {
      inputPath = args[i];
    } else {
      console.error(`Unknown option: ${args[i]}`);
      process.exit(1);
    }
  }

  // Read input
  let xmlText;
  if (inputPath) {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    xmlText = fs.readFileSync(resolved, 'utf8');
  } else if (!process.stdin.isTTY) {
    xmlText = await readStdin();
  } else {
    console.error('No input provided. Pass a file path or pipe XML via stdin.');
    console.error('Run "parse-fmx --help" for usage.');
    process.exit(1);
  }

  // Parse
  const result = await parseFmxXml(xmlText);
  const json = JSON.stringify(result, null, 2);

  // Write output
  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), json, 'utf8');
    console.error(`Written to ${outputPath}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
