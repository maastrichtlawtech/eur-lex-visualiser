import { useCallback, useEffect, useMemo, useState } from "react";
import { lawLangFromUiLocale, uiLocaleFromLawLang } from "../../i18n/localeMeta.js";
import { SECONDARY_LANGUAGE_STORAGE_KEY } from "../../utils/law-viewer/constants.js";
import { getPreferredSecondaryLanguage, normalizeExtraLanguage } from "../../utils/law-viewer/preferences.js";

export function useLawViewerPreferences({
  locale,
  setLocale,
  pathname,
  searchParams,
  setSearchParams,
}) {
  const isImportRoute = pathname === "/import" || pathname.startsWith("/import/");
  const isLegacyLawRoute = pathname.startsWith("/law/");

  const [fontScale, setFontScale] = useState(() => {
    try {
      return parseInt(localStorage.getItem("legalviz-fontscale") || "2", 10);
    } catch {
      return 2;
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem("legalviz-sidebar") !== "false";
    } catch {
      return true;
    }
  });
  const [formexLang, setFormexLang] = useState(() => {
    try {
      return localStorage.getItem("legalviz-formex-lang") || "EN";
    } catch {
      return "EN";
    }
  });

  const effectivePrimaryLang = useMemo(() => (
    !isImportRoute && !isLegacyLawRoute ? lawLangFromUiLocale(locale) : formexLang
  ), [formexLang, isImportRoute, isLegacyLawRoute, locale]);

  const secondaryLangParam = normalizeExtraLanguage(searchParams.get("lang2"));
  const secondaryLang = secondaryLangParam && secondaryLangParam !== effectivePrimaryLang ? secondaryLangParam : null;

  useEffect(() => {
    localStorage.setItem("legalviz-fontscale", fontScale);
  }, [fontScale]);

  useEffect(() => {
    localStorage.setItem("legalviz-sidebar", isSidebarOpen);
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("legalviz-formex-lang", formexLang);
  }, [formexLang]);

  useEffect(() => {
    const expectedLawLang = lawLangFromUiLocale(locale);
    if (!isImportRoute && !isLegacyLawRoute && formexLang !== expectedLawLang) {
      setFormexLang(expectedLawLang);
    }
  }, [formexLang, isImportRoute, isLegacyLawRoute, locale]);

  const updateViewerSearchParams = useCallback((mutate) => {
    const nextParams = new URLSearchParams(searchParams);
    mutate(nextParams);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const setSecondaryLanguage = useCallback((nextLang) => {
    updateViewerSearchParams((params) => {
      const normalized = normalizeExtraLanguage(nextLang);
      if (!normalized || normalized === effectivePrimaryLang) {
        params.delete("lang2");
        return;
      }

      try {
        localStorage.setItem(SECONDARY_LANGUAGE_STORAGE_KEY, normalized);
      } catch {
        // ignore persistence failures
      }
      params.set("lang2", normalized);
    });
  }, [effectivePrimaryLang, updateViewerSearchParams]);

  const handleUnifiedLanguageChange = useCallback((nextLang) => {
    setFormexLang(nextLang);
    setLocale(uiLocaleFromLawLang(nextLang));

    if (normalizeExtraLanguage(searchParams.get("lang2")) === nextLang) {
      updateViewerSearchParams((params) => {
        params.delete("lang2");
      });
    }
  }, [searchParams, setLocale, updateViewerSearchParams]);

  const toggleSecondLanguage = useCallback(() => {
    if (secondaryLangParam && secondaryLangParam !== formexLang) {
      setSecondaryLanguage(null);
      return;
    }
    setSecondaryLanguage(getPreferredSecondaryLanguage(formexLang));
  }, [formexLang, secondaryLangParam, setSecondaryLanguage]);

  useEffect(() => {
    if (!secondaryLang) return;
    try {
      localStorage.setItem(SECONDARY_LANGUAGE_STORAGE_KEY, secondaryLang);
    } catch {
      // ignore persistence failures
    }
  }, [secondaryLang]);

  useEffect(() => {
    if (!secondaryLangParam || secondaryLangParam !== effectivePrimaryLang) return;
    updateViewerSearchParams((params) => {
      params.delete("lang2");
    });
  }, [effectivePrimaryLang, secondaryLangParam, updateViewerSearchParams]);

  return {
    formexLang,
    setFormexLang,
    fontScale,
    setFontScale,
    isSidebarOpen,
    setIsSidebarOpen,
    isImportRoute,
    isLegacyLawRoute,
    effectivePrimaryLang,
    secondaryLang,
    setSecondaryLanguage,
    handleUnifiedLanguageChange,
    toggleSecondLanguage,
  };
}
