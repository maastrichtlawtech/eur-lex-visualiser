import { useEffect, useState } from "react";
import { fetchFormex, fetchParsedLaw, getCachedLawPayload } from "../../utils/formexApi.js";
import { parseLawPayloadToCombined } from "../../utils/parsers.js";
import { EMPTY_LAW_DATA } from "../../utils/law-viewer/constants.js";
import { getLoadErrorDetails, isMissingStructuredLawText } from "../../utils/law-viewer/errors.js";

export function useSecondaryLawDocument({ celex, secondaryLang, t }) {
  const [data, setData] = useState(EMPTY_LAW_DATA);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!celex || !secondaryLang) {
      setData(EMPTY_LAW_DATA);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setData(EMPTY_LAW_DATA);

    (async () => {
      try {
        let nextData = null;
        const cached = await getCachedLawPayload(celex, secondaryLang);
        if (cached) {
          nextData = parseLawPayloadToCombined(cached);
        } else {
          try {
            const text = await fetchFormex(celex, secondaryLang);
            nextData = parseLawPayloadToCombined(text);
          } catch (error) {
            if (!isMissingStructuredLawText(error)) {
              throw error;
            }
            nextData = parseLawPayloadToCombined(await fetchParsedLaw(celex, secondaryLang));
          }
        }

        if (!cancelled) setData(nextData);
      } catch (error) {
        if (cancelled) return;
        setLoadError(getLoadErrorDetails(error, t));
        setData(EMPTY_LAW_DATA);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })()
      .catch(() => {
        // handled in async IIFE
      });

    return () => {
      cancelled = true;
    };
  }, [celex, secondaryLang, t]);

  return {
    data,
    loading,
    loadError,
  };
}
