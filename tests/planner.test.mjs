import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  dateKey,
  importMeals,
  monday,
  occurrenceKey,
  occurs,
  progress,
  readState,
  shiftDay,
  streak,
  tasksFor,
  validDate,
} from "../src/lib/planner.ts";

test("local dates, DST and year boundaries preserve calendar days", () => {
  assert.equal(monday("2027-01-01"), "2026-12-28");
  assert.equal(shiftDay("2026-10-25", 1), "2026-10-26");
  assert.equal(shiftDay("2026-03-29", -1), "2026-03-28");
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(dateKey(new Date(2026, 9, 16)), "2026-10-16");
});
test("daily, weekly, weekdays, start dates and skipped instances", () => {
  const state = createState("2026-10-16");
  assert.equal(tasksFor(state, "2026-10-15").length, 0);
  assert.equal(tasksFor(state, "2026-10-16").length, 4);
  assert.equal(tasksFor(state, "2026-10-17").length, 3);
  assert.equal(
    occurs({ ...state.tasks[0], repeat: "weekly" }, "2026-10-23"),
    true,
  );
  assert.equal(
    occurs({ ...state.tasks[0], repeat: "none" }, "2026-10-23"),
    false,
  );
  assert.equal(
    occurs({ ...state.tasks[0], skipped: ["2026-10-17"] }, "2026-10-17"),
    false,
  );
});
test("completion is per day, reversible and survives a storage round trip", () => {
  const state = createState("2026-10-16");
  for (const t of tasksFor(state, "2026-10-16"))
    state.done[occurrenceKey(t, "2026-10-16")] = true;
  assert.equal(progress(state, "2026-10-16").perfect, true);
  assert.equal(progress(state, "2026-10-17").done, 0);
  assert.equal(streak(state, "2026-10-17"), 1);
  const loaded = readState(JSON.stringify(state));
  assert.equal(progress(loaded, "2026-10-16").done, 4);
  loaded.done[occurrenceKey(loaded.tasks[0], "2026-10-16")] = false;
  assert.equal(progress(loaded, "2026-10-16").perfect, false);
  assert.equal(streak(loaded, "2026-10-17"), 0);
});
test("meals import once and preserve edits, completion and deletions on refresh", () => {
  const initial = createState("2026-10-16");
  const plan = {
    weekStart: "2026-10-19",
    generatedAt: "2026-10-18T06:00:00Z",
    days: Array.from({ length: 7 }, (_, i) => ({
      date: shiftDay("2026-10-19", i),
      breakfast: "Porridge",
      lunch: "Bowl",
      dinner: "Pasta",
    })),
    groceries: [{ name: "Haferflocken", amount: "500 g", category: "Vorrat" }],
  };
  const first = importMeals(initial, plan);
  assert.equal(first.tasks.length, 25);
  const meal = first.tasks[4];
  meal.title = "Mein angepasstes Frühstück";
  first.done[occurrenceKey(meal, meal.date)] = true;
  first.tasks = first.tasks.filter((t) => t.id !== first.tasks[5].id);
  const second = importMeals(readState(JSON.stringify(first)), {
    ...plan,
    generatedAt: "2026-10-18T07:00:00Z",
  });
  assert.equal(second.tasks.length, 24);
  assert.equal(second.tasks[4].title, "Mein angepasstes Frühstück");
  assert.equal(second.done[occurrenceKey(meal, meal.date)], true);
});
test("corrupt backups cannot replace valid state", () => {
  assert.throws(() => readState("not json"));
  assert.throws(() => readState(JSON.stringify({ version: 1, tasks: [] })));
  const state = createState("2026-10-16");
  state.tasks[0].time = "25:00";
  assert.throws(() => readState(JSON.stringify(state)));
});
