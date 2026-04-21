#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseFmxXml } = require("../backend/shared/fmx-parser-node.js");
const { embedBatch } = require("../backend/shared/openrouter-embeddings.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const MODEL = process.env.RECITAL_EMBEDDING_MODEL || "openai/text-embedding-3-large";
const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const API_KEY = process.env.OPENROUTER_API_KEY;
const BUNDLED_PYTHON =
  "/Users/konrad.kollnig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const PYTHON =
  process.env.PYTHON || (fs.existsSync(BUNDLED_PYTHON) ? BUNDLED_PYTHON : "python3");
const PDF_PATH = process.argv[2] || process.env.KAI_ZENNER_PDF;

function stripTags(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map((value) => value / magnitude) : vector.map(() => 0);
}

function dot(left, right) {
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) sum += left[index] * right[index];
  return sum;
}

function position(index, count) {
  return count <= 1 ? 0 : index / (count - 1);
}

function readPdfText(pdfPath) {
  const code = [
    "from pypdf import PdfReader",
    "import sys",
    "reader = PdfReader(sys.argv[1])",
    "print('\\n'.join(page.extract_text() or '' for page in reader.pages))",
  ].join("; ");

  const result = spawnSync(PYTHON, ["-c", code, pdfPath], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `PDF extraction failed with status ${result.status}`);
  }
  return result.stdout;
}

function expandArticleRefs(text) {
  const refs = new Set();
  const regex = /\bArticles?\s+([0-9][0-9\s,/and-]*)/gi;
  let match;
  while ((match = regex.exec(text))) {
    const raw = match[1]
      .replace(/\band\b/gi, ",")
      .replace(/\s+/g, "");
    for (const part of raw.split(",")) {
      if (!part) continue;
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        for (let value = start; value <= end; value += 1) refs.add(String(value));
        continue;
      }
      const slash = part.match(/^(\d+)\/(\d+)$/);
      if (slash) {
        refs.add(slash[1]);
        refs.add(slash[2]);
        continue;
      }
      const number = part.match(/^(\d+)/);
      if (number) refs.add(number[1]);
    }
  }
  return refs;
}

function parseKaiZennerMapping(pdfText) {
  const mapping = new Map();
  for (const line of pdfText.split(/\n+/)) {
    const row = line.trim().match(/^(\d+)\s+\([^)]+\)\s+(.+)$/);
    if (!row) continue;
    const recitalId = row[1];
    const refs = expandArticleRefs(row[2]);
    if (refs.size > 0) mapping.set(recitalId, refs);
  }
  return mapping;
}

async function parseLaw(fixtureName) {
  const xml = fs.readFileSync(path.join(repoRoot, "src", "__fixtures__", fixtureName), "utf8");
  return parseFmxXml(xml);
}

function buildTexts(parsed) {
  const recitals = parsed.recitals.map((recital) => ({
    id: String(recital.recital_number),
    text: `Recital ${recital.recital_number}\n\n${stripTags(recital.recital_html || recital.recital_text || "")}`.slice(0, 6000),
  }));
  const articles = parsed.articles.map((article) => ({
    id: String(article.article_number),
    text: `${parsed.title || ""}\n\n${article.article_title || ""}\n\n${stripTags(article.article_html || "")}`
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000),
  }));
  return { recitals, articles };
}

async function embedLaw(parsed) {
  const { recitals, articles } = buildTexts(parsed);
  const texts = [...recitals.map((entry) => entry.text), ...articles.map((entry) => entry.text)];
  const response = await embedBatch(texts, {
    model: MODEL,
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  });
  const vectors = response.embeddings.map(normalizeVector);
  return {
    recitals,
    articles,
    recitalVecs: vectors.slice(0, recitals.length),
    articleVecs: vectors.slice(recitals.length),
    tokens: response.usage?.total_tokens || 0,
  };
}

function predict(embedded, { threshold, alpha, gap, maxPerRecital = 4 }) {
  const byRecital = new Map();
  for (let recitalIndex = 0; recitalIndex < embedded.recitals.length; recitalIndex += 1) {
    const scores = [];
    for (let articleIndex = 0; articleIndex < embedded.articles.length; articleIndex += 1) {
      const cosine = dot(embedded.recitalVecs[recitalIndex], embedded.articleVecs[articleIndex]);
      const monotonic =
        1 - Math.abs(position(recitalIndex, embedded.recitals.length) - position(articleIndex, embedded.articles.length));
      scores.push({
        articleId: embedded.articles[articleIndex].id,
        score: cosine + alpha * monotonic,
      });
    }
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0]?.score ?? 0;
    byRecital.set(
      embedded.recitals[recitalIndex].id,
      scores
        .filter((entry) => entry.score >= threshold && best - entry.score <= gap)
        .slice(0, maxPerRecital)
    );
  }
  return byRecital;
}

