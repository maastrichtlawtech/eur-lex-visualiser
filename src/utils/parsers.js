import { isFmxDocument, parseFmxToCombined } from "./fmxParser.js";

export function parseFormexToCombined(text) {
  if (!isFmxDocument(text)) {
    throw new Error("Expected cached Formex XML content.");
  }

  return parseFmxToCombined(text);
}

function isCombinedLawShape(value) {
  return !!value
    && typeof value === "object"
    && Array.isArray(value.articles)
    && Array.isArray(value.recitals)
    && Array.isArray(value.annexes);
}

export function parseLawPayloadToCombined(value) {
  if (typeof value === "string") {
    return parseFormexToCombined(value);
  }

  if (isCombinedLawShape(value)) {
    return value;
  }

  const payload = value?.format === "combined-v1"
    ? value.payload || value.content || value.data || null
    : null;

  if (isCombinedLawShape(payload)) {
    return payload;
  }

  throw new Error("Expected cached law payload to be Formex XML or combined law JSON.");
}
