import { LanguageSelector } from "../LanguageSelector.jsx";
import { LawContentPane } from "./LawContentPane.jsx";
import { LawDocumentContent } from "./LawDocumentContent.jsx";

export function LawViewerSideBySide({
  isSideBySide,
  secondaryLang,
  setSecondaryLanguage,
  hasCelex,
  formexLang,
  selected,
  secondaryLoading,
  secondaryLoadError,
  secondaryProcessedHtml,
  processedHtml,
  handleContentClick,
  getProseClass,
  getTextClass,
  fontScale,
  isResolvingExternalLaw,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  t,
}) {
  if (!isSideBySide) {
    return (
      <LawDocumentContent
        processedHtml={processedHtml}
        fontScale={fontScale}
        getProseClass={getProseClass}
        getTextClass={getTextClass}
        onContentClick={handleContentClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        isResolvingExternalLaw={isResolvingExternalLaw}
        t={t}
      />
    );
  }

  const secondaryLanguageSelector = (
    <LanguageSelector
      currentLang={secondaryLang}
      onChangeLang={setSecondaryLanguage}
      hasCelex={hasCelex}
      label={t("lawViewer.secondaryLanguage")}
      excludeLanguages={[formexLang]}
      align="right"
      showCode={false}
    />
  );

  return (
    <>
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 xl:hidden dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        {t("lawViewer.sideBySideDesktopOnly")}
      </div>
      <div className="space-y-6 xl:hidden">
        <LawDocumentContent
          processedHtml={processedHtml}
          fontScale={fontScale}
          getProseClass={getProseClass}
          getTextClass={getTextClass}
          onContentClick={handleContentClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          isResolvingExternalLaw={isResolvingExternalLaw}
          t={t}
        />
      </div>
      <div className="hidden gap-6 xl:grid xl:grid-cols-2">
        <LawContentPane
          label={t("lawViewer.primaryLanguage")}
          lang={formexLang}
          hasCelex={hasCelex}
          selected={selected}
          loading={false}
          loadError={null}
          processedHtml={processedHtml}
          onContentClick={handleContentClick}
          getProseClass={getProseClass}
          getTextClass={getTextClass}
          fontScale={fontScale}
          isResolvingExternalLaw={isResolvingExternalLaw}
          t={t}
        />
        <LawContentPane
          label={t("lawViewer.secondaryLanguage")}
          lang={secondaryLang}
          hasCelex={hasCelex}
          selected={selected}
          loading={secondaryLoading}
          loadError={secondaryLoadError}
          processedHtml={secondaryProcessedHtml}
          onContentClick={handleContentClick}
          getProseClass={getProseClass}
          getTextClass={getTextClass}
          fontScale={fontScale}
          isResolvingExternalLaw={isResolvingExternalLaw}
          t={t}
          selector={secondaryLanguageSelector}
          emptyMessage={t("lawViewer.selectPrompt")}
          onClose={() => setSecondaryLanguage(null)}
        />
      </div>
    </>
  );
}
