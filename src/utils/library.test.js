import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock formexApi module since it uses IndexedDB
vi.mock("./formexApi.js", () => ({
  getAllLawMeta: vi.fn().mockResolvedValue([]),
  listCachedCelexes: vi.fn().mockResolvedValue([]),
  upsertLawMeta: vi.fn().mockResolvedValue({}),
}));

const { saveLawMeta, markLawOpened, getLibraryLaws } = await import("./library.js");
const { getAllLawMeta, listCachedCelexes, upsertLawMeta } = await import("./formexApi.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveLawMeta", () => {
  it("returns null for missing celex", async () => {
    expect(await saveLawMeta({})).toBeNull();
    expect(await saveLawMeta(null)).toBeNull();
  });

  it("calls upsertLawMeta with normalized data", async () => {
    upsertLawMeta.mockResolvedValue({ celex: "32016R0679" });
    await saveLawMeta({
      celex: "32016R0679",
      label: "GDPR",
    });
    expect(upsertLawMeta).toHaveBeenCalledWith(
      "32016R0679",
      expect.objectContaining({
        label: "GDPR",
        eurlex: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679",
        officialReference: {
          actType: "regulation",
          year: "2016",
          number: "679",
        },
      })
    );
  });
});

describe("markLawOpened", () => {
  it("returns null for empty celex", async () => {
    expect(await markLawOpened("")).toBeNull();
    expect(await markLawOpened(null)).toBeNull();
  });

  it("sets lastOpened timestamp", async () => {
    upsertLawMeta.mockResolvedValue({});
    await markLawOpened("32016R0679");
    expect(upsertLawMeta).toHaveBeenCalledWith(
      "32016R0679",
      expect.objectContaining({
        lastOpened: expect.any(Number),
      })
    );
  });
});

describe("getLibraryLaws", () => {
  it("returns curated flagship laws when no cached/meta data", async () => {
    getAllLawMeta.mockResolvedValue([]);
    listCachedCelexes.mockResolvedValue([]);

    const laws = await getLibraryLaws();
    expect(laws.length).toBeGreaterThanOrEqual(4);
    expect(laws.some((law) => law.slug === "gdpr")).toBe(true);
    expect(laws.some((law) => law.slug === "dma")).toBe(true);
  });

  it("includes imported laws from cache", async () => {
    getAllLawMeta.mockResolvedValue([
      { celex: "32021R0123", label: "Test Regulation", officialReference: { actType: "regulation", year: "2021", number: "123" } },
    ]);
    listCachedCelexes.mockResolvedValue(["32021R0123"]);

    const laws = await getLibraryLaws();
    const imported = laws.find((l) => l.celex === "32021R0123");
    expect(imported).toBeTruthy();
    expect(imported.kind).toBe("imported");
  });

  it("returns one entry per cached celex", async () => {
    getAllLawMeta.mockResolvedValue([
      { celex: "32016R0679", label: "General Data Protection Regulation" },
    ]);
    listCachedCelexes.mockResolvedValue(["32016R0679"]);

    const laws = await getLibraryLaws();
    const gdprEntries = laws.filter((l) => l.celex === "32016R0679");
    expect(gdprEntries).toHaveLength(1);
  });

  it("sorts by lastOpened timestamp descending", async () => {
    getAllLawMeta.mockResolvedValue([
      { celex: "32016R0679", lastOpened: 1000 },
      { celex: "32024R1689", lastOpened: 2000 },
    ]);
    listCachedCelexes.mockResolvedValue([]);

    const laws = await getLibraryLaws();
    const aiIdx = laws.findIndex((l) => l.celex === "32024R1689");
    const gdprIdx = laws.findIndex((l) => l.celex === "32016R0679");
    expect(aiIdx).toBeLessThan(gdprIdx);
  });
});
