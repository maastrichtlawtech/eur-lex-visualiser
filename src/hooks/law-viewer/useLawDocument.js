import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFormex } from "../../utils/formexApi.js";
import { parseFormexToCombined } from "../../utils/parsers.js";
import { EMPTY_LAW_DATA } from "../../utils/law-viewer/constants.js";
import { getLoadErrorDetails } from "../../utils/law-viewer/errors.js";

export function useLawDocument({ celex, lang, t, enabled = true }) {
  const [data, setData] = useState(EMPTY_LAW_DATA);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !celex) {
      setData(EMPTY_LAW_DATA);
      setLoading(false);
      setLoadError(null);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setLoadError(null);
    setData(EMPTY_LAW_DATA);

    try {
      const text = await fetchFormex(celex, lang);
      if (requestRef.current !== requestId) return;
      setData(parseFormexToCombined(text));
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setLoadError(getLoadErrorDetails(error, t));
      setData(EMPTY_LAW_DATA);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [celex, enabled, lang, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  return {
    data,
    loading,
    loadError,
    reload,
  };
}
