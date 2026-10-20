import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/lib/planner.ts";
import { applySynced, merge3, subset } from "../src/lib/sync.ts";

const todo = (id, title, doneAt = null) => ({ id, title, due: "", remind: { mode: "none", at: "", time: "09:00", weekday: 1, hours: 3, before: 60 }, createdAt: "x", doneAt });

test("changes from two devices are combined instead of overwritten", () => {
  const base = createState("2026-10-20");
  base.todos = [todo("a", "Wäsche"), todo("b", "Blatt 3")];
  const phone = structuredClone(base), laptop = structuredClone(base);
  phone.todos.push(todo("c", "Gym-Tasche packen")); // added on the phone
  phone.todos[0].doneAt = "2026-10-20T10:00"; // a done on the phone
  laptop.todos = laptop.todos.filter((t) => t.id !== "b"); // b deleted on the laptop
  laptop.todos.push(todo("d", "Mail an Prof")); // added on the laptop
  laptop.done["start-1:2026-10-20"] = true;
  phone.done["start-2:2026-10-20"] = true;
  laptop.name = "Sildi";
  const merged = applySynced(phone, merge3(subset(base), subset(phone), subset(laptop)));
  assert.deepEqual(merged.todos.map((t) => [t.id, !!t.doneAt]), [["a", true], ["c", false], ["d", false]]);
  assert.deepEqual(merged.done, { "start-1:2026-10-20": true, "start-2:2026-10-20": true });
  assert.equal(merged.name, "Sildi");
});

test("device-only fields stay local and conflicts keep this device's version", () => {
  const base = createState("2026-10-20");
  base.todos = [todo("a", "Alt")];
  const local = structuredClone(base), remote = structuredClone(base);
  local.todos[0].title = "Lokal";
  remote.todos[0].title = "Remote";
  local.accessToken = "secret-local";
  remote.accessToken = "should-not-arrive";
  remote.notify.enabled = true;
  const merged = applySynced(local, merge3(subset(base), subset(local), subset(remote)));
  assert.equal(merged.todos[0].title, "Lokal");
  assert.equal(merged.accessToken, "secret-local");
  assert.equal(merged.notify.enabled, false);
  assert.ok(!("accessToken" in subset(local)));
});
