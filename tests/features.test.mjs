import test from "node:test";
import assert from "node:assert/strict";
import { createState, finishFocus, levelFor, readState, totalXp } from "../src/lib/planner.ts";
import { parseRapla, raplaWeeksUrl, validRaplaUrl } from "../src/lib/rapla.ts";
import { examStatus, freeSlots, suggestBlock, studyStreak } from "../src/lib/study.ts";
import { nutrition, presets, suggestion, workoutsFor } from "../src/lib/training.ts";
import { agenda, briefing, layout } from "../src/lib/agenda.ts";
import { reminders } from "../src/lib/reminders.ts";

// Minimal Rapla week: Monday has one lecture, Tuesday two parallel ones
// (wider header), so the grid must honour colspan and rowspan.
const block = (time, title, room, rows) =>
  `<td valign="top" class="week_block" rowspan="${rows}"><a href="#0">${time}<br/>${title}</a><br><span class="person">Prof</span><br><span class="resource">${room}</span><br><span class="resource">STG-TINF24C</span></td>`;
const html = `<table class="week_table"><tbody>
<tr><th class="week_number">KW 52</th><td class="week_header" colspan="3"><nobr>Mo 28.12.</nobr></td><td class="week_header" colspan="5"><nobr>Di 29.12.</nobr></td><td class="week_header" colspan="3"><nobr>Mo 04.01.</nobr></td></tr>
<tr><td class="week_times" rowspan="4">08:00</td><td class="week_smallseparatorcell">&nbsp;</td>${block("08:00&#160;-10:00", "Verteilte Systeme", "A1", 8)}<td class="week_separatorcell">&nbsp;</td><td class="week_smallseparatorcell">&nbsp;</td>${block("08:30&#160;-09:30", "Klausur Mathe", "B2", 4)}<td class="week_separatorcell">&nbsp;</td>${block("09:00&#160;-11:00", "Seminar &quot;KI&quot;", "C3", 8)}<td class="week_separatorcell">&nbsp;</td><td class="week_smallseparatorcell">&nbsp;</td><td class="week_emptycell">&nbsp;</td><td class="week_separatorcell">&nbsp;</td></tr>
</tbody></table>`;

test("rapla grid maps blocks to the right day and rolls over the year", () => {
  const events = parseRapla(html, "2026-12-28");
  assert.deepEqual(
    events.map((e) => [e.date, e.start, e.end, e.title, e.kind, e.rooms.join()]),
    [
      ["2026-12-28", "08:00", "10:00", "Verteilte Systeme", "lecture", "A1"],
      ["2026-12-29", "08:30", "09:30", "Klausur Mathe", "exam", "B2"],
      ["2026-12-29", "09:00", "11:00", 'Seminar "KI"', "lecture", "C3"],
    ],
  );
  assert.equal(validRaplaUrl("https://rapla.dhbw.de/rapla/internal_calendar?key=abc&salt=1"), true);
  assert.equal(validRaplaUrl("https://evil.example/rapla/internal_calendar?key=abc"), false);
  assert.equal(validRaplaUrl("http://rapla.dhbw.de/rapla/internal_calendar?key=abc"), false);
  const url = new URL(raplaWeeksUrl("https://rapla.dhbw.de/rapla/internal_calendar?key=abc&salt=1", "2026-10-05", 40));
  assert.equal(url.searchParams.get("pages"), "20");
  assert.equal(url.searchParams.get("day"), "5");
  assert.equal(url.searchParams.get("key"), "abc");
});

const exam = (over = {}) => ({
  id: "e1", title: "Verteilte Systeme", kind: "exam", date: "2026-10-30", time: "", hours: 10, topics: [], note: "", ...over,
});

test("exam workload is spread over the remaining days", () => {
  const state = createState("2026-10-20");
  state.exams = [exam()];
  let s = examStatus(state, state.exams[0], "2026-10-20");
  assert.equal(s.days, 10);
  assert.equal(s.perDay, 60);
  assert.equal(s.pressure, "steady");
  state.activeFocus = { examId: "e1", label: "VS", startedAt: new Date(2026, 9, 20, 9).valueOf(), endsAt: 0, minutes: 50, pausedLeft: null };
  const after = finishFocus(state, 50);
  s = examStatus(after, after.exams[0], "2026-10-20");
  assert.equal(s.today, 50);
  assert.equal(s.perDay, 60, "today's target stays stable while studying");
  assert.equal(after.activeFocus, null);
  assert.equal(studyStreak(after, "2026-10-20"), 1);
  assert.equal(finishFocus({ ...state }, 0).focus.length, 0, "short rounds are dropped");
});

