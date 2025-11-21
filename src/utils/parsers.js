// ---------------- Parser (best-effort for OJ & consolidated) ----------------
export function parseSingleXHTMLToCombined(xhtmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtmlText, "text/html");

  const getText = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const innerHTML = (el) =>
    el
      ? Array.from(el.childNodes)
          .map((n) => (n.nodeType === Node.ELEMENT_NODE ? n.outerHTML : n.textContent))
          .join("")
      : "";

  const articles = [];
  const recitals = [];
  const annexes = [];
  let currentDivNum, currentDivTitle;

  const norm = (s = "") => s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  let currentChapter = { number: "", title: "" };
  let currentSection = { number: "", title: "" };
  let pendingHeader = null; // "chapter" | "section" | null

  const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!(el instanceof Element)) continue;

    // "Division headings"
    if (
      el.tagName === "P" &&
      (el.classList.contains("title-division-1") || el.classList.contains("oj-ti-section-1"))
    ) {
      const txt = norm(getText(el));
      const upper = txt.toUpperCase();

      if (/^\s*CHAPTER\b/.test(upper)) {
        currentChapter = { number: txt, title: "" };
        currentSection = { number: "", title: "" }; // reset section when a new chapter starts
        pendingHeader = "chapter";
      } else if (/^\s*SECTION\b/.test(upper)) {
        currentSection = { number: txt, title: "" };
        pendingHeader = "section";
      } else {
        // If neither keyword appears, treat as a chapter-level number
        currentChapter = { number: txt, title: "" };
        currentSection = { number: "", title: "" };
        pendingHeader = "chapter";
      }
    }

    if (
      el.tagName === "P" &&
      (el.classList.contains("title-division-2") || el.classList.contains("oj-ti-section-2"))
    ) {
      const txt = norm(getText(el));
      if (pendingHeader === "chapter") currentChapter.title = txt;
      else if (pendingHeader === "section") currentSection.title = txt;
      pendingHeader = null;
    }

    // Recitals (OJ typical layout: DIV.eli-subdivision#rct_*)
    if (el.tagName === "DIV" && el.classList.contains("eli-subdivision") && (el.id || "").startsWith("rct_")) {
      const tds = el.querySelectorAll("table td");
      if (tds.length >= 2) {
        const m = (tds[0].textContent || "").match(/\(?\s*(\d+)\s*\)?/);
        const recital_number = m ? m[1] : (tds[0].textContent || "").trim();
        const textCell = tds[1];
        recitals.push({
          recital_number,
          recital_text: getText(textCell),
          recital_html: innerHTML(textCell),
        });
      } else {
        // Fallback: take the whole block
        const num = el.querySelector(".recital-number, .oj-recital-num, strong");
        const recital_number = (num && getText(num).replace(/\D+/g, "")) || `${recitals.length + 1}`;
        recitals.push({ recital_number, recital_text: getText(el), recital_html: innerHTML(el) });
      }
      continue;
    }

    // Articles — OJ style
    if (el.tagName === "P" && el.classList.contains("oj-ti-art")) {
      let container = el.parentElement;
      while (container && !(container.tagName === "DIV" && container.classList.contains("eli-subdivision"))) {
        container = container.parentElement;
      }
      const n = getText(el).match(/Article\s+(\d+)/i);
      const article_number = n ? n[1] : getText(el);
      const titleBlock = container ? container.querySelector("div.eli-title p.oj-sti-art") : null;
      const article_title = titleBlock ? getText(titleBlock) : "";
      console.log({ number: currentDivNum, title: currentDivTitle });
      articles.push({
        article_number,
        article_title,
        division: {
          chapter: { number: currentChapter.number, title: currentChapter.title },
          section: currentSection.number ? { number: currentSection.number, title: currentSection.title } : null,
        },
        article_html: innerHTML(container || el.parentElement),
      });
      continue;
    }

    // Articles — consolidated style
    if (el.tagName === "DIV" && el.classList.contains("eli-subdivision")) {
      const numP = el.querySelector("p.title-article-norm");
      if (numP) {
        const m = numP.textContent.match(/Article\s+(\d+)/i);
        const article_number = m ? m[1] : numP.textContent.trim();
        const titleP = el.querySelector("p.stitle-article-norm");
        const article_title = titleP ? getText(titleP) : "";
        console.log({ number: currentDivNum, title: currentDivTitle });
        articles.push({
          article_number,
          article_title,
          division: {
            chapter: { number: currentChapter.number, title: currentChapter.title },
            section: currentSection.number ? { number: currentSection.number, title: currentSection.title } : null,
          },
          article_html: innerHTML(el),
        });
      }
    }

    // Annexes — detect heading and capture full block HTML
    if (el.tagName === "P") {
      const t = getText(el);
      const looksLikeAnnex =
        /^ANNEX(\s+[IVXLC]+|\s+\d+)?/i.test(t) ||
        el.classList.contains("oj-ti-annex") ||
        el.classList.contains("oj-ti-annex-1") ||
        el.classList.contains("title-annex-norm");
      if (looksLikeAnnex) {
        // Title
        let title = t;
        const titleP = el.parentElement?.querySelector("div.eli-title p, p.oj-ti-annex-2, p.stitle-annex-norm");
        if (titleP) title = `${t} — ${getText(titleP)}`;
        // Container: nearest subdivision, else the parent block
        let container = el.parentElement;
        while (container && !(container.tagName === "DIV" && container.classList.contains("eli-subdivision"))) {
          container = container.parentElement;
        }
        const annex_html = innerHTML(container || el.parentElement || el);
        // Id/number if present
        const m = t.match(/^ANNEX\s*([IVXLC]+|\d+)?/i);
        const annex_id = (m && (m[1] || "").trim()) || title;
        annexes.push({ annex_id, annex_title: title, annex_html });
      }
    }
  }

  // Sorts
  const asNum = (s) => (s == null ? NaN : parseInt(String(s).replace(/\D+/g, ""), 10));
  recitals.sort((a, b) => (asNum(a.recital_number) || 0) - (asNum(b.recital_number) || 0));
  return { articles, recitals, annexes };
}

export function parseAnyToCombined(text) {
  try {
    const obj = JSON.parse(text);
    if (obj && (Array.isArray(obj.articles) || Array.isArray(obj.recitals) || Array.isArray(obj.annexes))) {
      return { articles: obj.articles || [], recitals: obj.recitals || [], annexes: obj.annexes || [] };
    }
  } catch {
    /* not JSON */
  }
  return parseSingleXHTMLToCombined(text);
}

