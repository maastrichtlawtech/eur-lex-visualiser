import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button.jsx";

export function TopBar({ lawKey, title, lists, selected, onPrevNext }) {
  const navigate = useNavigate();
  const { articles, recitals, annexes } = lists;

  const getListAndIndex = () => {
    if (selected.kind === "article") {
      const idx = articles.findIndex((a) => a.article_number === selected.id);
      return { kind: "article", index: idx, list: articles, label: "Article" };
    }
    if (selected.kind === "recital") {
      const idx = recitals.findIndex((r) => r.recital_number === selected.id);
      return { kind: "recital", index: idx, list: recitals, label: "Recital" };
    }
    if (selected.kind === "annex") {
      const idx = annexes.findIndex((x) => x.annex_id === selected.id);
      return { kind: "annex", index: idx, list: annexes, label: "Annex" };
    }
    return { kind: null, index: -1, list: [], label: "" };
  };

  const { kind, index, list, label } = getListAndIndex();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
      <div className="relative mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-6">
        {/* Left: Branding */}
        <button
          onClick={() => navigate("/")}
          className="relative z-10 flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white shadow-sm">
            <span className="font-serif text-lg font-bold leading-none pb-0.5">§</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            EU Law Visualiser
          </span>
        </button>

        {/* Center: Title */}
        {title && (
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="flex items-center justify-center rounded-full bg-gray-100/80 px-4 py-1.5 backdrop-blur-md">
              <span
                className="max-w-xl truncate text-sm font-medium text-gray-700"
                title={title}
              >
                {title}
              </span>
            </div>
          </div>
        )}

        {/* Right: Navigation Controls */}
        <div className="relative z-10 flex items-center gap-4">
          {kind && (
            <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-1 ring-1 ring-gray-200">
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                disabled={index <= 0}
                onClick={() => onPrevNext(kind, index - 1)}
                title={`Previous ${label}`}
              >
                <ChevronLeft size={18} />
              </Button>

              <span className="min-w-[100px] px-2 text-center text-sm font-medium text-gray-600">
                <span className="text-gray-900">{label} {index + 1}</span>
                <span className="mx-1 text-gray-400">/</span>
                {list.length}
              </span>

              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                disabled={index === -1 || index >= list.length - 1}
                onClick={() => onPrevNext(kind, index + 1)}
                title={`Next ${label}`}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
