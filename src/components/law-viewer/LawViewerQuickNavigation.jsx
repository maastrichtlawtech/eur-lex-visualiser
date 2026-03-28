import { Info } from "lucide-react";
import { NavigationControls } from "../NavigationControls.jsx";
import { NumberSelector } from "../NumberSelector.jsx";

export function LawViewerQuickNavigation({
  selected,
  lists,
  onPrevNext,
  selectArticleIdx,
  selectRecitalIdx,
  selectAnnexIdx,
  closeMobileMenu,
  t,
}) {
  return (
    <div>
      <div className="px-1 mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t("lawViewer.quickNavigation")}</span>
        <div className="group relative">
          <Info size={14} className="cursor-help text-gray-400" />
          <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-2 w-48 rounded bg-gray-900 p-2 text-xs text-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
            {t("lawViewer.quickNavigationHelp")}
          </div>
        </div>
      </div>

      <div className="hidden md:block mb-4">
        <NavigationControls
          selected={selected}
          lists={lists}
          onPrevNext={onPrevNext}
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-3">
        {lists.articles?.length > 0 ? (
          <NumberSelector
            label={t("common.article")}
            total={lists.articles.length}
            onSelect={(number) => {
              const index = lists.articles.findIndex((article) => parseInt(article.article_number, 10) === number);
              if (index !== -1) selectArticleIdx(index);
              else selectArticleIdx(number - 1);
              closeMobileMenu();
            }}
          />
        ) : null}
        {lists.recitals?.length > 0 ? (
          <NumberSelector
            label={t("common.recital")}
            total={lists.recitals.length}
            onSelect={(number) => {
              selectRecitalIdx(number - 1);
              closeMobileMenu();
            }}
          />
        ) : null}
        {lists.annexes?.length > 0 ? (
          <NumberSelector
            label={t("common.annex")}
            total={lists.annexes.length}
            onSelect={(number) => {
              selectAnnexIdx(number - 1);
              closeMobileMenu();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
