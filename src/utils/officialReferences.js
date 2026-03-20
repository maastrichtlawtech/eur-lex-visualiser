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
    // Modern format: year/number — e.g. "(EU) 2016/679" or plain "2016/679"
    /\b(?:\((EU|EC|EEC|EURATOM|JHA)\)\s*)?(\d{4})\/(\d{1,4})(?:\/([A-Z]+))?\b/i,
    // "No. N/YYYY" format — e.g. "No. 46/95"
    /\bno\.?\s+(\d{1,4})\/(\d{2,4})(?:\/([A-Z]+))?\b/i,
    // Old-style number/year without "No." — e.g. "95/46/EC", "1612/68/EEC"
    /\b(\d{1,4})\/(\d{2,4})(?:\/([A-Z]+))?\b/i,
  ];

  let year = null;
  let number = null;
  let suffix = null;

  const first = raw.match(numberPatterns[0]);
  if (first) {
    const candidate = parseInt(first[2], 10);
    if (candidate >= 1950 && candidate <= 2100) {
      // Plausible year — standard interpretation: first = year, second = number
      year = first[2];
      number = first[3];
      suffix = (first[4] || first[1] || "").toUpperCase() || null;
    } else {
      // Implausible year (e.g. "1612/68/EEC") — first is the number, second is the year
      const y = parseInt(first[3], 10);
      year = first[3].length === 2 ? String(y >= 50 ? 1900 + y : 2000 + y) : first[3];
      number = first[2];
      suffix = (first[4] || first[1] || "").toUpperCase() || null;
    }
  } else {
    const second = raw.match(numberPatterns[1]);
    if (second) {
      year = second[2].length === 2 ? `19${second[2]}` : second[2];
      number = second[1];
      suffix = (second[3] || "").toUpperCase() || null;
    } else {
      const third = raw.match(numberPatterns[2]);
      if (third) {
        // Pattern 1 already handles YYYY/N (4-digit year first), so here
        // the first number is always a short (1-3 digit) year: "95/46/EC",
        // "93/13" → year comes first even in old-style references.
        const a = third[1];
        const b = third[2];
        suffix = (third[3] || "").toUpperCase() || null;
        const y = parseInt(a, 10);
        year = a.length === 2 ? String(y >= 50 ? 1900 + y : 2000 + y) : a;
        number = b;
      }
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