test("free slots avoid lectures and tasks", () => {
  const state = createState("2026-10-20");
  state.tasks = [];
  state.uniEvents = [
    { id: "u1", date: "2026-10-20", start: "08:30", end: "11:00", title: "IT", persons: [], rooms: [], kind: "lecture" },
    { id: "u2", date: "2026-10-20", start: "12:00", end: "15:15", title: "ML", persons: [], rooms: [], kind: "lecture" },
  ];
  assert.deepEqual(freeSlots(state, "2026-10-20").map((x) => [x.start, x.end]), [[8 * 60, 8 * 60 + 30], [11 * 60, 12 * 60], [15 * 60 + 15, 22 * 60]]);
  assert.deepEqual(suggestBlock(state, "2026-10-20", 90, 13 * 60), { start: 15 * 60 + 15, length: 90 });
});

test("agenda layout puts overlapping items side by side", () => {
  const state = createState("2026-10-20");
  state.tasks = [];
  state.uniEvents = [
    { id: "a", date: "2026-10-20", start: "08:00", end: "10:00", title: "A", persons: [], rooms: [], kind: "lecture" },
    { id: "b", date: "2026-10-20", start: "09:00", end: "11:00", title: "B", persons: [], rooms: [], kind: "lecture" },
    { id: "c", date: "2026-10-20", start: "12:00", end: "13:00", title: "C", persons: [], rooms: [], kind: "lecture" },
    { id: "w", date: "2026-10-20", start: "08:00", end: "18:00", title: "Klausurwoche", persons: [], rooms: [], kind: "exam" },
  ];
  const { timed, allDay } = agenda(state, "2026-10-20");
  assert.equal(allDay.length, 1);
  assert.deepEqual(layout(timed).map((p) => [p.item.title, p.col, p.cols]), [["A", 0, 2], ["B", 1, 2], ["C", 0, 1]]);
  assert.ok(briefing(state, "2026-10-20").some((l) => l.startsWith("3 Vorlesungen")));
});

test("training suggests more weight after a complete session", () => {
  const state = createState("2026-10-20");
  state.workouts = presets[0].build();
  const push = state.workouts[0];
  assert.deepEqual(workoutsFor(state, "2026-10-19").map((w) => w.name), ["Push"]);
  const bench = push.exercises[0];
  assert.equal(suggestion(state, bench, "2026-10-19").weight, 60);
  state.workoutLogs = [{ id: "l", workoutId: push.id, name: "Push", date: "2026-10-19", minutes: 70, entries: [{ exerciseId: bench.id, name: bench.name, sets: Array.from({ length: 4 }, () => ({ reps: 8, weight: 60 })) }] }];
  assert.equal(suggestion(state, bench, "2026-10-22").weight, 62.5);
  state.workoutLogs[0].entries[0].sets[3].reps = 6;
  assert.equal(suggestion(state, bench, "2026-10-22").weight, 60);
  const t = nutrition(state.profile, true), r = nutrition(state.profile, false);
  assert.ok(t.kcal > r.kcal);
  assert.equal(t.protein, 150);
});

test("reminders cover lectures, briefing and the running focus round", () => {
  const state = createState("2026-10-20");
  state.notify.enabled = true;
  state.uniEvents = [{ id: "u", date: "2026-10-20", start: "14:00", end: "16:00", title: "KI", persons: [], rooms: ["A4.06"], kind: "lecture" }];
  const now = new Date(2026, 9, 20, 7, 0).valueOf();
  state.activeFocus = { examId: "", label: "Frei", startedAt: now, endsAt: now + 25 * 60000, minutes: 25, pausedLeft: null };
  const list = reminders(state, now);
  const lecture = list.find((r) => r.id.startsWith("u:"));
  assert.equal(new Date(lecture.at).getHours(), 13);
  assert.equal(new Date(lecture.at).getMinutes(), 45);
  assert.match(lecture.body, /A4\.06/);
  assert.ok(list.some((r) => r.id === "brief:2026-10-20"));
  assert.equal(list[0].id, "focus");
  assert.ok(list.length <= 60);
  state.notify.enabled = false;
  assert.deepEqual(reminders(state, now).map((r) => r.id), ["focus"]);
});

test("old backups gain the new fields and XP levels grow", () => {
  const old = createState("2026-10-16");
  for (const key of ["raplaUrl", "uniEvents", "exams", "focus", "workouts", "workoutLogs", "profile", "notify", "protein", "bodyWeight", "activeFocus", "uniSynced"]) delete old[key];
  const loaded = readState(JSON.stringify(old));
  assert.deepEqual(loaded.exams, []);
  assert.equal(loaded.profile.age, 22);
  assert.equal(loaded.notify.enabled, false);
  assert.deepEqual(levelFor(0), { level: 1, into: 0, need: 200 });
  assert.deepEqual(levelFor(550), { level: 3, into: 50, need: 400 });
  assert.equal(totalXp(loaded, "2026-10-16"), 0);
  const broken = { ...loaded, exams: [{ id: 1 }] };
  assert.throws(() => readState(JSON.stringify(broken)));
});
