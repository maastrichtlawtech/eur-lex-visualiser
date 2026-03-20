import { describe, it, expect } from "vitest";
import {
  getLangConfig,
  buildMeansRegex,
  buildFallbackDefRegex,
  getStopWords,
} from "./languages.js";

const ALL_LANG_CODES = [
  "EN", "PL", "DE", "FR", "ES", "IT", "PT", "NL", "DA", "SV",
  "FI", "CS", "SK", "HU", "RO", "BG", "HR", "SL", "ET", "LV",
  "LT", "EL", "MT", "GA",
];

describe("getLangConfig", () => {
  it("returns config for all 24 EU languages", () => {
    for (const code of ALL_LANG_CODES) {
      const config = getLangConfig(code);
      expect(config).toBeTruthy();
      expect(config.code).toBe(code);
    }
  });

  it("falls back to EN for unknown language", () => {
    const config = getLangConfig("XX");
    expect(config.code).toBe("EN");
  });

  it("all configs have required properties", () => {
    for (const code of ALL_LANG_CODES) {
      const config = getLangConfig(code);
      expect(config).toHaveProperty("article");
      expect(config).toHaveProperty("chapter");
      expect(config).toHaveProperty("section");
      expect(config).toHaveProperty("annex");
      expect(config).toHaveProperty("definition");
      expect(config).toHaveProperty("quoteChars");
      expect(config).toHaveProperty("meansVerb");
      expect(config).toHaveProperty("definitionFormat");
    }
  });

  it("article regex captures article number", () => {
    const testCases = {
      EN: "Article 5",
      DE: "Artikel 12",
      FR: "Article 3",
      PL: "Artykuł 7",
      HU: "5. cikk",
      IT: "Articolo 9",
      ES: "Artículo 15",
      EL: "Άρθρο 4",
    };

    for (const [code, text] of Object.entries(testCases)) {
      const config = getLangConfig(code);
      const match = text.match(config.article);
      expect(match, `${code}: "${text}" should match`).toBeTruthy();
      expect(match[1]).toMatch(/^\d+/);
    }
  });
});

describe("buildMeansRegex", () => {
  it("builds valid regex for term_first languages", () => {
    const lang = getLangConfig("EN");
    const regex = buildMeansRegex(lang);
    expect(regex).toBeInstanceOf(RegExp);

    const match = "\u2018personal data\u2019 means any information".match(regex);
    expect(match).toBeTruthy();
    expect(match[1]).toBe("personal data");
  });

  it("builds valid regex for verb_first languages (French)", () => {
    const lang = getLangConfig("FR");
    const regex = buildMeansRegex(lang);
    expect(regex).toBeInstanceOf(RegExp);

    const match = "on entend par «données personnelles»".match(regex);
    expect(match).toBeTruthy();
    expect(match[1]).toBe("données personnelles");
  });

  it("builds valid regex for verb_first languages (Italian)", () => {
    const lang = getLangConfig("IT");
    const regex = buildMeansRegex(lang);
    expect(regex).toBeInstanceOf(RegExp);
  });

  it("builds valid regex for all languages without throwing", () => {
    for (const code of ALL_LANG_CODES) {
      const lang = getLangConfig(code);
      expect(() => buildMeansRegex(lang)).not.toThrow();
    }
  });
});

describe("buildFallbackDefRegex", () => {
  it("handles Lithuanian (term – definition pattern)", () => {
    const lang = getLangConfig("LT");
    const regex = buildFallbackDefRegex(lang);
    const match = "terminas – apibrėžimas".match(regex);
    expect(match).toBeTruthy();
    expect(match[1]).toBe("terminas");
  });

  it("handles Swedish (term : definition pattern)", () => {
    const lang = getLangConfig("SV");
    const regex = buildFallbackDefRegex(lang);
    const match = "term : definition text here".match(regex);
    expect(match).toBeTruthy();
    expect(match[1]).toBe("term");
  });

  it("handles quoted terms for other languages", () => {
    const lang = getLangConfig("EN");
    const regex = buildFallbackDefRegex(lang);
    const match = "\u2018personal data\u2019: any information".match(regex);
    expect(match).toBeTruthy();
    expect(match[1]).toBe("personal data");
  });

  it("builds valid regex for all languages without throwing", () => {
    for (const code of ALL_LANG_CODES) {
      const lang = getLangConfig(code);
      expect(() => buildFallbackDefRegex(lang)).not.toThrow();
    }
  });
});

describe("getStopWords", () => {
  it("returns a Set for EN", () => {
    const words = getStopWords("EN");
    expect(words).toBeInstanceOf(Set);
    expect(words.size).toBeGreaterThan(30);
  });

  it("includes common English stop words", () => {
    const words = getStopWords("EN");
    expect(words.has("the")).toBe(true);
    expect(words.has("and")).toBe(true);
    expect(words.has("shall")).toBe(true);
  });

  it("merges English + target language stop words", () => {
    const deWords = getStopWords("DE");
    // Should have English words
    expect(deWords.has("the")).toBe(true);
    // Should have German words
    expect(deWords.has("der")).toBe(true);
    expect(deWords.has("die")).toBe(true);
  });

  it("falls back to EN for unknown language", () => {
    const words = getStopWords("XX");
    expect(words).toBeInstanceOf(Set);
    expect(words.size).toBeGreaterThan(0);
  });

  it("returns stop words for all 24 languages", () => {
    for (const code of ALL_LANG_CODES) {
      const words = getStopWords(code);
      expect(words.size, `${code} should have stop words`).toBeGreaterThan(0);
    }
  });
});
