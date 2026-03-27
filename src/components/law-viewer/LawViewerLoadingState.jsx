import { Loader2 } from "lucide-react";

export function LawViewerLoadingState({ title, message, t }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
        <Loader2 size={28} className="animate-spin" />
      </div>
      <h2 className="text-2xl font-bold font-serif tracking-tight text-gray-900 dark:text-gray-100">
        {title || t("lawViewer.loadingLaw")}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-400">{message}</p>
      <div className="mt-8 w-full max-w-2xl space-y-3">
        <div className="h-4 w-2/5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-full animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-11/12 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}
