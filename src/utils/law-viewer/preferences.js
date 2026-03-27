import { EU_LANGUAGES } from "../formexApi.js";
import { SECONDARY_LANGUAGE_STORAGE_KEY } from "./constants.js";

export function normalizeExtraLanguage(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(EU_LANGUAGES, normalized) ? normalized : null;
}

export function getPreferredSecondaryLanguage(primaryLang) {
  const stored = normalizeExtraLanguage(
    typeof window !== "undefined"
      ? window.localStorage.getItem(SECONDARY_LANGUAGE_STORAGE_KEY)
      : null
  );

  if (stored && stored !== primaryLang) return stored;
  if (primaryLang !== "EN") return "EN";
  if (primaryLang !== "DE") return "DE";
  if (primaryLang !== "FR") return "FR";
  return "ES";
}
