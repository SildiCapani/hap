import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/lib/planner.ts";
import { defaultRemind, sortTodos, todoState, todoTimes } from "../src/lib/todos.ts";
import { reminders } from "../src/lib/reminders.ts";

const now = new Date(2026, 9, 20, 12, 0);
const todo = (over = {}) => ({ id: "t", title: "Blatt", due: "", remind: { ...defaultRemind }, createdAt: "2026-10-20T10:00", doneAt: null, ...over });

test("to-do states follow the deadline", () => {
  assert.equal(todoState(todo(), now), "open");
  assert.equal(todoState(todo({ due: "2026-10-20T11:00" }), now), "overdue");
  assert.equal(todoState(todo({ due: "2026-10-20T18:00" }), now), "today");
  assert.equal(todoState(todo({ due: "2026-10-22T18:00" }), now), "soon");
  assert.equal(todoState(todo({ due: "2026-11-02T18:00" }), now), "later");
  assert.deepEqual(sortTodos([todo({ id: "a" }), todo({ id: "b", due: "2026-10-21T10:00" })]).map((t) => t.id), ["b", "a"]);
});

test("reminder rules produce the right times and stop at the deadline or when done", () => {
  assert.deepEqual(todoTimes(todo({ due: "2026-10-21T18:00", remind: { ...defaultRemind, mode: "before", before: 60 } }), now.valueOf()), [new Date(2026, 9, 21, 17, 0).valueOf()]);
  const daily = todoTimes(todo({ due: "2026-10-22T08:00", remind: { ...defaultRemind, mode: "daily", time: "09:00" } }), now.valueOf());
  assert.deepEqual(daily, [new Date(2026, 9, 21, 9, 0).valueOf()], "today's 09:00 passed, 22nd is after the deadline");
  const hourly = todoTimes(todo({ remind: { ...defaultRemind, mode: "hourly", hours: 4 } }), now.valueOf());
  assert.deepEqual(hourly.map((t) => new Date(t).getHours()), [16, 20, 8, 12, 16, 20]);
  assert.deepEqual(todoTimes(todo({ doneAt: "2026-10-20T11:00", remind: { ...defaultRemind, mode: "daily" } }), now.valueOf()), []);
  const state = createState("2026-10-20");
  state.notify.enabled = true;
  state.todos = [todo({ due: "2026-10-21T18:00", remind: { ...defaultRemind, mode: "before", before: 60 } })];
  const r = reminders(state, now.valueOf()).find((x) => x.id.startsWith("todo:"));
  assert.equal(r.url, "/todos");
  // Worded from the moment the reminder arrives (17:00 on the due day).
  assert.match(r.body, /Heute 18:00/);
});
