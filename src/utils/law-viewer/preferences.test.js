import { describe, expect, it } from "vitest";
import { getPreferredSecondaryLanguage, normalizeExtraLanguage } from "./preferences.js";

describe("normalizeExtraLanguage", () => {
  it("normalizes supported languages and rejects unsupported ones", () => {
    expect(normalizeExtraLanguage("en")).toBe("EN");
    expect(normalizeExtraLanguage(" zz ")).toBeNull();
  });
});

describe("getPreferredSecondaryLanguage", () => {
  it("falls back away from the primary language", () => {
    expect(getPreferredSecondaryLanguage("EN")).toBe("DE");
    expect(getPreferredSecondaryLanguage("DE")).toBe("EN");
  });
});
