import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/lib/planner.ts";
import { travelPlan } from "../src/lib/transport.ts";
import { agenda } from "../src/lib/agenda.ts";
import { freeSlots } from "../src/lib/study.ts";
import { reminders } from "../src/lib/reminders.ts";

const day = "2026-10-21";
const lecture = (id, start, end, rooms = ["LE1-A4.06 Vorlesung"]) => ({ id, date: day, start, end, title: "Vorlesung " + id, persons: [], rooms, kind: "lecture" });
function setup() {
  const state = createState(day);
  state.tasks = [];
  state.transport = { enabled: true, buffer: 5, remind: 5 };
  state.places = [
    { id: "dhbw", name: "DHBW", minutes: 35, mode: "transit", keywords: ["LE1"], lectures: true, training: false },
    { id: "gym", name: "Gym", minutes: 10, mode: "walk", keywords: [], lectures: false, training: true },
  ];
  return state;
}

test("leave early enough, stay between close lectures, go home in long gaps", () => {
  const state = setup();
  state.uniEvents = [lecture("a", "08:00", "11:30"), lecture("b", "12:00", "14:00"), lecture("c", "18:00", "19:00")];
  const legs = travelPlan(state, day).map((l) => [l.from, l.to, l.depart, l.minutes, l.late]);
  assert.deepEqual(legs, [
    ["home", "dhbw", 8 * 60 - 40, 35, 0], // 07:20 for 08:00
    ["dhbw", "home", 14 * 60, 35, 0], // 4 h gap → home
    ["home", "dhbw", 18 * 60 - 40, 35, 0],
    ["dhbw", "home", 19 * 60, 35, 0],
  ]);
});

test("tight changes are flagged, travel blocks show up and block study slots", () => {
  const state = setup();
  state.uniEvents = [lecture("a", "08:00", "10:00")];
  state.workouts = [{ id: "w", name: "Push", weekdays: [3], time: "10:15", duration: 60, exercises: [] }];
  const legs = travelPlan(state, day);
  const toGym = legs.find((l) => l.to === "gym");
  assert.equal(toGym.minutes, 35, "between two places the longer time from home is used");
  assert.equal(toGym.estimated, true);
  assert.equal(toGym.late, 25, "10:15 − 5 − 35 = 09:35, lecture ends 10:00");
  const items = agenda(state, day).timed.filter((i) => i.kind === "travel");
  assert.equal(items[0].title, "Losgehen → DHBW");
  assert.match(items[1].sub, /zu knapp/);
  assert.ok(!freeSlots(state, day).some((s) => s.start < 7 * 60 + 55 && s.end > 7 * 60 + 20));
  state.notify.enabled = true;
  const r = reminders(state, new Date(2026, 9, 21, 6, 0).valueOf()).find((x) => x.id.startsWith("travel:"));
  assert.equal(new Date(r.at).getHours() * 60 + new Date(r.at).getMinutes(), 7 * 60 + 15);
  assert.match(r.title, /In 5 Min\. losgehen – DHBW/);
});

test("online events and disabled planning need no travel", () => {
  const state = setup();
  state.uniEvents = [lecture("a", "08:00", "10:00", ["Online (Zoom)"])];
  state.places[0].lectures = false;
  assert.deepEqual(travelPlan(state, day), []);
  state.places[0].lectures = true;
  state.transport.enabled = false;
  state.uniEvents = [lecture("b", "08:00", "10:00")];
  assert.deepEqual(travelPlan(state, day), []);
});
