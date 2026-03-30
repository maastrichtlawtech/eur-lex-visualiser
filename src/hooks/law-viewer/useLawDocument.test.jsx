import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormexApiError } from "../../utils/formexApi.js";
import { useLawDocument } from "./useLawDocument.js";

const {
  mockFetchFormex,
  mockFetchParsedLaw,
  mockGetCachedLawPayload,
  mockParseLawPayloadToCombined,
} = vi.hoisted(() => ({
  mockFetchFormex: vi.fn(),
  mockFetchParsedLaw: vi.fn(),
  mockGetCachedLawPayload: vi.fn(),
  mockParseLawPayloadToCombined: vi.fn(),
}));

vi.mock("../../utils/formexApi.js", async () => {
  const actual = await vi.importActual("../../utils/formexApi.js");
  return {
    ...actual,
    fetchFormex: mockFetchFormex,
    fetchParsedLaw: mockFetchParsedLaw,
    getCachedLawPayload: mockGetCachedLawPayload,
  };
});

vi.mock("../../utils/parsers.js", () => ({
  parseLawPayloadToCombined: mockParseLawPayloadToCombined,
}));

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useLawDocument", () => {
  let container;
  let root;
  let latestValue;

  function Probe(props) {
    latestValue = useLawDocument(props);
    return null;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestValue = null;

    mockFetchFormex.mockReset();
    mockFetchParsedLaw.mockReset();
    mockGetCachedLawPayload.mockReset().mockResolvedValue(null);
    mockParseLawPayloadToCombined.mockReset().mockImplementation((value) => value);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    container?.remove();
  });

  it("falls back to parsed-law JSON when FMX is unavailable", async () => {
    mockFetchFormex.mockRejectedValue(new FormexApiError("No Formex data", {
      status: 404,
      code: "fmx_not_found",
    }));
    mockFetchParsedLaw.mockResolvedValue({
      title: "Directive 2002/58/EC",
      articles: [],
      recitals: [],
      annexes: [],
      definitions: [],
      langCode: "EN",
      crossReferences: {},
    });

    await act(async () => {
      root.render(<Probe celex="32002L0058" lang="EN" t={(key) => key} enabled />);
      await flushEffects();
    });

    expect(mockFetchFormex).toHaveBeenCalledWith("32002L0058", "EN");
    expect(mockFetchParsedLaw).toHaveBeenCalledWith("32002L0058", "EN");
    expect(latestValue.data.title).toBe("Directive 2002/58/EC");
    expect(latestValue.loadError).toBeNull();
  });

  it("uses cached combined law payload without network fetches", async () => {
    mockGetCachedLawPayload.mockResolvedValue({
      format: "combined-v1",
      payload: {
        title: "Directive 2015/2366",
        articles: [],
        recitals: [],
        annexes: [],
        definitions: [],
        langCode: "EN",
        crossReferences: {},
      },
    });
    mockParseLawPayloadToCombined.mockImplementation((value) => value.payload || value);

    await act(async () => {
      root.render(<Probe celex="32015L2366" lang="EN" t={(key) => key} enabled />);
      await flushEffects();
    });

    expect(mockGetCachedLawPayload).toHaveBeenCalledWith("32015L2366", "EN");
    expect(mockFetchFormex).not.toHaveBeenCalled();
    expect(mockFetchParsedLaw).not.toHaveBeenCalled();
    expect(latestValue.data.title).toBe("Directive 2015/2366");
    expect(latestValue.loadError).toBeNull();
  });
});
