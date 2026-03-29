import { useCallback, useEffect, useMemo, useState } from "react";
import { buildEurlexCelexUrl, buildEurlexSearchUrl } from "../../utils/url.js";
import { findCachedCelexByOfficialReference, markLawOpened, saveLawMeta } from "../../utils/library.js";
import {
  buildImportedLawCandidate,
  findBundledLawBySlug,
  getCanonicalLawRoute,
  parseOfficialReferenceSlug,
} from "../../utils/lawRouting.js";
import { getLoadErrorDetails } from "../../utils/law-viewer/errors.js";
import { resolveEurlexUrl, resolveOfficialReference } from "../../utils/formexApi.js";

export function useLawViewerSource({
  slug,
  key,
  kind,
  id,
  importCelex,
  sourceUrl,
  locale,
  routeLocale,
  pathname,
  locationSearch,
  navigate,
  formexLang,
  t,
  localizePath,
}) {
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [resolvedCelex, setResolvedCelex] = useState(null);

  const isImportRoute = pathname === "/import" || pathname.startsWith("/import/");
  const isLegacyLawRoute = pathname.startsWith("/law/");
  const slugReference = useMemo(() => (slug ? parseOfficialReferenceSlug(slug) : null), [slug]);
  const derivedSlugLaw = useMemo(() => {
    const bundledLaw = findBundledLawBySlug(slug);
    if (bundledLaw) return bundledLaw;
    if (!slugReference) return null;
    return buildImportedLawCandidate({ officialReference: slugReference, slug });
  }, [slug, slugReference]);
  const currentLaw = useMemo(() => derivedSlugLaw || null, [derivedSlugLaw]);
  const currentCelex = importCelex || currentLaw?.celex || null;
  const effectiveCelex = currentCelex || resolvedCelex || null;
  const currentLawSlug = currentLaw?.slug || null;
  const canonicalRoute = useMemo(() => {
    if (!currentLawSlug) return null;
    return getCanonicalLawRoute(currentLaw, kind, id, routeLocale || locale);
  }, [currentLaw, currentLawSlug, kind, id, routeLocale, locale]);

  const navigateToCanonical = useCallback((kindName, targetId, options = {}) => {
    if (!currentLawSlug) return;
    const nextPath = getCanonicalLawRoute(currentLaw, kindName, targetId, routeLocale || locale);
    navigate(`${nextPath}${locationSearch}`, options);
  }, [currentLaw, currentLawSlug, locale, locationSearch, navigate, routeLocale]);

  const retryLoad = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    setResolvedCelex(null);
    setLoadError(null);
  }, [importCelex, key, slug]);

  useEffect(() => {
    if (currentCelex || !slugReference) return;

    let cancelled = false;
    findCachedCelexByOfficialReference(slugReference)
      .then((cachedCelex) => {
        if (!cancelled && cachedCelex) setResolvedCelex(cachedCelex);
      })
      .catch(() => {
        // ignore local metadata lookup failures
      });

    return () => {
      cancelled = true;
    };
  }, [currentCelex, slugReference]);

  useEffect(() => {
    if (!sourceUrl || importCelex) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    resolveEurlexUrl(sourceUrl, formexLang)
      .then((result) => {
        if (cancelled) return;

        const nextCelex = result?.resolved?.celex;
        if (!nextCelex) {
          setLoadError({
            title: t("lawViewer.lawLoadFailed"),
            message: t("lawViewer.importResolveFailed"),
            fallbackUrl: sourceUrl,
            status: result?.status || null,
          });
          setLoading(false);
          return;
        }

        const resolvedReference = result?.parsed?.reference || null;
        if (resolvedReference?.actType && resolvedReference?.year && resolvedReference?.number) {
          const target = buildImportedLawCandidate({
            celex: nextCelex,
            officialReference: resolvedReference,
          });
          navigate(getCanonicalLawRoute(target, null, null, locale), { replace: true });
          return;
        }

        const params = new URLSearchParams();
        params.set("celex", nextCelex);
        navigate(`/import?${params.toString()}`, { replace: true });
      })
      .catch((error) => {
        if (cancelled) return;
        const details = getLoadErrorDetails(error, t);
        setLoadError({
          ...details,
          fallbackUrl: details.fallbackUrl || sourceUrl,
        });
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formexLang, importCelex, locale, navigate, sourceUrl, t, loadAttempt]);

  useEffect(() => {
    if (!canonicalRoute) return;
    if (isLegacyLawRoute || (isImportRoute && effectiveCelex && currentLawSlug)) {
      navigate(`${canonicalRoute}${locationSearch}`, { replace: true });
    }
  }, [canonicalRoute, currentLawSlug, effectiveCelex, isImportRoute, isLegacyLawRoute, locationSearch, navigate]);

  useEffect(() => {
    if (!slugReference) return;
    if (effectiveCelex) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const resolveSlugReference = async () => {
      const cachedCelex = await findCachedCelexByOfficialReference(slugReference);
      if (cachedCelex) {
        return { resolved: { celex: cachedCelex } };
      }
      return resolveOfficialReference(slugReference, formexLang);
    };

    resolveSlugReference()
      .then((result) => {
        if (cancelled) return;

        const nextCelex = result?.resolved?.celex;
        if (!nextCelex) {
          setLoadError({
            title: t("lawViewer.lawLoadFailed"),
            message: t("lawViewer.referenceResolveFailed"),
            fallbackUrl: result?.fallback?.url
              || buildEurlexSearchUrl(`${slugReference.actType} ${slugReference.year}/${slugReference.number}`, formexLang),
            status: result?.status || null,
          });
          setLoading(false);
          return;
        }

        setResolvedCelex(nextCelex);
        saveLawMeta({
          celex: nextCelex,
          officialReference: slugReference,
          label: currentLaw?.label || `${slugReference.actType} ${slugReference.year}/${slugReference.number}`,
          eurlex: buildEurlexCelexUrl(nextCelex, formexLang),
        }).then(() => markLawOpened(nextCelex));
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getLoadErrorDetails(error, t));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentLaw, effectiveCelex, formexLang, slugReference, t]);

  useEffect(() => {
    if (sourceUrl && !effectiveCelex) return;
    if (!effectiveCelex && slugReference) return;

    if (!effectiveCelex && (key || slug)) {
      navigate(localizePath("/", locale), { replace: true });
    }
  }, [effectiveCelex, key, locale, localizePath, navigate, slug, slugReference, sourceUrl, loadAttempt]);

  return {
    currentLaw,
    currentLawSlug,
    currentCelex,
    effectiveCelex,
    canonicalRoute,
    slugReference,
    loadError,
    loading,
    retryLoad,
    navigateToCanonical,
  };
}
