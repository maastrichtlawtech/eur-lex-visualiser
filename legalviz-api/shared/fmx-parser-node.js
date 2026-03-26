/**
 * Node.js-compatible wrapper for the Formex parser.
 *
 * The parser (src/utils/fmxParser.js) relies on browser DOM APIs
 * (DOMParser, Node.TEXT_NODE, etc.) that don't exist in plain Node.js.
 * This module shims those globals via jsdom, then dynamically imports
 * the ES-module parser so it can be used from the CommonJS API server.
 */

const { JSDOM } = require('jsdom');

// Shim the browser globals the parser depends on — once, before import.
const dom = new JSDOM('');
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

let _parserPromise = null;

/**
 * Lazily import the ESM parser (only resolved once).
 */
function loadParser() {
  if (!_parserPromise) {
    _parserPromise = import('../../src/utils/fmxParser.js');
  }
  return _parserPromise;
}

/**
 * Parse a raw Formex XML string into structured JSON.
 *
 * @param {string} xmlText  Raw FMX XML content
 * @returns {Promise<object>} Parsed law: { title, langCode, articles, recitals, definitions, annexes, crossReferences }
 */
async function parseFmxXml(xmlText) {
  const { parseFmxToCombined } = await loadParser();
  return parseFmxToCombined(xmlText);
}

/**
 * Check whether a string looks like an FMX document.
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function isFmxDocument(text) {
  const mod = await loadParser();
  return mod.isFmxDocument(text);
}

module.exports = { parseFmxXml, isFmxDocument };
