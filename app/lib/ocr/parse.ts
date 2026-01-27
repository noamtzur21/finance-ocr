function parseDate(text: string): Date | null {
  // yyyy-mm-dd
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(dt.getTime())) return new Date(y, m - 1, d);
  }
  // dd/mm/yyyy
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

function parseCurrency(text: string): "ILS" | "USD" | "EUR" | null {
  const t = text.toLowerCase();
  if (/[₪]|ש["״׳']?ח|nis\b|ils\b/.test(t)) return "ILS";
  if (/[$]|usd\b/.test(t)) return "USD";
  if (/[€]|eur\b/.test(t)) return "EUR";
  return null;
}

function normalizeNumber(raw: string): string | null {
  const s = raw.replace(/\s/g, "");
  // Handle comma-decimal (e.g. 123,45) when no dot present.
  if (s.includes(",") && !s.includes(".")) {
    const parts = s.split(",");
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d{2}$/.test(parts[1])) {
      return `${parts[0]}.${parts[1]}`;
    }
  }
  // Otherwise treat commas as thousands separators.
  const x = s.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(x)) return null;
  return x;
}

function parseAmount(text: string): string | null {
  // Prefer totals: "לתשלום" / "סהכ לתשלום" / "סך הכל" / "TOTAL"
  const candidates: Array<{ raw: string; score: number }> = [];
  const lines = text.split(/\r?\n/);

  const totalHints = /(סה["״׳']?כ|סך\s*הכל|לתשלום|total|grand\s*total)/i;
  const vatHints = /(מע["״׳']?מ|vat)/i;

  const amountRe =
    /(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s*(?:₪|ש["״׳']?ח|ils|nis|usd|eur|\$|€)?/gi;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const hasTotal = totalHints.test(trimmed);
    const hasVat = vatHints.test(trimmed);
    for (const m of trimmed.matchAll(amountRe)) {
      const n = normalizeNumber(m[1]);
      if (!n) continue;
      const val = Number(n);
      if (!Number.isFinite(val) || val <= 0 || val > 1_000_000) continue;
      let score = 0;
      if (hasTotal) score += 5;
      if (hasVat) score -= 3;
      if (/[₪]|ש["״׳']?ח|ils|nis/i.test(trimmed)) score += 1;
      candidates.push({ raw: n, score });
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score || Number(b.raw) - Number(a.raw));
    return candidates[0]!.raw;
  }

  // Fallback: largest number in doc
  const nums = Array.from(text.matchAll(/\b(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\b/g))
    .map((m) => normalizeNumber(m[1]))
    .filter((x): x is string => Boolean(x))
    .map((x) => ({ raw: x, n: Number(x) }))
    .filter((x) => x.n > 0 && x.n < 1_000_000);

  nums.sort((a, b) => b.n - a.n);
  return nums[0]?.raw ?? null;
}

function parseVendor(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);

  const bad = [
    "חשבונית",
    "קבלה",
    "מס",
    "תאריך",
    "סה\"כ",
    "סה״כ",
    "total",
    "tax",
    "vat",
  ];

  for (const line of lines) {
    if (line.length < 3) continue;
    if (line.length > 120) continue;
    const lower = line.toLowerCase();
    if (bad.some((b) => lower.includes(b.toLowerCase()))) continue;
    // must contain at least one letter (he/en)
    if (!/[\p{L}]/u.test(line)) continue;
    // avoid lines that are mostly numbers/phone
    const digits = (line.match(/\d/g) ?? []).length;
    if (digits > 10) continue;
    return line.slice(0, 80);
  }
  return null;
}

function parseDocNumber(text: string): string | null {
  const m = text.match(
    /(?:חשבונית|חשבונית\s*מס|קבלה|מסמך|document|invoice)\s*(?:מספר|מס'|no\.?|#)?\s*[:\-]?\s*([A-Za-z0-9\-\/]{4,})/i,
  );
  return m?.[1] ?? null;
}

export function parseReceiptText(text: string) {
  const date = parseDate(text);
  const amount = parseAmount(text);
  const vendor = parseVendor(text);
  const docNumber = parseDocNumber(text);
  const currency = parseCurrency(text);
  return { date, amount, vendor, docNumber, currency };
}


