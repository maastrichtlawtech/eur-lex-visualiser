import { describe, expect, it } from "vitest";
import { buildExternalLawOverview, buildToc } from "./content.js";

describe("buildToc", () => {
  it("groups articles by chapter and section", () => {
    const toc = buildToc([
      {
        article_number: "1",
        division: {
          chapter: { number: "I", title: "General" },
        },
      },
      {
        article_number: "2",
        division: {
          chapter: { number: "I", title: "General" },
          section: { number: "1", title: "Scope" },
        },
      },
    ]);

    expect(toc).toHaveLength(1);
    expect(toc[0].label).toBe("I — General");
    expect(toc[0].items).toHaveLength(1);
    expect(toc[0].sections[0].label).toBe("1 — Scope");
    expect(toc[0].sections[0].items).toHaveLength(1);
  });
});

describe("buildExternalLawOverview", () => {
  it("aggregates and sorts external references by frequency", () => {
    const overview = buildExternalLawOverview({
      article_1: [
        { type: "external", raw: "GDPR" },
        { type: "external", raw: "GDPR" },
        { type: "oj_ref", raw: "OJ L 119", ojColl: "L", ojNo: "119", ojYear: "2024" },
      ],
    }, "EN");

    expect(overview).toHaveLength(2);
    expect(overview[0].label).toBe("GDPR");
    expect(overview[0].count).toBe(2);
    expect(overview[1].label).toBe("OJ L 119");
  });
});
