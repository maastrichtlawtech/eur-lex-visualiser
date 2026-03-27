import { useMemo } from "react";
import { buildEurlexCelexUrl, buildEurlexSearchUrl } from "../../utils/url.js";
import { buildCurrentLawLabel, buildExternalLawOverview, buildSeoData } from "../../utils/law-viewer/content.js";

export function useLawViewerDerivedState({
  source,
  primaryDocument,
  preferences,
  selection,
  sourceUrl,
  searchParams,
  slug,
  key,
  activeLoadError,
  t,
}) {
  const activeLoading = source.loading || primaryDocument.loading;
  const hasLoadedContent = primaryDocument.data.articles.length > 0
    || primaryDocument.data.recitals.length > 0
    || primaryDocument.data.annexes.length > 0;
  const hasCelex = !!source.effectiveCelex;
  const isSideBySide = !!preferences.secondaryLang && !!source.effectiveCelex;

  const seoData = useMemo(() => buildSeoData({
    dataTitle: primaryDocument.data.title,
    currentLaw: source.currentLaw,
    selected: selection.selected,
    t,
  }), [primaryDocument.data.title, selection.selected, source.currentLaw, t]);

  const currentLawLabel = useMemo(() => buildCurrentLawLabel({
    dataTitle: primaryDocument.data.title,
    rawReference: searchParams.get("raw"),
    currentLaw: source.currentLaw,
    slugReference: source.slugReference,
  }), [primaryDocument.data.title, searchParams, source.currentLaw, source.slugReference]);

  const loadingMessage = useMemo(() => `Loading ${currentLawLabel || "law"}...`, [currentLawLabel]);

  const eurlexUrl = useMemo(() => {
    if (sourceUrl) return sourceUrl;
    if (source.effectiveCelex) return buildEurlexCelexUrl(source.effectiveCelex, preferences.formexLang);
    return source.currentLaw?.eurlex || null;
  }, [preferences.formexLang, source.currentLaw, source.effectiveCelex, sourceUrl]);

  const externalFallbackUrl = useMemo(() => {
    if (activeLoadError?.fallbackUrl) return activeLoadError.fallbackUrl;
    if (eurlexUrl) return eurlexUrl;

    const referenceLabel = searchParams.get("raw")
      || (source.slugReference ? `${source.slugReference.actType} ${source.slugReference.year}/${source.slugReference.number}` : null)
      || source.currentLaw?.label
      || slug
      || key
      || null;

    return referenceLabel ? buildEurlexSearchUrl(referenceLabel, preferences.formexLang) : null;
  }, [activeLoadError, eurlexUrl, key, preferences.formexLang, searchParams, slug, source.currentLaw, source.slugReference]);

  const externalLawOverview = useMemo(
    () => buildExternalLawOverview(primaryDocument.data.crossReferences, preferences.formexLang),
    [primaryDocument.data.crossReferences, preferences.formexLang]
  );

  return {
    activeLoading,
    hasLoadedContent,
    hasCelex,
    isSideBySide,
    seoData,
    currentLawLabel,
    loadingMessage,
    eurlexUrl,
    externalFallbackUrl,
    externalLawOverview,
  };
}
