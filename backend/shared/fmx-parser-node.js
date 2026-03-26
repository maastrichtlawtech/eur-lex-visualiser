/**
 * Node.js-compatible wrapper for the Formex parser.
 *
 * Railway deploys the API from the `backend` subdirectory, so this module
 * must not import parser code from the frontend `src` tree. Keep the parser
 * runtime self-contained under `backend/shared/formex-parser`.
 */

let parserPromise = null;
let shimPromise = null;

async function ensureDomShims() {
  if (shimPromise) return shimPromise;

  shimPromise = (async () => {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("");
    global.DOMParser = dom.window.DOMParser;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
  })();

  return shimPromise;
}

async function loadParser() {
  if (!parserPromise) {
    parserPromise = (async () => {
      await ensureDomShims();
      return import("./formex-parser/fmxParser.mjs");
    })();
  }

  return parserPromise;
}

async function parseFmxXml(xmlText) {
  const { parseFmxToCombined } = await loadParser();
  return parseFmxToCombined(xmlText);
}

async function isFmxDocument(text) {
  const mod = await loadParser();
  return mod.isFmxDocument(text);
}

module.exports = { parseFmxXml, isFmxDocument };
