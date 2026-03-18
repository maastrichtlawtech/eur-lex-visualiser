import { RotateCcw } from "lucide-react";
import { resetWholeApp } from "../utils/resetApp.js";

export function AppResetFooter({ className = "" }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`.trim()}>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Something isn&apos;t working?
      </p>
      <button
        type="button"
        onClick={() => {
          resetWholeApp();
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <RotateCcw size={16} />
        Click here to reset the whole app
      </button>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        This clears LegalViz local settings and cached data in this browser.
      </p>
    </div>
  );
}
