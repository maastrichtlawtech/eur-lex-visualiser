import { FormexApiError } from "../formexApi.js";

export function isMissingStructuredLawText(error) {
  if (!(error instanceof FormexApiError)) return false;

  const message = String(error.message || "").toLowerCase();
  return (
    error.status === 404 ||
    error.code === "fmx_not_found" ||
    error.code === "law_not_found" ||
    (
      (message.includes("fmx") || message.includes("formex")) &&
      (message.includes("not found") || message.includes("available"))
    )
  );
}

export function getLoadErrorDetails(error, t) {
  if (isMissingStructuredLawText(error)) {
    return {
      title: t("lawViewer.notAvailableTitle"),
      message: t("lawViewer.notAvailableMessage"),
      fallbackUrl: error.fallback?.url || error.details?.fallback?.url || null,
      status: error.status || null,
      tone: "notice",
    };
  }

  if (error instanceof FormexApiError) {
    return {
      title: t("lawViewer.lawLoadFailed"),
      message: error.message || t("lawViewer.lawLoadServiceFailed"),
      fallbackUrl: error.fallback?.url || error.details?.fallback?.url || null,
      status: error.status || null,
      tone: "error",
    };
  }

  return {
    title: t("lawViewer.lawLoadFailed"),
    message: String(error?.message || error || t("lawViewer.lawLoadFailed")),
    fallbackUrl: null,
    status: null,
    tone: "error",
  };
}
