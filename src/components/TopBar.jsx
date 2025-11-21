import { useNavigate, useParams } from "react-router-dom";
import { LAWS } from "../constants/laws.js";
import { Button } from "./Button.jsx";

export function TopBar({ lawKey, lists, selected, onPrevNext }) {
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

  const handleLawChange = (e) => {
    const selectedLaw = LAWS.find(l => l.value === e.target.value);
    if (selectedLaw) {
      navigate(`/law/${selectedLaw.key}`);
    }
  };

  const currentLaw = LAWS.find(l => l.key === lawKey);

  return (
    <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="ml-2 hidden text-xs md:inline-flex"
            onClick={() => navigate("/")}
          >
            ← Overview of Laws
          </Button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-base font-semibold hover:underline"
          >
            EU Law Visualiser
          </button>

          <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 md:inline">
            Konrad Kollnig, Law &amp; Tech Lab Maastricht
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* --- Unified navigation control --- */}
          {kind && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                disabled={index <= 0}
                onClick={() => onPrevNext(kind, index - 1)}
                title={`Previous ${label.toLowerCase()}`}
              >
                ← Prev {label}
              </Button>
              <span className="text-sm text-gray-600">
                {label} {index + 1} of {list.length}
              </span>
              <Button
                variant="outline"
                disabled={index === -1 || index >= list.length - 1}
                onClick={() => onPrevNext(kind, index + 1)}
                title={`Next ${label.toLowerCase()}`}
              >
                Next {label} →
              </Button>
            </div>
          )}

          {/* --- Law selection --- */}
          <select
            value={currentLaw?.value || ""}
            onChange={handleLawChange}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            {LAWS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

