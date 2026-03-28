import { describe, expect, it } from "vitest";

import { shouldShowArticleNavigationHint } from "./navigationHint.js";

describe("shouldShowArticleNavigationHint", () => {
  it("shows the note for multi-article laws until it is dismissed", () => {
    expect(shouldShowArticleNavigationHint({
      selected: { kind: "article", id: "1" },
      articleCount: 99,
      isDismissed: false,
    })).toBe(true);
  });

  it("hides the note after dismissal", () => {
    expect(shouldShowArticleNavigationHint({
      selected: { kind: "article", id: "1" },
      articleCount: 99,
      isDismissed: true,
    })).toBe(false);
  });

  it("hides the note for non-article selections and short laws", () => {
    expect(shouldShowArticleNavigationHint({
      selected: { kind: "recital", id: "1" },
      articleCount: 99,
      isDismissed: false,
    })).toBe(false);

    expect(shouldShowArticleNavigationHint({
      selected: { kind: "article", id: "1" },
      articleCount: 1,
      isDismissed: false,
    })).toBe(false);
  });
});
