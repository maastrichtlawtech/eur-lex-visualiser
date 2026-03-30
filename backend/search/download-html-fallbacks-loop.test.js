const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeYearStatus, parseArgs, summarizeState, toCliArgs, yearRange } = require("./download-html-fallbacks-loop");

test("parseArgs handles boolean and valued flags", () => {
  const parsed = parseArgs(["--fromYear", "2010", "--toYear", "1990", "--stopOnChallenge", "false", "--dryRun"]);
  assert.deepEqual(parsed, {
    fromYear: "2010",
    toYear: "1990",
    stopOnChallenge: "false",
    dryRun: true,
  });
});

test("toCliArgs rebuilds flat CLI args", () => {
  const args = toCliArgs({ fromYear: 2010, toYear: 1990, dryRun: true, ignored: false });
  assert.deepEqual(args, ["--fromYear", "2010", "--toYear", "1990", "--dryRun"]);
});

test("yearRange counts downward inclusively", () => {
  assert.deepEqual(yearRange(2012, 2010), ["2012", "2011", "2010"]);
});

test("normalizeYearStatus treats current-year complete as snapshot_complete", () => {
  assert.equal(normalizeYearStatus("2026", "complete", { currentYear: 2026 }), "snapshot_complete");
  assert.equal(normalizeYearStatus("2025", "complete", { currentYear: 2026 }), "complete");
});

test("summarizeState reports done and challenged years", () => {
  const state = {
    years: {
      2012: { status: "complete" },
      2011: { status: "challenged" },
      2010: { status: "in_progress" },
    },
  };

  const summary = summarizeState(state, { fromYear: 2012, toYear: 2010, currentYear: 2026 });
  assert.equal(summary.done, false);
  assert.deepEqual(summary.challenged, [["2011", "challenged"]]);
  assert.deepEqual(summary.pending, [["2011", "challenged"], ["2010", "in_progress"]]);
  assert.deepEqual(summary.frontier, ["2011", "challenged"]);
});

test("summarizeState keeps the first non-complete year as frontier even if older years are challenged", () => {
  const state = {
    years: {
      2026: { status: "complete" },
      2025: { status: "complete" },
      2024: { status: "in_progress" },
      2000: { status: "challenged" },
      1998: { status: "challenged" },
    },
  };

  const summary = summarizeState(state, { fromYear: 2026, toYear: 1990, currentYear: 2026 });
  assert.deepEqual(summary.frontier, ["2024", "in_progress"]);
  assert.deepEqual(summary.challenged, [["2000", "challenged"], ["1998", "challenged"]]);
  assert.deepEqual(summary.statuses[0], ["2026", "snapshot_complete"]);
});
