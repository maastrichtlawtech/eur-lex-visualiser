import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { isFmxDocument, parseFmxToCombined, injectCrossRefLinks } from "./fmxParser.js";
import { getLangConfig } from "./languages.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DGA_XML = readFileSync(resolve(__dirname, "../__fixtures__/dga.fmx.xml"), "utf-8");
const GDPR_XML = readFileSync(resolve(__dirname, "../__fixtures__/gdpr.fmx.xml"), "utf-8");

// ---------------------------------------------------------------------------
// isFmxDocument
// ---------------------------------------------------------------------------

describe("isFmxDocument", () => {
  it("returns true for valid FMX XML", () => {
    expect(isFmxDocument(DGA_XML)).toBe(true);
    expect(isFmxDocument(GDPR_XML)).toBe(true);
  });

  it("returns true for combined FMX documents", () => {
    expect(isFmxDocument("<COMBINED.FMX><ACT></ACT></COMBINED.FMX>")).toBe(true);
  });

  it("returns false for plain HTML", () => {
    expect(isFmxDocument("<html><body>hello</body></html>")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFmxDocument("")).toBe(false);
  });

  it("returns false if only <ACT> without formex and ENACTING.TERMS", () => {
    expect(isFmxDocument("<ACT>some content</ACT>")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseFmxToCombined — DGA (Data Governance Act)
// ---------------------------------------------------------------------------

describe("parseFmxToCombined — DGA", () => {
  let result;
  beforeAll(() => {
    result = parseFmxToCombined(DGA_XML);
  });

  it("extracts a non-empty title", () => {
    expect(result.title).toBeTruthy();
    expect(typeof result.title).toBe("string");
  });

  it("detects English language", () => {
    expect(result.langCode).toBe("EN");
  });

  it("extracts 38 articles", () => {
    expect(result.articles).toHaveLength(38);
  });

  it("extracts recitals (at least 46)", () => {
    // The FMX document may include recitals beyond the 46 numbered ones
    expect(result.recitals.length).toBeGreaterThanOrEqual(46);
  });

  it("articles have expected shape", () => {
    const art = result.articles[0];
    expect(art).toHaveProperty("article_number");
    expect(art).toHaveProperty("article_title");
    expect(art).toHaveProperty("article_html");
    expect(art).toHaveProperty("division");
  });

  it("recitals have expected shape", () => {
    const rec = result.recitals[0];
    expect(rec).toHaveProperty("recital_number");
    expect(rec).toHaveProperty("recital_text");
    expect(rec).toHaveProperty("recital_html");
  });

  it("article numbers are sequential strings", () => {
    const nums = result.articles.map((a) => parseInt(a.article_number, 10));
    expect(nums[0]).toBe(1);
    expect(nums[nums.length - 1]).toBe(38);
  });

  it("extracts definitions from the definitions article", () => {
    expect(result.definitions.length).toBeGreaterThan(0);
    const def = result.definitions[0];
    expect(def).toHaveProperty("term");
    expect(def).toHaveProperty("definition");
    expect(def.term.length).toBeGreaterThan(0);
  });

  it("extracts cross-references", () => {
    expect(Object.keys(result.crossReferences).length).toBeGreaterThan(0);
  });

  it("cross-references include article references", () => {
    const allRefs = Object.values(result.crossReferences).flat();
    const articleRefs = allRefs.filter((r) => r.type === "article");
    expect(articleRefs.length).toBeGreaterThan(0);
  });

  it("cross-references include external law references", () => {
    const allRefs = Object.values(result.crossReferences).flat();
    const externalRefs = allRefs.filter((r) => r.type === "external");
    expect(externalRefs.length).toBeGreaterThan(0);
  });

  it("excludes self-references from cross-references", () => {
    for (const [artNum, refs] of Object.entries(result.crossReferences)) {
      if (!artNum.startsWith("recital_") && !artNum.startsWith("annex_")) {
        const selfRefs = refs.filter((r) => r.type === "article" && r.target === artNum);
        expect(selfRefs).toHaveLength(0);
      }
    }
  });

  it("articles include chapter division info", () => {
    const artWithChapter = result.articles.find((a) => a.division?.chapter?.number);
    expect(artWithChapter).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// parseFmxToCombined — GDPR
// ---------------------------------------------------------------------------

describe("parseFmxToCombined — GDPR", () => {
  let result;
  beforeAll(() => {
    result = parseFmxToCombined(GDPR_XML);
  });

  it("extracts 99 articles", () => {
    expect(result.articles).toHaveLength(99);
  });

  it("extracts 173 recitals", () => {
    expect(result.recitals).toHaveLength(173);
  });

  it("title includes GDPR or Data Protection", () => {
    expect(
      result.title.toLowerCase().includes("data protection") ||
        result.title.toLowerCase().includes("gdpr")
    ).toBe(true);
  });

  it("extracts definitions (GDPR Art 4 has 26 definitions)", () => {
    expect(result.definitions.length).toBeGreaterThanOrEqual(20);
  });

  it("definition terms include 'personal data'", () => {
    const terms = result.definitions.map((d) => d.term.toLowerCase());
    expect(terms.some((t) => t.includes("personal data"))).toBe(true);
  });

  it("recitals are sorted numerically", () => {
    const nums = result.recitals.map((r) => parseInt(r.recital_number, 10));
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// parseFmxToCombined — error handling
// ---------------------------------------------------------------------------

describe("parseFmxToCombined — error handling", () => {
  it("throws on malformed XML", () => {
    expect(() => parseFmxToCombined("<ACT><broken")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// injectCrossRefLinks
// ---------------------------------------------------------------------------

describe("injectCrossRefLinks", () => {
  const lang = getLangConfig("EN");

  it("wraps Article references as links", () => {
    const html = "<p>See Article 5 for details.</p>";
    const result = injectCrossRefLinks(html, lang);
    expect(result).toContain('class="cross-ref"');
    expect(result).toContain('data-ref-article="5"');
    expect(result).toContain('href="#article-5"');
  });

  it("wraps external law references as links", () => {
    const html = "<p>As defined in Regulation (EU) 2016/679.</p>";
    const result = injectCrossRefLinks(html, lang);
    expect(result).toContain('class="external-ref"');
    expect(result).toContain('target="_blank"');
  });

  it("returns empty/falsy html unchanged", () => {
    expect(injectCrossRefLinks("", lang)).toBe("");
    expect(injectCrossRefLinks(null, lang)).toBe(null);
  });

  it("does not double-wrap existing links", () => {
    const html = '<p><a class="cross-ref" href="#article-5">Article 5</a> and Article 6</p>';
    const result = injectCrossRefLinks(html, lang);
    // Article 5 should NOT get double-wrapped, Article 6 should get wrapped
    const matches = result.match(/class="cross-ref"/g);
    expect(matches).toHaveLength(2);
  });

  it("handles German article references", () => {
    const deLang = getLangConfig("DE");
    const html = "<p>Siehe Artikel 12 für Details.</p>";
    const result = injectCrossRefLinks(html, deLang);
    expect(result).toContain('data-ref-article="12"');
  });
});
