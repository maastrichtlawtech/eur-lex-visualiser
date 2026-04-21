import { useEffect, useState } from "react";
import { loadCaseLaw } from "../../utils/caseLawCache.js";

/**
 * Fetches (or reuses cached) case-law list for a law.
 * Returns { cases, loading, loaded, error }.
 *
 * When autoLoad is true, fetches as soon as the celex is available. When
 * false, consumers must call `trigger()` to start the fetch.
 */
export function useCaseLaw(celex, { autoLoad = true } = {}) {
  const [cases, setCases] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [manualTrigger, setManualTrigger] = useState(false);

  useEffect(() => {
    setCases(null);
    setLoaded(false);
    setLoading(false);
    setError(null);
    setManualTrigger(false);
  }, [celex]);

  useEffect(() => {
    if (!celex) return;
    if (!autoLoad && !manualTrigger) return;
    let cancelled = false;
    setLoading(true);
    loadCaseLaw(celex)
      .then((r) => {
        if (cancelled) return;
        setCases(r.cases || []);
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setCases([]);
        setLoaded(true);
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [celex, autoLoad, manualTrigger]);

  return {
    cases,
    loading,
    loaded,
    error,
    trigger: () => setManualTrigger(true),
  };
}
