import { parseDate, shiftDay, type Holding, type MoneyRule, type PlannerState, type Quote } from "./planner.ts";

// Money planning from recurring rules plus what was entered by hand. All
// amounts are euros, positive; the kind says which way the money goes.

export const categories = [
  { key: "essen", label: "Essen & Einkauf", color: "#E5B073" },
  { key: "mensa", label: "Mensa & Café", color: "#F5C451" },
  { key: "freizeit", label: "Freizeit", color: "#B9A2F2" },
  { key: "mobil", label: "Mobilität & Reisen", color: "#8FA3C8" },
  { key: "uni", label: "Uni & Bücher", color: "#92B9DB" },
  { key: "kleidung", label: "Kleidung", color: "#F07B83" },
  { key: "haushalt", label: "Haushalt", color: "#5EC2B7" },
  { key: "gesundheit", label: "Gesundheit & Sport", color: "#98C5A9" },
  { key: "geschenke", label: "Geschenke", color: "#E89BC4" },
  { key: "sonstiges", label: "Sonstiges", color: "#9C9AA3" },
] as const;
export const categoryOf = (key: string) => categories.find((c) => c.key === key) || categories[categories.length - 1];

export const kinds: Record<MoneyRule["kind"], { label: string; color: string }> = {
  income: { label: "Einnahme", color: "#98C5A9" },
  fixed: { label: "Fixkosten", color: "#8FA3C8" },
  abo: { label: "Abo", color: "#B9A2F2" },
  saving: { label: "Sparplan", color: "#5EC2B7" },
};

export const euro = (n: number, cents = true) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: cents && n % 1 ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }) + " €";

export const round2 = (n: number) => Math.round(n * 100) / 100;

