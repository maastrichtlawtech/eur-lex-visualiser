import { useMemo } from "react";
import { injectDefinitionTooltips } from "../../utils/definitions.js";

export function useProcessedLawHtml({ data, selected, selectedEntry = null }) {
  return useMemo(() => {
    const selectedHtml = selectedEntry
      ? selectedEntry.article_html || selectedEntry.recital_html || selectedEntry.annex_html || ""
      : selected.html;

    if (!selectedHtml) return "";

    const definitionEntry = selected.kind === "article"
      ? selectedEntry || data.articles.find((article) => article.article_number === selected.id)
      : null;
    const skipDefinitions = definitionEntry?.article_title &&
      /definitions?|definicj/i.test(definitionEntry.article_title);

    return injectDefinitionTooltips(selectedHtml, data.definitions, {
      skipDefinitionsArticle: skipDefinitions,
      langCode: data.langCode,
    });
  }, [data.articles, data.definitions, data.langCode, selected, selectedEntry]);
}