function evaluateAiAct(predicted, manual) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let top1 = 0;
  let evaluated = 0;
  let predictedPairs = 0;

  for (const [recitalId, expected] of manual) {
    const predictedRows = predicted.get(recitalId) || [];
    const predictedSet = new Set(predictedRows.map((row) => row.articleId));
    predictedPairs += predictedSet.size;
    evaluated += 1;
    if (predictedRows[0] && expected.has(predictedRows[0].articleId)) top1 += 1;

    for (const articleId of predictedSet) {
      if (expected.has(articleId)) tp += 1;
      else fp += 1;
    }
    for (const articleId of expected) {
      if (!predictedSet.has(articleId)) fn += 1;
    }
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    f1,
    precision,
    recall,
    top1: evaluated ? top1 / evaluated : 0,
    avgPredicted: evaluated ? predictedPairs / evaluated : 0,
    tp,
    fp,
    fn,
  };
}

function summarizeGdpr(predicted) {
  const counts = Array.from(predicted.values()).flat().reduce((map, entry) => {
    map.set(entry.articleId, (map.get(entry.articleId) || 0) + 1);
    return map;
  }, new Map());
  const articleCounts = Array.from(counts.values());
  articleCounts.sort((a, b) => b - a);
  return {
    article2: counts.get("2") || 0,
    maxArticle: articleCounts[0] || 0,
    avgArticle: articleCounts.reduce((sum, value) => sum + value, 0) / Math.max(counts.size, 1),
    totalPairs: articleCounts.reduce((sum, value) => sum + value, 0),
  };
}

function fmt(value) {
  return Number(value).toFixed(3);
}

async function main() {
  if (!API_KEY) throw new Error("OPENROUTER_API_KEY is required");
  if (!PDF_PATH) throw new Error("Usage: node scripts/tune-recital-map.js /path/to/KZenner-AIA-recitals.pdf");
  const manual = parseKaiZennerMapping(readPdfText(PDF_PATH));
  const aiAct = await parseLaw("aia.fmx.xml");
  const gdpr = await parseLaw("gdpr.fmx.xml");

  console.log(`Manual AI Act mappings with article refs: ${manual.size}`);
  console.log(`Embedding AI Act: R=${aiAct.recitals.length} A=${aiAct.articles.length}`);
  const aiEmbedded = await embedLaw(aiAct);
  console.log(`Embedding GDPR: R=${gdpr.recitals.length} A=${gdpr.articles.length}`);
  const gdprEmbedded = await embedLaw(gdpr);
  console.log(`Tokens: AI Act=${aiEmbedded.tokens}, GDPR=${gdprEmbedded.tokens}`);

  const rows = [];
  for (const alpha of [0, 0.03, 0.05, 0.07, 0.1]) {
    for (const threshold of [0.56, 0.58, 0.6, 0.62, 0.64, 0.66, 0.68, 0.7]) {
      for (const gap of [0.02, 0.03, 0.04, 0.05, 0.06, 0.08]) {
        const params = { threshold, alpha, gap };
        const aiMetrics = evaluateAiAct(predict(aiEmbedded, params), manual);
        const gdprMetrics = summarizeGdpr(predict(gdprEmbedded, params));
        rows.push({ params, aiMetrics, gdprMetrics });
      }
    }
  }

  rows.sort((a, b) => {
    if (b.aiMetrics.f1 !== a.aiMetrics.f1) return b.aiMetrics.f1 - a.aiMetrics.f1;
    return a.gdprMetrics.article2 - b.gdprMetrics.article2;
  });

  console.log("\nTop parameter sets:");
  for (const row of rows.slice(0, 20)) {
    const { threshold, alpha, gap } = row.params;
    const ai = row.aiMetrics;
    const gdprSummary = row.gdprMetrics;
    console.log(
      [
        `t=${threshold}`,
        `a=${alpha}`,
        `gap=${gap}`,
        `AI f1=${fmt(ai.f1)}`,
        `p=${fmt(ai.precision)}`,
        `r=${fmt(ai.recall)}`,
        `top1=${fmt(ai.top1)}`,
        `avgPred=${fmt(ai.avgPredicted)}`,
        `GDPR art2=${gdprSummary.article2}`,
        `gdprMax=${gdprSummary.maxArticle}`,
        `gdprPairs=${gdprSummary.totalPairs}`,
      ].join(" ")
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
