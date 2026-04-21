const test = require("node:test");
const assert = require("node:assert/strict");

const { computeRecitalMap } = require("./scoring");

test("computeRecitalMap supports multi-attachment and orphan recitals", () => {
  const result = computeRecitalMap({
    recitalVecs: [
      [1, 0],
      [0, 0],
    ],
    articleVecs: [
      [1, 0],
      [1, 0],
    ],
    recitalIds: ["1", "2"],
    articleIds: ["1", "2"],
    options: {
      threshold: 0.5,
      alpha: 0.1,
      maxPerRecital: 4,
      maxScoreGapFromBest: 0.2,
      scoringVersion: 1,
    },
  });

  assert.equal(result.byArticle["1"].length, 1);
  assert.equal(result.byArticle["2"].length, 1);
  assert.equal(result.byArticle["1"][0].recital_number, "1");
  assert.equal(result.byArticle["2"][0].recital_number, "1");
  assert.ok(result.byArticle["1"][0].relevanceScore > result.byArticle["2"][0].relevanceScore);
  assert.equal(result.orphans.length, 1);
  assert.equal(result.orphans[0].recital_number, "2");
});
