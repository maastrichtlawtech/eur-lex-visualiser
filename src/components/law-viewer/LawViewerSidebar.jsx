import { Accordion } from "../Accordion.jsx";
import { MetadataPanel } from "../MetadataPanel.jsx";
import { LawViewerQuickNavigation } from "./LawViewerQuickNavigation.jsx";
import { LawViewerToc } from "./LawViewerToc.jsx";

export function LawViewerSidebar({
  isSidebarOpen,
  mobileMenuOpen,
  selected,
  data,
  onPrevNext,
  selection,
  loading,
  loadError,
  hasLoadedContent,
  externalLawOverview,
  handleOpenExternalLaw,
  effectiveCelex,
  formexLang,
  t,
}) {
  return (
    <aside className={`order-1 w-full md:order-2 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:w-80 md:shrink-0 md:overflow-y-auto transition-all duration-300 ${!isSidebarOpen ? "md:hidden" : ""}`}>
      <div className={`space-y-4 ${mobileMenuOpen ? "block" : "hidden md:block"}`}>
        <LawViewerQuickNavigation
          selected={selected}
          lists={{ articles: data.articles, recitals: data.recitals, annexes: data.annexes }}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={selection.setMobileMenuOpen}
          onPrevNext={onPrevNext}
          selectArticleIdx={selection.selectArticleIdx}
          selectRecitalIdx={selection.selectRecitalIdx}
          selectAnnexIdx={selection.selectAnnexIdx}
          closeMobileMenu={selection.closeMobileMenu}
          t={t}
        />

        <div className="pt-2">
          <div className="px-1 mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("lawViewer.tableOfContents")}
          </div>
          <LawViewerToc
            loading={loading}
            loadError={loadError}
            hasLoadedContent={hasLoadedContent}
            toc={selection.toc}
            openChapter={selection.openChapter}
            setOpenChapter={selection.setOpenChapter}
            annexes={data.annexes}
            isAnnexesOpen={selection.isAnnexesOpen}
            setIsAnnexesOpen={selection.setIsAnnexesOpen}
            selected={selected}
            onClickArticle={selection.onClickArticle}
            onClickAnnex={(annex) => {
              const index = data.annexes.findIndex((entry) => entry.annex_id === annex.annex_id);
              if (index !== -1) selection.selectAnnexIdx(index);
            }}
            closeMobileMenu={selection.closeMobileMenu}
            t={t}
          />
        </div>

        {externalLawOverview.length > 0 ? (
          <div className="pt-4">
            <Accordion title={`Linked Legislation (${externalLawOverview.length})`} defaultOpen={false}>
              <div className="flex flex-wrap gap-2">
                {externalLawOverview.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleOpenExternalLaw(item.ref)}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 transition hover:border-blue-400 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:border-blue-700 dark:hover:bg-blue-950/70"
                  >
                    <span className="max-w-[220px] truncate">{item.label}</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/70 dark:text-blue-200">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </Accordion>
          </div>
        ) : null}

        <MetadataPanel celex={effectiveCelex} currentLang={formexLang} />
      </div>
    </aside>
  );
}
