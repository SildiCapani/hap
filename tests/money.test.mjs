import test from "node:test";
import assert from "node:assert/strict";
import { createState, readState } from "../src/lib/planner.ts";
import { holdingNow, occurrences, parseAmount, period, periodSummary, projection, reviewScan, savingsCheck, scanEntry, sharesOn } from "../src/lib/money.ts";
import quotesHandler, { parseChart } from "../netlify/functions/quotes.mjs";
import { cleanExpenses } from "../netlify/functions/expense-scan.mjs";
import { LOCAL_KEYS } from "../src/lib/sync.ts";

const rule = (id, kind, name, amount, day, every = "month", extra = {}) => ({ id, kind, name, amount, every, day, start: "2026-10-25", ...extra });
const mine = () => ({
  ...createState(),
  payday: 25,
  moneyRules: [
    rule("salary", "income", "Gehalt", 1250, 25),
    rule("weekly", "income", "Wochengeld", 47, 1, "week"),
    rule("rent", "fixed", "Warmmiete", 600, 1),
    rule("power", "fixed", "Strom", 35, 1),
    rule("net", "fixed", "Internet", 27, 1),
    rule("icloud", "abo", "iCloud 50 GB", 1, 5),
    rule("tr1", "saving", "Sparplan", 100, 2, "month", { holdingId: "etf" }),
    rule("tr2", "saving", "Sparplan", 20, 16, "month", { holdingId: "etf" }),
  ],
  moneyEntries: [{ id: "e1", date: "2026-10-27", amount: 23.4, kind: "expense", category: "essen", note: "Rewe" }],
});

