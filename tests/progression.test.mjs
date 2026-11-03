import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/lib/planner.ts";
import { loadStep, rotationPick, suggestion, workoutsFor } from "../src/lib/training.ts";

const log = (date, name, sets, workoutId = "w") => ({ id: "l" + date + name, workoutId, name: "x", date, minutes: 60, entries: [{ exerciseId: "e", name, sets }] });
const sets = (n, reps, weight, last = reps) => Array.from({ length: n }, (_, i) => ({ reps: i === n - 1 ? last : reps, weight }));
const bench = { id: "b", name: "Bankdrücken", sets: 4, reps: 8, weight: 60 };
// Six older sessions at lighter weights: no beginner any more.
const history = ["2026-09-01", "2026-09-05", "2026-09-09", "2026-09-13", "2026-09-17", "2026-09-21"].map((d) => log(d, "Bankdrücken", sets(4, 8, 55)));

test("steps follow the weight: about 5 % for legs, 2.5 % elsewhere, never below the equipment step", () => {
  assert.equal(loadStep("Bankdrücken", 60), 2.5);
  assert.equal(loadStep("Kniebeugen", 70), 2.5);
  assert.equal(loadStep("Kniebeugen", 100), 5);
  assert.equal(loadStep("Beinpresse", 160), 7.5);
  assert.equal(loadStep("Bizepscurls", 12), 2);
  assert.equal(loadStep("Seitheben", 8), 1);
});

test("after the beginner phase a weight increase needs two complete sessions or clearly more reps", () => {
  const state = { ...createState(), workoutLogs: [...history, log("2026-10-27", "Bankdrücken", sets(4, 8, 60))] };
  assert.deepEqual([suggestion(state, bench, "2026-10-30").weight, suggestion(state, bench, "2026-10-30").note], [60, "Noch 1× alle Wdh., dann +2,5 kg"]);
  state.workoutLogs.push(log("2026-10-30", "Bankdrücken", sets(4, 8, 60)));
  assert.equal(suggestion(state, bench, "2026-11-02").weight, 62.5);
  state.workoutLogs = [...history, log("2026-10-27", "Bankdrücken", sets(4, 10, 60))];
  assert.equal(suggestion(state, bench, "2026-10-30").weight, 62.5, "two reps above the target");
});

test("big relative jumps go reps first, misses and long breaks go back down", () => {
  const curl = { id: "c", name: "Bizepscurls", sets: 3, reps: 12, weight: 12 };
  const many = history.map((l) => log(l.date, "Bizepscurls", sets(3, 12, 10)));
  let state = { ...createState(), workoutLogs: [...many, log("2026-10-27", "Bizepscurls", sets(3, 12, 12))] };
  assert.deepEqual(suggestion(state, curl, "2026-10-30"), { weight: 12, reps: 13, note: "Erst 14 Wdh. schaffen, dann +2 kg" });
  state.workoutLogs.push(log("2026-10-30", "Bizepscurls", sets(3, 14, 12)));
  assert.equal(suggestion(state, curl, "2026-11-02").weight, 14);
  state = { ...createState(), workoutLogs: [...history, ...["2026-10-20", "2026-10-24", "2026-10-28"].map((d) => log(d, "Bankdrücken", sets(4, 8, 60, 5)))] };
  assert.equal(suggestion(state, bench, "2026-11-01").weight, 55, "three misses: −10 %");
  state = { ...createState(), workoutLogs: [log("2026-09-20", "Bankdrücken", sets(4, 8, 60))] };
  assert.equal(suggestion(state, bench, "2026-10-25").weight, 55, "five weeks off: −10 %");
});

test("push and pull take turns on their days, legs stay on Sunday", () => {
  const w = (id, name, weekdays, rotate) => ({ id, name, weekdays, time: "18:00", duration: 60, exercises: [], ...(rotate ? { rotate: true } : {}) });
  const state = { ...createState(), workouts: [w("push", "Push", [1, 3, 5], true), w("pull", "Pull", [1, 3, 5], true), w("legs", "Beine & Bauch", [0], false)] };
  state.workoutLogs = [log("2026-10-30", "Klimmzüge", [], "pull")];
  assert.deepEqual(workoutsFor(state, "2026-11-01").map((x) => x.name), ["Beine & Bauch"]);
  const pick = (day, today) => rotationPick(state, day, today)?.name;
  assert.equal(pick("2026-10-30", "2026-11-02"), "Pull", "logged day keeps what was trained");
  assert.deepEqual(["2026-11-02", "2026-11-04", "2026-11-06"].map((d) => pick(d, "2026-11-02")), ["Push", "Pull", "Push"]);
  assert.equal(pick("2026-11-04", "2026-11-04"), "Push", "a skipped Monday does not count");
  assert.equal(pick("2026-11-03", "2026-11-02"), undefined, "Tuesday is no rotation day");
});
