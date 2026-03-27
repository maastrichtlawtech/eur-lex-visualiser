import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { PrintView } from "../../components/PrintView.jsx";

export function useLawViewerPrint({ data, locale, t }) {
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

  useEffect(() => {
    if (!printOptions) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(t("lawViewer.popupBlocked"));
      setPrintOptions(null);
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    styles.forEach((style) => {
      printWindow.document.head.appendChild(style.cloneNode(true));
    });

    const extraStyle = printWindow.document.createElement("style");
    extraStyle.textContent = "body { background: white !important; margin: 0; } .print-container { display: block !important; }";
    printWindow.document.head.appendChild(extraStyle);

    const container = printWindow.document.createElement("div");
    container.className = "print-container";
    printWindow.document.body.appendChild(container);

    const root = createRoot(container);
    root.render(createElement(PrintView, {
      data,
      options: printOptions,
      uiLocale: locale,
      labels: {
        article: t("common.article"),
        recitals: t("common.recitals"),
        articles: t("common.articles"),
        annexes: t("common.annexes"),
        relatedRecitals: t("relatedRecitals.title"),
        documentTitle: t("printView.documentTitle"),
        generatedOn: t("printView.generatedOn"),
        printedFrom: t("printView.printedFrom"),
      },
    }));

    const timer = setTimeout(() => {
      printWindow.print();
      setPrintOptions(null);
    }, 500);

    return () => clearTimeout(timer);
  }, [data, locale, printOptions, t]);

  return {
    printModalOpen,
    setPrintModalOpen,
    setPrintOptions,
  };
}