const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const ymd = (year: number, month: number, day: number) => {
  const d = new Date(year, month, Math.min(day, daysIn(year, month)), 12);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// Dates a rule books in [from, to].
export function occurrences(rule: MoneyRule, from: string, to: string): string[] {
  const start = rule.start > from ? rule.start : from;
  const end = rule.end && rule.end < to ? rule.end : to;
  if (start > end) return [];
  const out: string[] = [];
  if (rule.every === "week") {
    const s = parseDate(start);
    let d = shiftDay(start, (rule.day - s.getDay() + 7) % 7);
    for (; d <= end; d = shiftDay(d, 7)) out.push(d);
    return out;
  }
  const first = parseDate(start);
  for (let y = first.getFullYear(), m = first.getMonth(); ; m++) {
    const d = ymd(y, m, rule.day);
    if (d > end) break;
    if (d >= start) out.push(d);
  }
  return out;
}

export const bookingKey = (rule: MoneyRule, date: string) => rule.id + ":" + date;
export const amountOn = (state: Pick<PlannerState, "moneyOverrides">, rule: MoneyRule, date: string) =>
  state.moneyOverrides[bookingKey(rule, date)] ?? rule.amount;

// Monthly equivalent of a rule (weekly money ≈ 4.33× a month).
export const monthly = (rule: Pick<MoneyRule, "amount" | "every">) => (rule.every === "week" ? (rule.amount * 52) / 12 : rule.amount);

// The money period runs from payday to the day before the next payday.
export function period(payday: number, day: string) {
  const d = parseDate(day);
  const p = payday || 1;
  const thisMonth = ymd(d.getFullYear(), d.getMonth(), p);
  const start = thisMonth <= day ? thisMonth : ymd(d.getFullYear(), d.getMonth() - 1, p);
  const s = parseDate(start);
  const next = ymd(s.getFullYear(), s.getMonth() + 1, p);
  return { start, end: shiftDay(next, -1), next };
}

export type Booking = { rule: MoneyRule; date: string; amount: number; done: boolean };

export function periodSummary(state: PlannerState, today: string, offset = 0) {
  let p = period(state.payday, today);
  for (let i = 0; i < offset; i++) p = period(state.payday, shiftDay(p.start, -1));
  const bookings: Booking[] = state.moneyRules
    .flatMap((rule) => occurrences(rule, p.start, p.end).map((date) => ({ rule, date, amount: amountOn(state, rule, date), done: date <= today })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.rule.name.localeCompare(b.rule.name));
  const entries = state.moneyEntries.filter((e) => e.date >= p.start && e.date <= p.end);
  const sum = (list: { amount: number }[]) => round2(list.reduce((n, x) => n + x.amount, 0));
  const of = (kind: MoneyRule["kind"]) => bookings.filter((b) => b.rule.kind === kind);
  const income = sum(of("income")) + sum(entries.filter((e) => e.kind === "income"));
  const fixed = sum(of("fixed"));
  const abos = sum(of("abo"));
  const saved = sum(of("saving"));
  const spent = sum(entries.filter((e) => e.kind === "expense"));
  const free = round2(income - fixed - abos - saved - spent);
  const daysLeft = today > p.end ? 0 : Math.round((parseDate(p.end).getTime() - parseDate(today < p.start ? p.start : today).getTime()) / 864e5) + 1;
  const byCategory = categories
    .map((c) => ({ ...c, spent: sum(entries.filter((e) => e.kind === "expense" && e.category === c.key)), budget: state.budgets[c.key] || 0 }))
    .filter((c) => c.spent > 0 || c.budget > 0);
  return {
    ...p,
    bookings,
    entries,
    income,
    expected: sum(of("income").filter((b) => !b.done)),
    fixed,
    abos,
    saved,
    spent,
    free,
    daysLeft,
    perDay: daysLeft ? round2(Math.max(0, free) / daysLeft) : 0,
    byCategory,
  };
}

// ---------- Depot ----------

export function closeOn(quote: Quote | undefined, date: string) {
  if (!quote) return 0;
  let price = 0;
  for (const h of quote.history) {
    if (h.date > date) break;
    price = h.close;
  }
  return price || quote.history[0]?.close || quote.price;
}

// Savings plan executions into a holding between two dates (exclusive, inclusive].
export function executions(state: PlannerState, holding: Holding, after: string, until: string) {
  return state.moneyRules
    .filter((r) => r.kind === "saving" && r.holdingId === holding.id)
    .flatMap((rule) => occurrences(rule, shiftDay(after, 1), until).map((date) => ({ date, amount: amountOn(state, rule, date) })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Pieces held on a date: the broker's number on `since`, plus/minus what
// the savings plans bought at that day's price.
export function sharesOn(state: PlannerState, holding: Holding, quote: Quote | undefined, date: string) {
  if (holding.cash) return 0;
  const buy = (list: { date: string; amount: number }[]) => list.reduce((n, e) => n + (closeOn(quote, e.date) ? e.amount / closeOn(quote, e.date) : 0), 0);
  return date >= holding.since
    ? holding.shares + buy(executions(state, holding, holding.since, date))
    : holding.shares - buy(executions(state, holding, date, holding.since));
}

export function holdingNow(state: PlannerState, holding: Holding, today: string) {
  const quote = state.quotes[holding.id];
  const paid = executions(state, holding, holding.since, today).reduce((n, e) => n + e.amount, 0);
  const invested = round2(holding.invested + paid);
  if (holding.cash) return { invested, value: invested, shares: 0, price: 0, gain: 0, quote };
  if (!quote) return { invested, value: null, shares: holding.shares, price: 0, gain: null, quote };
  const shares = sharesOn(state, holding, quote, today);
  const value = round2(shares * quote.price);
  return { invested, value, shares: Math.round(shares * 10000) / 10000, price: quote.price, gain: round2(value - invested), quote };
}

// Weekly values of the whole depot over the last months, for the chart.
export function depotHistory(state: PlannerState, today: string, weeks = 26) {
  return Array.from({ length: weeks }, (_, i) => shiftDay(today, (i - weeks + 1) * 7)).map((date) => {
    let value = 0, invested = 0;
    for (const h of state.holdings) {
      const quote = state.quotes[h.id];
      const paidBefore = executions(state, h, date, h.since).reduce((n, e) => n + e.amount, 0);
      const paidAfter = executions(state, h, h.since, date).reduce((n, e) => n + e.amount, 0);
      const inv = date >= h.since ? h.invested + paidAfter : h.invested - paidBefore;
      invested += Math.max(0, inv);
      value += h.cash ? Math.max(0, inv) : Math.max(0, sharesOn(state, h, quote, date)) * closeOn(quote, date);
    }
    return { date, value: round2(value), invested: round2(invested) };
  });
}

// ---------- Spar-Check ----------

// Value after `years` with a fixed monthly rate and an assumed yearly return.
export function projection(start: number, perMonth: number, yearlyReturn: number, years: number) {
  const r = yearlyReturn / 12, n = years * 12;
  const grow = (1 + r) ** n;
  return Math.round(start * grow + (r ? (perMonth * (grow - 1)) / r : perMonth * n));
}

export type Tip = { tone: "good" | "tip"; text: string };

export function savingsCheck(state: PlannerState, today: string) {
  const rules = state.moneyRules.filter((r) => !r.end || r.end >= today);
  const per = (kind: MoneyRule["kind"]) => round2(rules.filter((r) => r.kind === kind).reduce((n, r) => n + monthly(r), 0));
  const income = per("income");
  const fixed = round2(per("fixed") + per("abo"));
  const saving = per("saving");
  // Variable spending: average of up to three finished periods, else the budgets.
  const past = [1, 2, 3].map((i) => periodSummary(state, today, i)).filter((p) => p.entries.length || p.bookings.length);
  const spentPast = past.filter((p) => p.entries.some((e) => e.kind === "expense"));
  const budgetSum = Object.values(state.budgets).reduce((n, b) => n + b, 0);
  const variable = spentPast.length ? round2(spentPast.reduce((n, p) => n + p.spent, 0) / spentPast.length) : budgetSum;
  const leftover = round2(income - fixed - saving - variable);
  const cash = state.holdings.filter((h) => h.cash).reduce((n, h) => n + (holdingNow(state, h, today).value || 0), 0);
  const cushion = Math.round((fixed + variable) * 3);
  const depot = state.holdings.reduce((n, h) => n + (holdingNow(state, h, today).value ?? holdingNow(state, h, today).invested), 0);
  const rate = income ? saving / income : 0;
  const tips: Tip[] = [];
  // What the everyday spending is based on: real entries, budgets or nothing yet.
  const basis = spentPast.length ? "measured" : budgetSum ? "budgets" : "none";
  if (!income) return { income, fixed, saving, variable, leftover, rate, cash, cushion, depot, tips, basis };
  const pct = (n: number) => Math.round(n * 100) + " %";
  if (!spentPast.length && !budgetSum)
    tips.push({ tone: "tip", text: "Trag einen Monat lang deine Ausgaben ein (oder setz Budgets). Dann rechnet Hap aus, wie viel du realistisch sparen kannst." });
  if (state.holdings.some((h) => h.cash) || cash > 0) {
    if (cash >= cushion) tips.push({ tone: "good", text: "Dein Notgroschen (" + euro(cash, false) + ") deckt etwa 3 Monate Ausgaben. Faustregel erfüllt." });
    else tips.push({ tone: "tip", text: "Faustregel Notgroschen: etwa 3 Monatsausgaben (≈ " + euro(cushion, false) + ") schnell verfügbar, z. B. auf Tagesgeld. Dir fehlen noch " + euro(cushion - cash, false) + "." });
  } else
    tips.push({ tone: "tip", text: "Faustregel: Bevor du mehr investierst, einen Notgroschen von etwa 3 Monatsausgaben (≈ " + euro(cushion, false) + ") zurücklegen. Leg dafür ein Konto oder Tagesgeld unter Depot an, dann zeigt Hap den Fortschritt." });
  if (fixed / income > 0.5) tips.push({ tone: "tip", text: "Fixkosten und Abos sind " + pct(fixed / income) + " deines Einkommens. Die 50/30/20-Faustregel nennt höchstens 50 %." });
  if (rate >= 0.2) tips.push({ tone: "good", text: "Du sparst " + pct(rate) + " deines Einkommens (" + euro(saving, false) + "/Monat) – über der 20-%-Faustregel." });
  else tips.push({ tone: "tip", text: "Du sparst " + pct(rate) + " deines Einkommens. Die 50/30/20-Faustregel nennt 20 %, bei dir wären das " + euro(Math.round(income * 0.2), false) + " im Monat." });
  if (basis === "none") {
    // Without everyday spending a "leftover" would be misleading.
  } else if (leftover > 20)
    tips.push({ tone: "tip", text: "Nach Fixkosten, Sparplänen und " + (spentPast.length ? "deinen üblichen Ausgaben" : "deinen Budgets") + " bleiben rechnerisch etwa " + euro(Math.round(leftover), false) + " im Monat übrig. Was davon du fest sparen willst, entscheidest du – plan lieber etwas Puffer ein." });
  else if (leftover < 0)
    tips.push({ tone: "tip", text: "Rechnerisch fehlen dir " + euro(Math.round(-leftover), false) + " im Monat. Prüf Budgets und Abos, bevor die Sparpläne aus dem Puffer laufen." });
  const abos = rules.filter((r) => r.kind === "abo");
  if (abos.length) tips.push({ tone: "good", text: abos.length + (abos.length === 1 ? " Abo kostet " : " Abos kosten ") + euro(per("abo")) + " im Monat (" + euro(round2(per("abo") * 12)) + " im Jahr)." });
  return { income, fixed, saving, variable, leftover, rate, cash, cushion, depot, tips, basis };
}

// "1.250", "12,50", "1250.5" → number (German or plain notation).
export function parseAmount(value: string) {
  const v = value.trim().replace(/\s|€/g, "");
  if (!v) return 0;
  const n = v.includes(",") ? Number(v.replace(/\./g, "").replace(",", ".")) : /^\d{1,3}(\.\d{3})+$/.test(v) ? Number(v.replace(/\./g, "")) : Number(v);
  return Number.isFinite(n) && n >= 0 ? round2(n) : NaN;
}

export async function fetchQuotes(state: Pick<PlannerState, "apiUrl" | "accessToken" | "holdings">): Promise<Record<string, Quote | null> | string> {
  const items = state.holdings.filter((h) => !h.cash && (h.isin || h.symbol)).map((h) => ({ id: h.id, isin: h.isin, symbol: h.symbol }));
  if (!items.length) return {};
  if (!state.accessToken) return "Für Kurse braucht Hap deinen App-Zugang (Einstellungen).";
  const response = await fetch(state.apiUrl.replace(/\/$/, "") + "/.netlify/functions/quotes", {
    method: "POST",
    headers: { Authorization: "Bearer " + state.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung – die Kurse werden beim nächsten Öffnen aktualisiert.";
  if (response.status === 401) return "Der App-Zugang stimmt nicht mit HAP_ACCESS_TOKEN auf Netlify überein.";
  if (response.status === 404) return "Die Kursabfrage ist auf Netlify noch nicht verfügbar (neu deployen).";
  if (!response.ok) return "Die Kurse konnten gerade nicht geladen werden.";
  return ((await response.json()) as { quotes: Record<string, Quote | null> }).quotes;
}
