export const ARTICLE_NAVIGATION_HINT_DISMISSED_KEY = "legalviz-article-navigation-hint-dismissed";

export function shouldShowArticleNavigationHint({ selected, articleCount, isDismissed }) {
  return Boolean(
    !isDismissed
    && selected?.kind === "article"
    && Number(articleCount || 0) > 1
  );
}
