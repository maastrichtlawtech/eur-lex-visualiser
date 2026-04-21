import { useEffect, useState } from "react";
import { mapRecitalsToArticles, NLP_VERSION, RECITAL_MAP_VERSION } from "../../utils/nlp.js";
import { API_BASE, toApiLang } from "../../utils/formexApi.js";

const DISABLE_RECITAL_MAP_FALLBACK =
  typeof import.meta !== "undefined"
  && import.meta.env?.VITE_DISABLE_RECITAL_MAP_FALLBACK === "1";

export function useRecitalMap({ data, currentLaw, formexLang }) {
  const [recitalMap, setRecitalMap] = useState(new Map());

  useEffect(() => {
    const articles = data.articles || [];
    const recitals = data.recitals || [];

    if (articles.length === 0 || recitals.length === 0) {
      setRecitalMap(new Map());
      return undefined;
    }

    try {
      const keysToRemove = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;

        const isOldNlpKey = key.startsWith("nlp_map_") || (key.startsWith("nlp_v") && !key.startsWith(`nlp_v${NLP_VERSION}_`));
        const isOldRecitalMapKey = key.startsWith("rmap_v") && !key.startsWith(`rmap_v${RECITAL_MAP_VERSION}_`);
        if (isOldNlpKey || isOldRecitalMapKey) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn("Error cleaning up old recital map cache", error);
    }

    const celex = currentLaw?.celex || data.celex || null;
    const apiLang = toApiLang(formexLang);
    const cacheKey = celex ? `rmap_v${RECITAL_MAP_VERSION}_${celex}_${apiLang}` : null;
    let cancelled = false;

    const setAndCacheServerMap = (map) => {
      setRecitalMap(map);
      if (!cacheKey) return;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(Array.from(map.entries())));
      } catch (error) {
        console.warn("Error writing recital map cache", error);
      }
    };

    if (cacheKey && !DISABLE_RECITAL_MAP_FALLBACK) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setRecitalMap(new Map(JSON.parse(cached)));
          return undefined;
        }
      } catch (error) {
        console.warn("Error reading recital map cache", error);
      }
    }

    if (!celex) {
      if (DISABLE_RECITAL_MAP_FALLBACK) {
        console.error("Recital map fetch skipped because no CELEX identifier is available");
        setRecitalMap(new Map());
        return undefined;
      }
      setRecitalMap(mapRecitalsToArticles(recitals, articles));
      return undefined;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/laws/${encodeURIComponent(celex)}/recital-map?lang=${encodeURIComponent(apiLang)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Recital map request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const byArticle = payload?.byArticle;
        if (!byArticle || typeof byArticle !== "object") {
          throw new Error("Invalid recital map payload");
        }

        const nextMap = new Map();
        for (const article of articles) {
          nextMap.set(article.article_number, Array.isArray(byArticle[article.article_number]) ? byArticle[article.article_number] : []);
        }
        for (const [articleId, entries] of Object.entries(byArticle)) {
          if (!nextMap.has(articleId)) {
            nextMap.set(articleId, Array.isArray(entries) ? entries : []);
          }
        }

        if (!cancelled) {
          console.info(`[RecitalMap] Loaded server map for ${celex}_${apiLang}`, {
            model: payload.model,
            articleCount: Object.keys(byArticle).length,
          });
          setAndCacheServerMap(nextMap);
        }
      } catch (error) {
        if (cancelled || error?.name === "AbortError") {
          return;
        }
        if (DISABLE_RECITAL_MAP_FALLBACK) {
          console.error("Recital map fetch failed and fallback is disabled", error);
          setRecitalMap(new Map());
          return;
        }

        const fallback = mapRecitalsToArticles(recitals, articles);
        setRecitalMap(fallback);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentLaw?.celex, data.celex, data.articles, data.recitals, formexLang]);

  return recitalMap;
}