test("money period runs from payday to payday and books every rule", () => {
  assert.deepEqual(period(25, "2026-10-27"), { start: "2026-10-25", end: "2026-11-24", next: "2026-11-25" });
  assert.deepEqual(period(25, "2026-10-24"), { start: "2026-09-25", end: "2026-10-24", next: "2026-10-25" });
  assert.equal(period(31, "2026-02-28").start, "2026-02-28", "short months book on their last day");
  assert.deepEqual(occurrences(rule("w", "income", "x", 47, 1, "week"), "2026-10-25", "2026-11-24"), ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
  const p = periodSummary(mine(), "2026-10-27");
  assert.equal(p.income, 1250 + 5 * 47);
  assert.equal(p.fixed, 662);
  assert.equal(p.abos, 1);
  assert.equal(p.saved, 120);
  assert.equal(p.spent, 23.4);
  assert.equal(p.free, 1485 - 662 - 1 - 120 - 23.4);
  assert.equal(p.expected, 4 * 47, "four Mondays still to come");
  assert.equal(p.daysLeft, 29);
  assert.equal(p.byCategory[0].key, "essen");
});

test("one salary can be changed for a single month (Mensa deducted)", () => {
  const state = { ...mine(), moneyOverrides: { "salary:2026-10-25": 1180.5 } };
  assert.equal(periodSummary(state, "2026-10-27").income, 1180.5 + 235);
  assert.equal(periodSummary(state, "2026-11-27").income, 1250 + 4 * 47, "next month is back to normal");
});

test("savings plans buy shares at the day's price and the depot is valued", () => {
  const state = {
    ...mine(),
    holdings: [{ id: "etf", name: "All-World", isin: "IE00BK5BQT80", symbol: "", cash: false, shares: 10, invested: 1500, since: "2026-10-27" }],
    quotes: { etf: { symbol: "VWCE.DE", name: "x", currency: "EUR", price: 160, at: "2026-11-20T10:00:00Z", history: [{ date: "2026-10-27", close: 145 }, { date: "2026-11-02", close: 150 }, { date: "2026-11-13", close: 158 }, { date: "2026-11-16", close: 160 }] } },
  };
  const now = holdingNow(state, state.holdings[0], "2026-11-20");
  assert.equal(now.invested, 1620);
  assert.equal(now.shares, Math.round((10 + 100 / 150 + 20 / 160) * 10000) / 10000);
  assert.equal(now.value, Math.round((10 + 100 / 150 + 20 / 160) * 160 * 100) / 100);
  assert.ok(now.gain > 0);
  assert.equal(sharesOn(state, state.holdings[0], state.quotes.etf, "2026-11-10"), 10 + 100 / 150);
  // No price yet: only what was paid in is known.
  assert.equal(holdingNow({ ...state, quotes: {} }, state.holdings[0], "2026-11-20").value, null);
});

test("savings check uses rules of thumb from the user's own numbers", () => {
  const state = { ...mine(), budgets: { essen: 200, freizeit: 100 } };
  const check = savingsCheck(state, "2026-10-27");
  assert.equal(Math.round(check.income), Math.round(1250 + (47 * 52) / 12));
  assert.equal(check.fixed, 663);
  assert.equal(check.saving, 120);
  assert.equal(check.variable, 300, "no history yet → budgets");
  const text = check.tips.map((t) => t.text).join("\n");
  assert.match(text, /Notgroschen/);
  assert.match(text, /50\/30\/20/);
  assert.match(text, /1 Abo kostet 1 €/);
  assert.equal(projection(0, 100, 0, 10), 12000);
  assert.ok(projection(1000, 100, 0.06, 10) > 12000 + 1000);
});

test("amounts in German notation, prices stay on each device, quotes parse", () => {
  assert.equal(parseAmount("1.250"), 1250);
  assert.equal(parseAmount("12,50 €"), 12.5);
  assert.equal(parseAmount("23.4"), 23.4);
  assert.ok(Number.isNaN(parseAmount("abc")));
  assert.ok(LOCAL_KEYS.includes("quotes"));
  const state = readState(JSON.stringify({ ...createState(), payday: 25 }));
  assert.deepEqual([state.payday, state.moneyRules, state.holdings], [25, [], []]);
  assert.throws(() => readState(JSON.stringify({ ...createState(), moneyEntries: [{ id: "x", date: "kaputt", amount: 1 }] })));
  const quote = parseChart({ chart: { result: [{ meta: { symbol: "VWCE.DE", currency: "EUR", regularMarketPrice: 171.1, gmtoffset: 3600, longName: "Vanguard" }, timestamp: [1792998000, 1793084400], indicators: { quote: [{ close: [170.5, null] }] } }] } });
  assert.deepEqual([quote.symbol, quote.price, quote.history.length], ["VWCE.DE", 171.1, 1]);
});

test("without everyday spending there is no made-up leftover", () => {
  const check = savingsCheck(mine(), "2026-10-27");
  assert.equal(check.basis, "none");
  assert.ok(!check.tips.some((t) => /übrig/.test(t.text)));
  assert.equal(savingsCheck({ ...mine(), budgets: { essen: 200 } }, "2026-10-27").basis, "budgets");
});

test("quotes tells a refusing Yahoo apart from an unknown fund", async () => {
  const token = "t".repeat(40);
  process.env.HAP_ACCESS_TOKEN = token;
  const realFetch = globalThis.fetch;
  const ask = (items) => quotesHandler(new Request("http://x/", { method: "POST", headers: { Authorization: "Bearer " + token }, body: JSON.stringify({ items }) })).then((r) => r.json());
  try {
    globalThis.fetch = async () => new Response("Too Many Requests", { status: 429 });
    assert.deepEqual(await ask([{ id: "a", isin: "IE00B4L5Y983" }]), { quotes: { a: null }, errors: { a: "refused" } });
    globalThis.fetch = async () => Response.json({ quotes: [] });
    assert.deepEqual(await ask([{ id: "a", isin: "IE00B4L5Y983" }]), { quotes: { a: null }, errors: { a: "not-found" } });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("screenshot payments are checked against the pay period, entries and Hap's own bookings", () => {
  const item = (date, merchant, amount, type = "expense", category = "essen") => ({ date, merchant, amount, type, category });
  const rows = reviewScan(mine(), [
    item("2026-11-02", "Lidl", 12.5),
    item("2026-11-02", "Lidl", 12.5),
    item("2026-10-27", "REWE", 23.4),
    item("2026-11-01", "Vermieter", 600, "expense", "sonstiges"),
    item("2026-10-24", "Bäcker", 3.2, "expense", "mensa"),
    item("2026-11-02", "Sparplan", 100, "transfer", "sonstiges"),
    item("2026-10-30", "Zalando", 19.99, "refund", "sonstiges"),
  ], "2026-11-03");
  assert.deepEqual(rows.map((r) => [r.merchant, r.reason, r.pick]), [
    ["Lidl", "", true],
    ["REWE", "duplicate", false],
    ["Vermieter", "fixed", false],
    ["Bäcker", "before", false],
    ["Sparplan", "other", false],
    ["Zalando", "other", false],
  ]);
  assert.deepEqual(scanEntry(rows[0], "x"), { id: "x", date: "2026-11-02", amount: 12.5, kind: "expense", category: "essen", note: "Lidl" });
  assert.equal(scanEntry(rows[5], "y").kind, "income");
  assert.equal(scanEntry(rows[5], "y").note, "Erstattung Zalando");
  assert.deepEqual(
    cleanExpenses({ items: [{ date: "2026-12-01", merchant: " DB ", amount: -9.9, type: "expense", category: "bahn" }, { date: "", merchant: "x", amount: 0, type: "expense", category: "essen" }] }, "2026-11-03"),
    [{ date: "2026-11-03", merchant: "DB", amount: 9.9, type: "expense", category: "sonstiges" }],
  );
});
