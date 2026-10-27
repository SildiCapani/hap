import { authorized, json } from "../lib/meals.mjs";

// Current price and one year of daily closes for ETFs/stocks, looked up by
// ISIN (or ticker) on Yahoo Finance's public chart data. Euro listings
// (Xetra first) are preferred, since Trade Republic shows euro prices.
const headers = { "User-Agent": "Mozilla/5.0 (Hap personal planner)", Accept: "application/json" };
const euroSuffixes = [".DE", ".SG", ".F", ".MU", ".DU", ".BE", ".HM", ".HA", ".AS", ".PA", ".MI"];
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const SYMBOL = /^[A-Z0-9][A-Z0-9.\-]{0,19}$/i;

// Yahoo answers 401/403/429 when it refuses a server (rate limit or blocked
// IP); that is reported separately from "this fund does not exist there".
export class Refused extends Error {}

async function get(url) {
  let response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Refused("Upstream unreachable");
  }
  if ([401, 403, 429].includes(response.status) || response.status >= 500) throw new Refused("Upstream " + response.status);
  if (!response.ok) return null;
  return response.json();
}

const search = async (q) =>
  ((await get("https://query1.finance.yahoo.com/v1/finance/search?quotesCount=15&newsCount=0&q=" + encodeURIComponent(q)))?.quotes || []).filter(
    (x) => typeof x.symbol === "string" && SYMBOL.test(x.symbol),
  );
const rank = (s) => {
  const i = euroSuffixes.findIndex((x) => s.toUpperCase().endsWith(x));
  return i < 0 ? 99 : i;
};

// Listings of the fund: the ISIN search often returns only London; a search
// for its exact full name also finds Xetra. Only the same name counts, so a
// similar fund (other share class) is never picked.
export async function candidates(isin) {
  const found = await search(isin);
  const name = found.find((x) => x.longname)?.longname;
  const same = name && !found.some((x) => x.symbol.toUpperCase().endsWith(".DE")) ? (await search(name)).filter((x) => x.longname === name) : [];
  return [...new Set([...found, ...same].map((x) => x.symbol))].sort((a, b) => rank(a) - rank(b));
}

export function parseChart(data) {
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || !Number.isFinite(meta.regularMarketPrice)) return null;
  const offset = Number(meta.gmtoffset) || 0;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const history = (result.timestamp || [])
    .map((t, i) => ({ date: new Date((t + offset) * 1000).toISOString().slice(0, 10), close: closes[i] }))
    .filter((h) => Number.isFinite(h.close))
    .map((h) => ({ date: h.date, close: Math.round(h.close * 10000) / 10000 }));
  return {
    symbol: meta.symbol,
    name: String(meta.longName || meta.shortName || meta.symbol).slice(0, 80),
    currency: meta.currency || "",
    price: meta.regularMarketPrice,
    at: new Date().toISOString(),
    history: history.filter((h, i) => i === history.length - 1 || h.date !== history[i + 1].date),
  };
}

const chart = async (symbol) =>
  parseChart(await get("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=1y&interval=1d"));

async function lookup({ isin, symbol }) {
  if (symbol) return chart(symbol);
  let fallback = null;
  for (const s of (await candidates(isin)).slice(0, 5)) {
    const quote = await chart(s);
    // A listing without daily prices cannot value the savings plan.
    if (!quote || quote.history.length < 20) continue;
    if (quote.currency === "EUR") return quote;
    fallback ??= quote;
  }
  return fallback;
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32) return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN)) return json({ error: "Unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const items = Array.isArray(body?.items) ? body.items.slice(0, 10) : [];
  const clean = items
    .map((i) => ({ id: String(i?.id || "").slice(0, 40), isin: String(i?.isin || "").toUpperCase().trim(), symbol: String(i?.symbol || "").trim() }))
    .filter((i) => i.id && (ISIN.test(i.isin) || SYMBOL.test(i.symbol)))
    .map((i) => ({ ...i, symbol: SYMBOL.test(i.symbol) ? i.symbol : "" }));
  if (!clean.length) return json({ error: "Invalid input" }, 400);
  const quotes = {};
  const errors = {};
  for (const item of clean) {
    try {
      quotes[item.id] = await lookup(item);
      if (!quotes[item.id]) errors[item.id] = "not-found";
    } catch (error) {
      console.error("Quote lookup failed:", error instanceof Error ? error.message : error);
      quotes[item.id] = null;
      errors[item.id] = error instanceof Refused ? "refused" : "not-found";
    }
  }
  return json({ quotes, errors });
}
