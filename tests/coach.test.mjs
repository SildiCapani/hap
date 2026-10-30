import test from "node:test";
import assert from "node:assert/strict";
import { createState, readState } from "../src/lib/planner.ts";
import { saveFocus, weekFacts } from "../src/lib/coach.ts";
import { cleanFocus } from "../netlify/functions/week-focus.mjs";

const rule = (id, kind, name, amount, day, every = "month") => ({ id, kind, name, amount, every, day, start: "2026-10-25" });

test("weekly facts carry the numbers but no personal texts", () => {
  const state = {
    ...createState(),
    payday: 25,
    moneyRules: [rule("salary", "income", "Gehalt", 1250, 25), rule("rent", "fixed", "Warmmiete", 600, 1)],
    moneyEntries: [{ id: "e1", date: "2026-10-27", amount: 56, kind: "expense", category: "freizeit", note: "Bar mit Lena" }],
    budgets: { freizeit: 80 },
    todos: [{ id: "t1", title: "Arzttermin geheim", due: "2026-10-20T18:00", remind: { mode: "none" }, createdAt: "", doneAt: null }],
    weekFocus: [{ id: "2026-10-19", created: "", good: "", items: [{ area: "essen", title: "Protein hoch", why: "", action: "Skyr", done: true }] }],
  };
  const { week, facts } = weekFacts(state, "2026-10-28");
  assert.equal(week, "2026-10-26");
  assert.match(facts, /Freizeit 56 € von 80 € Budget \(70 %\)/);
  assert.match(facts, /1 offen, davon 1 überfällig/);
  assert.match(facts, /„Protein hoch“ geschafft/);
  assert.doesNotMatch(facts, /Lena|Arzttermin/);
  assert.equal(weekFacts(state, "2026-10-31").week, "2026-11-02", "weekends look at the coming week");
});

test("focus answers are trimmed to three short points and old weeks drop out", () => {
  const long = "x".repeat(300);
  const clean = cleanFocus({ good: long, items: [1, 2, 3, 4].map((n) => ({ area: n === 1 ? "mond" : "geld", title: "T" + n, why: long, action: "A" + n })) });
  assert.equal(clean.items.length, 3);
  assert.equal(clean.items[0].area, "alltag");
  assert.equal(clean.good.length, 120);
  assert.equal(clean.items[1].why.length, 120);
  assert.deepEqual(cleanFocus({ items: [{ area: "geld", title: "", why: "", action: "x" }] }).items, []);
  let list = [];
  for (let i = 0; i < 10; i++) list = saveFocus(list, { id: "2026-0" + (1 + Math.floor(i / 3)) + "-1" + (i % 3), created: "", good: "", items: [] });
  assert.equal(list.length, 8);
  const raw = JSON.stringify({ ...createState(), weekFocus: [{ id: "2026-10-26", created: "", good: "", items: [{ area: "geld", title: "a", why: "b", action: "c", done: false }] }, { id: "kaputt" }] });
  assert.equal(readState(raw).weekFocus.length, 1);
});
