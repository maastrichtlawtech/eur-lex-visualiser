const path = require("path");
const { spawn } = require("child_process");
const fsp = require("fs/promises");

const { DEFAULT_STATE_PATH } = require("./download-html-fallbacks");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function toCliArgs(options) {
  const args = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === false || value == null) continue;
    args.push(`--${key}`);
    if (value !== true) {
      args.push(String(value));
    }
  }
  return args;
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function yearRange(fromYear, toYear) {
  const values = [];
  for (let year = fromYear; year >= toYear; year -= 1) {
    values.push(String(year));
  }
  return values;
}

function normalizeYearStatus(year, status, { currentYear } = {}) {
  if (Number.parseInt(String(year), 10) === Number(currentYear) && status === "complete") {
    return "snapshot_complete";
  }
  return status || "pending";
}

function summarizeState(state, { fromYear, toYear, currentYear = new Date().getUTCFullYear() }) {
  const years = yearRange(fromYear, toYear);
  const statuses = years.map((year) => [year, normalizeYearStatus(year, state?.years?.[year]?.status, { currentYear })]);
  const pending = statuses.filter(([, status]) => status !== "complete" && status !== "snapshot_complete");
  const challenged = statuses.filter(([, status]) => status === "challenged");
  const frontier = pending[0] || null;
  return {
    statuses,
    pending,
    challenged,
    frontier,
    done: pending.length === 0,
  };
}

function runChunk(scriptPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Chunk process exited via signal ${signal}`));
        return;
      }
      resolve(code || 0);
    });
  });
}

async function main() {
  const rawOptions = parseArgs(process.argv.slice(2));
  const fromYear = Number.parseInt(rawOptions.fromYear || String(new Date().getUTCFullYear()), 10);
  const toYear = Number.parseInt(rawOptions.toYear || "1990", 10);
  const currentYear = new Date().getUTCFullYear();
  const statePath = path.resolve(rawOptions.statePath || DEFAULT_STATE_PATH);
  const delayBetweenRunsMs = Math.max(0, Number.parseInt(String(rawOptions.delayBetweenRunsMs || "1000"), 10) || 0);
  const maxRuns = Math.max(1, Number.parseInt(String(rawOptions.maxRuns || "10000"), 10) || 10000);

  const forwarded = { ...rawOptions };
  delete forwarded.delayBetweenRunsMs;
  delete forwarded.maxRuns;

  const scriptPath = path.join(__dirname, "download-html-fallbacks.js");

  for (let run = 1; run <= maxRuns; run += 1) {
    const existingState = await readJson(statePath, { years: {} });
    const existingSummary = summarizeState(existingState, { fromYear, toYear, currentYear });
    const chunkFromYear = existingSummary.done
      ? fromYear
      : Number.parseInt(existingSummary.frontier?.[0] || String(fromYear), 10);
    const chunkArgs = toCliArgs({
      ...forwarded,
      fromYear: chunkFromYear,
      toYear,
    });

    console.log(`[download-html-fallbacks-loop] starting chunk ${run}`);
    const code = await runChunk(scriptPath, chunkArgs, path.join(__dirname, ".."));
    if (code !== 0) {
      process.exitCode = code;
      return;
    }

    const state = await readJson(statePath, { years: {} });
    const summary = summarizeState(state, { fromYear, toYear, currentYear });
    if (summary.done) {
      console.log(`[download-html-fallbacks-loop] completed ${fromYear}..${toYear}`);
      return;
    }
    if (summary.frontier?.[1] === "challenged") {
      const [year] = summary.frontier;
      console.log(`[download-html-fallbacks-loop] stopping after challenge in ${year}`);
      return;
    }

    const [nextYear] = summary.frontier;
    console.log(`[download-html-fallbacks-loop] resuming with next pending year ${nextYear}`);
    if (delayBetweenRunsMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenRunsMs));
    }
  }

  console.log(`[download-html-fallbacks-loop] reached maxRuns=${maxRuns} before completion`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[download-html-fallbacks-loop] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeYearStatus,
  parseArgs,
  summarizeState,
  toCliArgs,
  yearRange,
};
