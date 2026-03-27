import { Info, Menu } from "lucide-react";
import { NavigationControls } from "../NavigationControls.jsx";
import { NumberSelector } from "../NumberSelector.jsx";

export function LawViewerQuickNavigation({
  selected,
  lists,
  mobileMenuOpen,
  setMobileMenuOpen,
  onPrevNext,
  selectArticleIdx,
  selectRecitalIdx,
  selectAnnexIdx,
  closeMobileMenu,
  t,
}) {
  return (
    <div>
      <div className="flex gap-2 mb-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          title={t("lawViewer.toggleContents")}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <NavigationControls
            selected={selected}
            lists={lists}
            onPrevNext={onPrevNext}
            className="h-full w-full"
          />
        </div>
      </div>

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
