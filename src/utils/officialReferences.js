export function parseOfficialReference(text = "") {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  let actType = null;
  if (/\b(directive|directiva|direttiva|diretiva|richtlijn|direktiv|smernica|sm[ěe]rnice|treoir|οδηγία|директива|direktyva|direktīva|irányelv)\b/i.test(lower)) {
    actType = "directive";
  } else if (/\b(regulation|reglamento|regolamento|regulamento|verordnung|verordening|förordning|forordning|nariadenie|nařízení|rialachán|κανονισμός|регламент|reglamentas|regulamentul|uredba|asetus|rendelet)\b/i.test(lower)) {
    actType = "regulation";
  } else if (/\b(decision|decisión|decisione|decisão|beschluss|besluit|beslut|rozhodnutie|rozhodnutí|cinneadh|απόφαση|решение|sprendimas|lēmums|odluka|határozat)\b/i.test(lower)) {
    actType = "decision";
  }

  const numberPatterns = [
    /\b(?:\((EU|EC|EEC|EURATOM|JHA)\)\s*)?(\d{4})\/(\d{1,4})(?:\/([A-Z]+))?\b/i,
    /\bno\.?\s+(\d{1,4})\/(\d{2,4})(?:\/([A-Z]+))?\b/i,
  ];

  let year = null;
  let number = null;
  let suffix = null;

  const first = raw.match(numberPatterns[0]);
  if (first) {
    year = first[2];
    number = first[3];
    suffix = (first[4] || first[1] || "").toUpperCase() || null;
  } else {
    const second = raw.match(numberPatterns[1]);
    if (second) {
      year = second[2].length === 2 ? `19${second[2]}` : second[2];
      number = second[1];
      suffix = (second[3] || "").toUpperCase() || null;
    }
  }

  if (!actType || !year || !number) return null;

  return {
    raw,
    actType,
    year,
    number,
    suffix,
  };
}

export function getReferenceLabel(reference) {
  return reference?.raw || [reference?.actType, reference?.year && `${reference.year}/${reference.number}`].filter(Boolean).join(" ");
}
