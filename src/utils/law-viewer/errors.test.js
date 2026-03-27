import { describe, expect, it } from "vitest";
import { FormexApiError } from "../formexApi.js";
import { getLoadErrorDetails, isMissingStructuredLawText } from "./errors.js";

const t = (key) => key;

describe("isMissingStructuredLawText", () => {
  it("detects formex-not-found errors", () => {
    expect(isMissingStructuredLawText(new FormexApiError("Formex not found", { status: 404 }))).toBe(true);
  });
});

describe("getLoadErrorDetails", () => {
  it("maps missing structured text to notice tone", () => {
    const details = getLoadErrorDetails(new FormexApiError("Formex not found", { status: 404 }), t);
    expect(details.tone).toBe("notice");
    expect(details.title).toBe("lawViewer.notAvailableTitle");
  });

  it("maps generic errors to error tone", () => {
    const details = getLoadErrorDetails(new Error("boom"), t);
    expect(details.tone).toBe("error");
    expect(details.message).toContain("boom");
  });
});
