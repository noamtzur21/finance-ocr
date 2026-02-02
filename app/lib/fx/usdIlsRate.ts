let cached: { rate: number; fetchedAt: number } | null = null;

function envFallbackRate(): number {
  const raw = process.env.USD_ILS_FALLBACK_RATE?.trim();
  const n = raw ? Number(raw) : NaN;
  // reasonable fallback range
  if (Number.isFinite(n) && n > 2 && n < 10) return n;
  return 3.7;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(t);
  }
}

export async function getUsdIlsRate(): Promise<number> {
  const now = Date.now();
  // cache for 6 hours
  if (cached && now - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached.rate;

  try {
    // Free endpoint; no API key required
    // Response: { rates: { ILS: number, ... } }
    const data = (await fetchJsonWithTimeout("https://open.er-api.com/v6/latest/USD", 2500)) as {
      rates?: Record<string, number>;
    };
    const rate = data.rates?.ILS;
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 2 && rate < 10) {
      cached = { rate, fetchedAt: now };
      return rate;
    }
  } catch {
    // ignore, fallback below
  }

  const fallback = envFallbackRate();
  cached = { rate: fallback, fetchedAt: now };
  return fallback;
}

