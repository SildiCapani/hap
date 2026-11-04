import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/lib/planner.ts";
import { deadlineStatus, deadlinesToPlan, dropBlocks, estimateEffort, planDeadline } from "../src/lib/deadlines.ts";
import { bundlesIn } from "../src/lib/update.ts";

const todo = (id, title, due, extra = {}) => ({ id, title, due, remind: { mode: "none", at: "", time: "09:00", weekday: 1, hours: 3, before: 1440 }, createdAt: "", doneAt: null, ...extra });
const now = new Date("2026-11-04T09:00:00");

test("effort guesses come from the title", () => {
  assert.equal(estimateEffort("Übungsblatt 3 Verteilte Systeme"), 180);
  assert.equal(estimateEffort("Seminararbeit Abgabe"), 600);
  assert.equal(estimateEffort("Quiz Kapitel 2"), 30);
  assert.equal(estimateEffort("Irgendwas"), 120);
});

test("work time is spread over the days before the deadline", () => {
  const blatt = todo("t1", "Übungsblatt 3", "2026-11-07T23:59");
  const state = { ...createState("2026-11-01"), tasks: [], todos: [blatt] };
  assert.deepEqual(deadlinesToPlan(state, "2026-11-04").map((t) => t.id), ["t1"], "no effort yet: shows up");
  const r = planDeadline(state, blatt, 180, now);
  assert.deepEqual(r.created.map((b) => [b.date, b.time, b.duration]), [["2026-11-04", "09:15", 60], ["2026-11-05", "08:00", 60], ["2026-11-06", "08:00", 60]]);
  assert.equal(r.missing, 0);
  assert.ok(r.created.every((b) => b.todoId === "t1" && b.category === "uni"));
  assert.deepEqual(deadlinesToPlan(r.state, "2026-11-04"), [], "fully planned: gone from the card");
  // One block done, plan again: only the rest is planned.
  const done = { ...r.state, done: { [r.created[0].id + ":2026-11-04"]: true } };
  const st = deadlineStatus(done, done.todos[0], "2026-11-05");
  assert.deepEqual([st.done, st.left, st.planned], [60, 120, 120]);
  const again = planDeadline(done, done.todos[0], 180, new Date("2026-11-05T07:00:00"));
  assert.equal(again.created.reduce((n, b) => n + b.duration, 0), 120);
  assert.equal(dropBlocks(again.state, "t1", "2026-11-05").filter((t) => t.todoId).length, 1, "done block stays");
  assert.deepEqual(deadlinesToPlan({ ...state, todos: [{ ...blatt, effort: 0 }] }, "2026-11-04"), [], "✕ = needs no time");
  // Around a normal day's routine nothing gets lost either.
  const busy = planDeadline({ ...createState("2026-11-01"), todos: [blatt] }, blatt, 180, now);
  assert.equal(busy.missing, 0);
  assert.equal(busy.created.reduce((n, b) => n + b.duration, 0), 180);
});

test("a new deploy is recognised by its bundle names", () => {
  const a = '<script src="/_expo/static/js/web/entry-aaa.js" defer></script>';
  const b = '<script src="/_expo/static/js/web/entry-bbb.js" defer></script>';
  assert.equal(bundlesIn(a), "/_expo/static/js/web/entry-aaa.js");
  assert.notEqual(bundlesIn(a), bundlesIn(b));
  assert.equal(bundlesIn("<script src='/node_modules/expo-router/entry.bundle'></script>"), "");
});
