import test from "node:test";
import assert from "node:assert/strict";
import { createState, shiftDay } from "../src/lib/planner.ts";
import { nutrition } from "../src/lib/training.ts";
import { exerciseTrends, foodDays, foodInsights, foodSummary, measuredNeed, trainingInsights, trainingWeeks, weightTrend } from "../src/lib/progress.ts";

const today = "2026-10-24"; // Saturday
const log = (date, weight, reps = 8) => ({
  id: "l" + date,
  workoutId: "w1",
  name: "Push",
  date,
  minutes: 60,
  entries: [{ exerciseId: "e1", name: "Bankdrücken", sets: [{ reps, weight }, { reps, weight }] }],
});
const base = () => ({ ...createState(), workouts: [{ id: "w1", name: "Push", weekdays: [1, 4], time: "18:00", duration: 60, exercises: [] }] });

test("weekly training summary and strength trend with record and stagnation", () => {
  const state = { ...base(), workoutLogs: [log("2026-09-28", 60), log("2026-10-01", 62.5), log("2026-10-05", 65), log("2026-10-08", 65), log("2026-10-12", 65), log("2026-10-15", 62.5)] };
  const weeks = trainingWeeks(state, today, 5);
  assert.deepEqual(weeks.map((w) => [w.start, w.done, w.planned]), [
    ["2026-09-21", 0, 2],
    ["2026-09-28", 2, 2],
    ["2026-10-05", 2, 2],
    ["2026-10-12", 2, 2],
    ["2026-10-19", 0, 2],
  ]);
  assert.equal(weeks[1].volume, 2 * 8 * 60 + 2 * 8 * 62.5);
  const [bench] = exerciseTrends(state, today, 91);
  assert.equal(bench.sessions, 6);
  assert.equal(bench.change, 3.2, "62.5 kg × 8 vs 60 kg × 8 as estimated 1RM (79.2 vs 76)");
  assert.equal(bench.bestDate, "2026-10-05");
  assert.equal(bench.stalled, true, "the last three sessions did not beat 65 kg");
  const tips = trainingInsights(state, today).map((i) => i.text).join("\n");
  assert.match(tips, /Bankdrücken stagniert/);
  assert.match(tips, /Gewicht ein/, "asks for body weight when none is logged");
});

test("body weight trend in kg per week and feedback for the goal", () => {
  const bodyWeight = [0, 7, 14, 21, 28].map((d, i) => ({ date: shiftDay("2026-09-26", d), kg: 75 + i * 0.6 }));
  assert.equal(weightTrend({ ...base(), bodyWeight }, today, 42).perWeek, 0.6);
  assert.equal(weightTrend({ ...base(), bodyWeight: bodyWeight.slice(0, 1) }, today, 42).perWeek, null);
  const bulk = trainingInsights({ ...base(), bodyWeight }, today).map((i) => i.text).join("\n");
  assert.match(bulk, /schneller als nötig/);
  const cut = trainingInsights({ ...base(), bodyWeight, profile: { ...base().profile, goal: "cut" } }, today).map((i) => i.text).join("\n");
  assert.match(cut, /nur \+0,6 kg\/Woche ab/);
});

test("food days count unknown days as not logged and measure the real energy need", () => {
  const state = base();
  const foodLog = [];
  // 20 of the last 28 days logged with 2800 kcal, weight stable.
  for (let i = 1; i <= 28; i++) {
    if (i % 4 === 0) continue;
    foodLog.push({ id: "f" + i, date: shiftDay(today, -i), time: "12:00", name: "Essen", kcal: 2800, protein: 120, carbs: 300, fat: 90, items: [], source: "manual" });
  }
  const bodyWeight = [shiftDay(today, -27), shiftDay(today, -14), shiftDay(today, -1)].map((date) => ({ date, kg: 75 }));
  const full = { ...state, foodLog, bodyWeight };
  const days = foodDays(full, today, 7);
  assert.equal(days.length, 7);
  assert.equal(days[6].logged, false, "today has no entries");
  assert.equal(days.find((d) => d.date === shiftDay(today, -4)).logged, false);
  const sum = foodSummary(days.slice(0, -1));
  assert.equal(sum.logged, 5);
  assert.equal(sum.kcal, 2800);
  const need = measuredNeed(full, today);
  assert.equal(need.need, 2800, "stable weight → maintenance equals what was eaten");
  assert.equal(need.offset, need.need - need.formula);
  // The correction moves every target by the same amount.
  const shifted = nutrition({ ...state.profile, kcalOffset: 200 }, true).kcal - nutrition(state.profile, true).kcal;
  assert.equal(shifted, 200);
  const tips = foodInsights(full, today).map((i) => i.text).join("\n");
  assert.match(tips, /Protein nur an 0 von/);
  assert.match(tips, /Bedarf bei etwa 2800 kcal/);
  assert.equal(measuredNeed({ ...full, bodyWeight: bodyWeight.slice(1) }, today), null, "two weigh-ins are not enough");
});
