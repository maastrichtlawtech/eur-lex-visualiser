import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { Github } from "lucide-react";
import { TopBar } from "./TopBar.jsx";
import { SEO } from "./SEO.jsx";
import { AddLawDialog } from "./AddLawDialog.jsx";
import { LandingLibrary } from "./LandingLibrary.jsx";
import { useI18n } from "../i18n/useI18n.js";
import { lawLangFromUiLocale, uiLocaleFromLawLang } from "../i18n/localeMeta.js";
import { resetWholeApp } from "../utils/resetApp.js";
import { useAddLawImport } from "../hooks/useAddLawImport.js";
import { useLandingLibrary } from "../hooks/useLandingLibrary.js";
import { useLandingSearchIndex } from "../hooks/useLandingSearchIndex.js";

export function Landing({ forcedLocale = null }) {
  const navigate = useNavigate();
  const { locale, setLocale, localizePath, t } = useI18n();
  const { allLaws, hideLaw, libraryVersion, markLawOpened } = useLandingLibrary();
  const [formexLang, setFormexLang] = useState(() => {
    try {
      return localStorage.getItem("legalviz-formex-lang") || "EN";
    } catch {
      return "EN";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("legalviz-formex-lang", formexLang);
    } catch {
      // ignore localStorage failures
    }
  }, [formexLang]);

  useEffect(() => {
    if (forcedLocale && forcedLocale !== locale) {
      setLocale(forcedLocale);
    }
  }, [forcedLocale, locale, setLocale]);

  useEffect(() => {
    const expectedLawLang = lawLangFromUiLocale(locale);
    if (formexLang !== expectedLawLang) {
      setFormexLang(expectedLawLang);
    }
  }, [locale, formexLang]);

  const handleUnifiedLanguageChange = useCallback((nextLang) => {
    setFormexLang(nextLang);
    setLocale(uiLocaleFromLawLang(nextLang));
  }, [setLocale]);

  const {
    allLawsData,
    handleSearchOpen,
    isSearchLoading,
    resetSearchIndex,
    searchableLawCount,
  } = useLandingSearchIndex({
    formexLang,
    laws: allLaws,
    libraryVersion,
  });
  const {
    closeAddLawDialog,
    eurlexError,
    eurlexUrl,
    handleEurlexUrlImport,
    handleReferenceImport,
    importError,
    isAddLawDialogOpen,
    isImporting,
    isResolvingUrl,
    openAddLawDialog,
    referenceNumber,
    referenceType,
    referenceYear,
    setEurlexUrl,
    setReferenceNumber,
    setReferenceType,
    setReferenceYear,
  } = useAddLawImport({ locale, navigate, t });

  const handleDelete = useCallback(async (event, celex) => {
    event.stopPropagation();
    if (window.confirm(t("landing.deleteConfirm"))) {
      await hideLaw(celex);
      resetSearchIndex();
    }
  }, [hideLaw, resetSearchIndex, t]);

  const handleOpenLaw = useCallback(async (law) => {
    await markLawOpened(law.celex);
    navigate(localizePath(law.route, locale));
  }, [locale, localizePath, markLawOpened, navigate]);

  const formatDate = (ts) => {
    if (!ts) return t("landing.never");
    return new Date(ts).toLocaleString(forcedLocale || locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 transition-colors duration-500">
      <SEO description={t("seo.landingDescription")} />
      <TopBar
        lawKey=""
        title=""
        lists={allLawsData}
        isExtensionMode={false}
        eurlexUrl={null}
        showPrint={false}
        onSearchOpen={handleSearchOpen}
        isSearchLoading={isSearchLoading}
        formexLang={formexLang}
        searchableLawCount={searchableLawCount}
        onFormexLangChange={handleUnifiedLanguageChange}
        hasCelex={true}
        onResetApp={resetWholeApp}
      />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center px-6 py-10">
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium tracking-tight text-gray-700 ring-1 ring-gray-200 mb-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
            <span>{t("app.name")}</span>
            <span className="mx-2 text-gray-400 dark:text-gray-500">|</span>
            <span className="font-normal text-gray-500 dark:text-gray-400">{t("app.tagline")}</span>
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl dark:text-white">
            {t("landing.heroTitle")}
            <span className="block text-gray-600 dark:text-gray-400">{t("landing.heroSubtitle")}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 sm:text-base dark:text-gray-400">
            {t("landing.heroDescription")}
          </p>
        </Motion.div>

        <LandingLibrary
          laws={allLaws}
          onAddLaw={openAddLawDialog}
          onOpenLaw={handleOpenLaw}
          onDeleteLaw={handleDelete}
          formatDate={formatDate}
          t={t}
        />

        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex flex-col items-center gap-2 text-xs text-gray-500"
        >
          <p>{t("landing.builtBy")}</p>
          <a
            href="https://github.com/maastrichtlawtech/eur-lex-visualiser"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <Github className="h-4 w-4" />
            <span>{t("landing.sourceCode")}</span>
          </a>
        </Motion.div>
      </div>
      <AnimatePresence>
        {isAddLawDialogOpen ? (
          <AddLawDialog
            isOpen={isAddLawDialogOpen}
            onClose={closeAddLawDialog}
            referenceType={referenceType}
            setReferenceType={setReferenceType}
            referenceYear={referenceYear}
            setReferenceYear={setReferenceYear}
            referenceNumber={referenceNumber}
            setReferenceNumber={setReferenceNumber}
            handleReferenceImport={handleReferenceImport}
            isImporting={isImporting}
            importError={importError}
            eurlexUrl={eurlexUrl}
            setEurlexUrl={setEurlexUrl}
            handleEurlexUrlImport={handleEurlexUrlImport}
            isResolvingUrl={isResolvingUrl}
            eurlexError={eurlexError}
            t={t}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
