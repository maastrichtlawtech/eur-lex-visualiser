import { useEffect, useState } from "react";
import { fetchFormex } from "../../utils/formexApi.js";
import { parseFormexToCombined } from "../../utils/parsers.js";
import { EMPTY_LAW_DATA } from "../../utils/law-viewer/constants.js";
import { getLoadErrorDetails } from "../../utils/law-viewer/errors.js";

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

    fetchFormex(celex, secondaryLang)
      .then((text) => {
        if (!cancelled) setData(parseFormexToCombined(text));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getLoadErrorDetails(error, t));
        setData(EMPTY_LAW_DATA);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
