export function LawDocumentContent({
  processedHtml,
  fontScale,
  getProseClass,
  getTextClass,
  onContentClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  t,
}) {
  return (
    <article
      className={`prose prose-slate mx-auto ${getProseClass(fontScale)} ${getTextClass(fontScale)} mt-4 transition-all duration-200`}
      dangerouslySetInnerHTML={{
        __html: processedHtml || `<div class='text-center text-gray-400 py-10'>${t("lawViewer.selectPrompt")}</div>`,
      }}
      onClick={onContentClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
}
