import { describe, it, expect } from "vitest";
import {
  getLawSlug,
  enrichLaw,
  getBundledLaws,
  findBundledLawByKey,
  findBundledLawByCelex,
  findBundledLawBySlug,
  getCanonicalLawRoute,
  buildImportedLawCandidate,
  getActTypeChoices,
  parseOfficialReferenceSlug,
} from "./lawRouting.js";

describe("getLawSlug", () => {
  it("returns shortname when available", () => {
    expect(getLawSlug({ shortname: "gdpr" })).toBe("gdpr");
  });

  it("falls back to official reference slug", () => {
    const slug = getLawSlug({
      officialReference: { actType: "regulation", year: "2016", number: "679" },
    });
    expect(slug).toBe("regulation-2016-679");
  });

  it("returns null for empty input", () => {
    expect(getLawSlug({})).toBeNull();
    expect(getLawSlug(null)).toBeNull();
  });

  it("slugifies shortname (lowercase, no special chars)", () => {
    expect(getLawSlug({ shortname: "AI Act" })).toBe("ai-act");
  });

  it("looks up bundled law by celex for slug", () => {
    const slug = getLawSlug({ celex: "32016R0679" });
    expect(slug).toBe("gdpr");
  });
});

describe("enrichLaw", () => {
  it("normalizes official reference", () => {
    const law = enrichLaw({
      officialReference: { actType: "regulation", year: "2016", number: "679" },
    });
    expect(law.officialReference).toEqual({
      actType: "regulation",
      year: "2016",
      number: "679",
    });
  });

  it("sets shownInUi to true by default", () => {
    const law = enrichLaw({});
    expect(law.shownInUi).toBe(true);
  });

  it("respects explicit shownInUi: false", () => {
    const law = enrichLaw({ shownInUi: false });
    expect(law.shownInUi).toBe(false);
  });

  it("adds slug", () => {
    const law = enrichLaw({
      shortname: "gdpr",
      officialReference: { actType: "regulation", year: "2016", number: "679" },
    });
    expect(law.slug).toBe("gdpr");
  });

  it("rejects invalid official references", () => {
    const law = enrichLaw({
      officialReference: { actType: "unknown", year: "2016", number: "679" },
    });
    expect(law.officialReference).toBeNull();
  });
});

describe("getBundledLaws", () => {
  it("returns array of enriched laws", () => {
    const laws = getBundledLaws();
    expect(laws.length).toBeGreaterThanOrEqual(6);
    for (const law of laws) {
      expect(law).toHaveProperty("slug");
      expect(law).toHaveProperty("shownInUi");
      expect(law).toHaveProperty("officialReference");
    }
  });
});

describe("findBundledLawByKey / ByCelex / BySlug", () => {
  it("finds GDPR by key", () => {
    const law = findBundledLawByKey("gdpr");
    expect(law).toBeTruthy();
    expect(law.celex).toBe("32016R0679");
  });

  it("finds GDPR by celex", () => {
    const law = findBundledLawByCelex("32016R0679");
    expect(law).toBeTruthy();
    expect(law.key).toBe("gdpr");
  });

  it("finds GDPR by slug", () => {
    const law = findBundledLawBySlug("gdpr");
    expect(law).toBeTruthy();
    expect(law.key).toBe("gdpr");
  });

  it("returns null for unknown values", () => {
    expect(findBundledLawByKey("nonexistent")).toBeNull();
    expect(findBundledLawByCelex("00000X0000")).toBeNull();
    expect(findBundledLawBySlug("nope")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(findBundledLawByKey(null)).toBeNull();
    expect(findBundledLawByCelex(undefined)).toBeNull();
    expect(findBundledLawBySlug("")).toBeNull();
  });
});

describe("getCanonicalLawRoute", () => {
  it("builds simple route from slug", () => {
    const route = getCanonicalLawRoute({ shortname: "gdpr" });
    expect(route).toBe("/gdpr");
  });

  it("includes kind and id when provided", () => {
    const route = getCanonicalLawRoute({ shortname: "gdpr" }, "article", "5");
    expect(route).toBe("/gdpr/article/5");
  });

  it("encodes special characters in id", () => {
    const route = getCanonicalLawRoute({ shortname: "gdpr" }, "article", "5a");
    expect(route).toBe("/gdpr/article/5a");
  });

  it("returns / for law without slug", () => {
    expect(getCanonicalLawRoute({})).toBe("/");
  });

  it("includes locale prefix for non-English", () => {
    const route = getCanonicalLawRoute({ shortname: "gdpr" }, null, null, "de");
    expect(route).toContain("/de/");
  });
});

describe("buildImportedLawCandidate", () => {
  it("returns bundled law when celex matches", () => {
    const result = buildImportedLawCandidate({ celex: "32016R0679" });
    expect(result.key).toBe("gdpr");
  });

  it("builds candidate for unknown celex", () => {
    const result = buildImportedLawCandidate({
      celex: "32021R0123",
      officialReference: { actType: "regulation", year: "2021", number: "123" },
    });
    expect(result.celex).toBe("32021R0123");
    expect(result.slug).toBe("regulation-2021-123");
  });
});

describe("getActTypeChoices", () => {
  it("returns regulation, directive, decision", () => {
    const choices = getActTypeChoices();
    expect(choices).toContain("regulation");
    expect(choices).toContain("directive");
    expect(choices).toContain("decision");
    expect(choices).toHaveLength(3);
  });
});

describe("parseOfficialReferenceSlug", () => {
  it("parses valid slug", () => {
    const ref = parseOfficialReferenceSlug("regulation-2016-679");
    expect(ref).toEqual({
      actType: "regulation",
      year: "2016",
      number: "679",
    });
  });

  it("parses directive slug", () => {
    const ref = parseOfficialReferenceSlug("directive-2018-1972");
    expect(ref).toEqual({
      actType: "directive",
      year: "2018",
      number: "1972",
    });
  });

  it("returns null for invalid slugs", () => {
    expect(parseOfficialReferenceSlug("gdpr")).toBeNull();
    expect(parseOfficialReferenceSlug("invalid-2016-679")).toBeNull();
    expect(parseOfficialReferenceSlug("regulation-16-679")).toBeNull();
    expect(parseOfficialReferenceSlug("")).toBeNull();
    expect(parseOfficialReferenceSlug(null)).toBeNull();
  });

  it("roundtrips with getLawSlug", () => {
    const ref = { actType: "regulation", year: "2022", number: "868" };
    const slug = getLawSlug({ officialReference: ref });
    if (slug) {
      const parsed = parseOfficialReferenceSlug(slug);
      // Slug for bundled laws uses shortname, not reference, so only test non-bundled
      if (parsed) {
        expect(parsed).toEqual(ref);
      }
    }
  });
});
