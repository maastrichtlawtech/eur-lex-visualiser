import React, { useState } from "react";
import { useI18n } from "../i18n/useI18n.js";

export function NumberSelector({ label, total, onSelect }) {
  const { t } = useI18n();
  const [val, setVal] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= total) {
      onSelect(num);
      setVal("");
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex-1 min-w-[140px]">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <input
            type="number"
            min="1"
            max={total}
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              setError(false);
            }}
            className={`block w-full rounded-lg border px-3 py-2 pr-16 text-sm text-gray-900 placeholder:text-gray-500 outline-none transition bg-white dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 ${error
                ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                : "border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:focus:bg-gray-900"
              }`}
            placeholder={`${label} (1-${total})`}
          />
          <button
            type="submit"
            disabled={!val}
            className="absolute right-1.5 top-1.5 bottom-1.5 rounded-md border border-blue-700 bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:border-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {t("common.go")}
          </button>
        </div>
        {error && <p className="absolute top-full left-0 mt-1 text-[10px] text-red-600 dark:text-red-400">{t("numberSelector.invalidRange")}</p>}
      </form>
    </div>
  );
}
