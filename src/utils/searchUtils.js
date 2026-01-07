import { LAWS } from "../constants/laws.js";
import { fetchText } from "./fetch.js";
import { parseAnyToCombined } from "./parsers.js";

/**
 * Fetch a custom law from the extension via window message.
 * @param {string} key 
 * @returns {Promise<Object|null>}
 */
const fetchCustomLaw = (key) => {
    return new Promise((resolve) => {
        const handleMsg = (event) => {
            if (event.source !== window) return;
            if (event.data.type === 'EURLEX_LAW_DATA') {
                window.removeEventListener('message', handleMsg);
                resolve(event.data.payload);
            }
        };
        window.addEventListener('message', handleMsg);
        window.postMessage({ type: 'EURLEX_GET_LAW', key }, '*');

        // Timeout safety
        setTimeout(() => {
            window.removeEventListener('message', handleMsg);
            resolve(null);
        }, 2000);
    });
};

/**
 * Fetch content for all available laws (standard + custom), excluding hidden ones.
 * @param {Array<string>} hiddenLaws - List of law keys to exclude
 * @param {Array<Object>} customLaws - List of custom law objects { key, title, ... }
 * @returns {Promise<Object>} - specific combined object { articles, recitals, annexes }
 */
export async function fetchAllLaws(hiddenLaws = [], customLaws = []) {
    const combined = { articles: [], recitals: [], annexes: [] };

    try {
        // 1. Fetch Standard Laws
        const standardPromises = LAWS.map(async (law) => {
            try {
                if (hiddenLaws.includes(law.key)) return null;

                const text = await fetchText(law.value);
                const parsed = parseAnyToCombined(text);

                parsed.articles?.forEach(a => {
                    a.law_key = law.key;
                    a.law_label = law.label;
                });
                parsed.recitals?.forEach(r => {
                    r.law_key = law.key;
                    r.law_label = law.label;
                });
                parsed.annexes?.forEach(a => {
                    a.law_key = law.key;
                    a.law_label = law.label;
                });

                return parsed;
            } catch (e) {
                console.error(`Failed to load law ${law.key} for search index`, e);
                return null;
            }
        });

        // 2. Fetch Custom Laws (Sequentially to avoid bridge congestion/race conditions)
        const customLawResults = [];
        if (customLaws.length > 0) {
            for (const l of customLaws) {
                try {
                    // Skip if hidden
                    if (hiddenLaws.includes(l.key)) continue;

                    const data = await fetchCustomLaw(l.key);
                    if (data && data.html) {
                        const parsed = parseAnyToCombined(data.html);

                        // Use metadata title if available
                        const title = data.metadata?.title || l.title || "Custom Law";

                        parsed.articles?.forEach(a => {
                            a.law_key = l.key;
                            a.law_label = title;
                        });
                        parsed.recitals?.forEach(r => {
                            r.law_key = l.key;
                            r.law_label = title;
                        });
                        parsed.annexes?.forEach(a => {
                            a.law_key = l.key;
                            a.law_label = title;
                        });
                        customLawResults.push(parsed);
                    }
                } catch (e) {
                    console.error("Failed to load custom law for search", l.key, e);
                }
            }
        }

        const standardResults = await Promise.allSettled(standardPromises);

        standardResults.forEach((res) => {
            if (res.status === 'fulfilled' && res.value) {
                combined.articles.push(...(res.value.articles || []));
                combined.recitals.push(...(res.value.recitals || []));
                combined.annexes.push(...(res.value.annexes || []));
            }
        });

        customLawResults.forEach((res) => {
            combined.articles.push(...(res.articles || []));
            combined.recitals.push(...(res.recitals || []));
            combined.annexes.push(...(res.annexes || []));
        });

        return combined;
    } catch (e) {
        console.error("Error loading search data", e);
        return combined; // Return partial or empty on error
    }
}
