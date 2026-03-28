import { X, Loader2 } from "lucide-react";

export function LawContentPane({
  label,
  lang,
  hasCelex,
  selected,
  loading,
  loadError,
  processedHtml,
  onContentClick,
  getProseClass,
  getTextClass,
  fontScale,
  isResolvingExternalLaw = false,
  t,
  selector = null,
  emptyMessage = null,
  onClose = null,
}) {
  const loadErrorTone = loadError?.tone === "notice" ? "notice" : "error";

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{lang}</div>
          </div>
          <div className="flex items-start gap-2">
            {selector}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                title={t("topBar.closeSideBySide")}
                aria-label={t("topBar.closeSideBySide")}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t("lawViewer.loadingLanguage", { lang })}
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{lang}</div>
          </div>
          <div className="flex items-start gap-2">
            {selector}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                title={t("topBar.closeSideBySide")}
                aria-label={t("topBar.closeSideBySide")}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
        <div className={`rounded-2xl border px-4 py-5 text-sm ${
          loadErrorTone === "notice"
            ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        }`}>
          <p className="font-semibold">{loadError.title}</p>
          <p className="mt-2 leading-6">{loadError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <span>{lang}</span>
            {!hasCelex ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {t("lawViewer.textOnly")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-start gap-2">
          {selector}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title={t("topBar.closeSideBySide")}
              aria-label={t("topBar.closeSideBySide")}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
      <article
        className={`prose prose-slate mx-auto ${getProseClass(fontScale)} ${getTextClass(fontScale)} mt-4 transition-all duration-200 ${isResolvingExternalLaw ? "cursor-progress" : ""}`}
        dangerouslySetInnerHTML={{
          __html: processedHtml || `<div class='text-center text-gray-400 py-10'>${emptyMessage || t("lawViewer.selectPrompt")}</div>`,
        }}
        onClick={onContentClick}
      />
      {!processedHtml && selected.id ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
          {t("lawViewer.languageItemUnavailable", {
            label: selected.kind === "article"
              ? t("common.article")
              : selected.kind === "recital"
                ? t("common.recital")
                : t("common.annex"),
            id: selected.id,
            lang,
          })}
        </p>
      ) : null}
    </div>
  );
}
