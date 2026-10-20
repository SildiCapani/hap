import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/lib/planner.ts";
import { AUTO_NOTE, autoSchedule, planningWeek, suggestedTargets } from "../src/lib/weekplan.ts";
import { currentMeals, groceriesFor } from "../src/lib/mealplan.ts";

test("weekends plan the next week, weekdays the current one", () => {
  assert.equal(planningWeek("2026-10-25"), "2026-10-26");
  assert.equal(planningWeek("2026-10-24"), "2026-10-26");
  assert.equal(planningWeek("2026-10-21"), "2026-10-19");
});

test("study blocks fill free time before the exam, max 3 h a day, and replace older auto blocks", () => {
  const state = createState("2026-10-25");
  state.tasks = [{ id: "old", title: "Lernen: alt", note: AUTO_NOTE, date: "2026-10-27", time: "10:00", duration: 60, category: "uni", icon: "brain", repeat: "none", skipped: [] }];
  state.uniEvents = [{ id: "u", date: "2026-10-26", start: "08:00", end: "17:00", title: "KI", persons: [], rooms: [], kind: "lecture" }];
  state.exams = [{ id: "vs", title: "VS", kind: "exam", date: "2026-10-29", time: "", hours: 20, topics: [], note: "" }];
  const now = new Date(2026, 9, 25, 18, 0);
  const targets = Object.fromEntries(suggestedTargets(state, "2026-10-26", "2026-10-25").map((t) => [t.exam.id, t.minutes]));
  assert.ok(targets.vs > 0);
  const result = autoSchedule(state, "2026-10-26", { vs: 600 }, now);
  assert.ok(!result.tasks.some((t) => t.id === "old"), "old automatic block is replaced");
  const byDay = {};
  for (const t of result.created) byDay[t.date] = (byDay[t.date] || 0) + t.duration;
  assert.deepEqual(Object.keys(byDay).sort(), ["2026-10-26", "2026-10-27", "2026-10-28"], "only before the exam");
  assert.ok(Object.values(byDay).every((m) => m <= 180));
  const monday = result.created.filter((t) => t.date === "2026-10-26");
  assert.ok(monday.every((t) => t.time >= "17:00"), "not during the lecture");
  assert.equal(result.missing, 600 - Object.values(byDay).reduce((a, b) => a + b, 0));
});

test("meal view follows edited and deleted meal tasks", async () => {
  const { importMeals } = await import("../src/lib/planner.ts");
  const plan = { weekStart: "2026-10-19", generatedAt: "x", days: Array.from({ length: 7 }, (_, i) => ({ date: "2026-10-" + (19 + i), breakfast: "Porridge", lunch: "Bowl", dinner: "Pasta" })), groceries: [{ name: "Hafer", amount: "1", category: "Vorrat" }] };
  const state = importMeals(createState("2026-10-19"), plan);
  state.tasks = state.tasks.map((t) => (t.id === "meal-2026-10-19-lunch" ? { ...t, title: "Mensa" } : t)).filter((t) => t.id !== "meal-2026-10-19-dinner");
  const day = currentMeals(state, plan)[0].meals;
  assert.deepEqual(day.map((m) => [m.current, m.changed]), [["Porridge", false], ["Mensa", true], [null, true]]);
  const g = groceriesFor(state, plan);
  assert.equal(g.outdated, true);
  state.groceryList = { weekStart: plan.weekStart, basis: g.basis, items: [{ name: "Reis", amount: "1", category: "Vorrat" }] };
  assert.deepEqual([groceriesFor(state, plan).outdated, groceriesFor(state, plan).items[0].name], [false, "Reis"]);
});
