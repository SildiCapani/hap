import {
  categories,
  occurrenceKey,
  tasksFor,
  type PlannerState,
  type Task,
  type Workout,
  type Exam,
} from "./planner.ts";
import { minutes, type UniEvent } from "./rapla.ts";
import type { CalEvent } from "./ics.ts";
import { clock, examKinds, focusPick, hoursLabel, upcomingExams } from "./study.ts";
import { loggedOn, workoutsFor } from "./training.ts";

export type AgendaItem = {
  key: string;
  kind: "task" | "uni" | "training" | "exam" | "cal";
  title: string;
  start: number;
  end: number;
  color: string;
  pale: string;
  sub: string;
  done: boolean;
  task?: Task;
  event?: UniEvent;
  workout?: Workout;
  exam?: Exam;
  cal?: CalEvent;
};

export const uniColor = { color: "#B9A2F2", pale: "#2A2440" };
export const examColor = { color: "#F07B83", pale: "#3D2229" };

const allDayUni = (e: UniEvent) => minutes(e.end) - minutes(e.start) >= 9 * 60;

export function agenda(state: PlannerState, day: string) {
  const timed: AgendaItem[] = [];
  const allDay: AgendaItem[] = [];
  for (const task of tasksFor(state, day)) {
    const c = categories[task.category];
    const start = minutes(task.time);
    timed.push({
      key: "t:" + task.id,
      kind: "task",
      title: task.title,
      start,
      end: Math.min(24 * 60, start + task.duration),
      color: c.color,
      pale: c.pale,
      sub: c.label,
      done: !!state.done[occurrenceKey(task, day)],
      task,
    });
  }
  for (const e of state.uniEvents.filter((x) => x.date === day)) {
    const item: AgendaItem = {
      key: "u:" + e.id,
      kind: "uni",
      title: e.title,
      start: minutes(e.start),
      end: minutes(e.end),
      ...(e.kind === "exam" ? examColor : uniColor),
      sub: [e.rooms[0], e.persons[0]].filter(Boolean).join(" · ") || "Vorlesung",
      done: false,
      event: e,
    };
    (allDayUni(e) ? allDay : timed).push(item);
  }
  for (const e of state.calEvents.filter((x) => x.date === day)) {
    const cal = state.calendars.find((c) => c.id === e.calId);
    if (!cal) continue;
    const item: AgendaItem = {
      key: "c:" + e.id,
      kind: "cal",
      title: e.title,
      start: minutes(e.start),
      end: Math.max(minutes(e.end), minutes(e.start)),
      color: cal.color,
      pale: cal.color + "26",
      sub: [e.location, cal.name].filter(Boolean).join(" · "),
      done: false,
      cal: e,
    };
    (e.allDay ? allDay : timed).push(item);
  }
  for (const w of workoutsFor(state, day)) {
    const start = minutes(w.time);
    timed.push({
      key: "w:" + w.id,
      kind: "training",
      title: w.name + " – Training",
      start,
      end: Math.min(24 * 60, start + w.duration),
      color: categories.sport.color,
      pale: categories.sport.pale,
      sub: w.exercises.length + " Übungen",
      done: !!loggedOn(state, w.id, day),
      workout: w,
    });
  }
  for (const exam of state.exams.filter((x) => x.date === day)) {
    const k = examKinds[exam.kind];
    const item: AgendaItem = {
      key: "e:" + exam.id,
      kind: "exam",
      title: k.label + ": " + exam.title,
      start: exam.time ? minutes(exam.time) : 0,
      end: exam.time ? minutes(exam.time) + 90 : 0,
      color: k.color,
      pale: examColor.pale,
      sub: exam.kind === "assignment" ? "Deadline" : "Viel Erfolg!",
      done: false,
      exam,
    };
    (exam.time && exam.kind !== "assignment" ? timed : allDay).push(item);
  }
  timed.sort((a, b) => a.start - b.start || b.end - a.end);
  return { timed, allDay };
}

// Assigns overlapping items to side-by-side columns (like Outlook's day view).
export function layout(items: AgendaItem[]) {
  const placed: { item: AgendaItem; col: number; cols: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    for (const p of cluster) p.cols = cols;
    cluster = [];
  };
  for (const item of items) {
    const end = Math.max(item.end, item.start + 20);
    if (item.start >= clusterEnd) flush();
    const used = new Set(
      cluster.filter((p) => Math.max(p.item.end, p.item.start + 20) > item.start).map((p) => p.col),
    );
    let col = 0;
    while (used.has(col)) col++;
    const entry = { item, col, cols: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return placed;
}

export function nextUp(state: PlannerState, day: string, now: number) {
  const { timed } = agenda(state, day);
  const current = timed.find((i) => i.start <= now && i.end > now && !i.done);
  const next = timed.find((i) => i.start > now && !i.done);
  return { current, next };
}

export function briefing(state: PlannerState, day: string) {
  const { timed, allDay } = agenda(state, day);
  const lectures = timed.filter((i) => i.kind === "uni");
  const training = timed.filter((i) => i.kind === "training");
  const lines: string[] = [];
  for (const a of allDay) lines.push(a.title);
  if (lectures.length)
    lines.push(
      lectures.length +
        (lectures.length === 1 ? " Vorlesung" : " Vorlesungen") +
        ", ab " +
        clock(lectures[0].start) +
        " (" +
        lectures[0].title +
        ")",
    );
  if (training.length) lines.push("Training: " + training.map((t) => t.workout?.name + " um " + clock(t.start)).join(", "));
  const pick = focusPick(state, day);
  if (pick)
    lines.push(
      "Lernziel: " +
        hoursLabel(Math.max(0, pick.perDay - pick.today)) +
        " " +
        pick.exam.title +
        " (" +
        examKinds[pick.exam.kind].label +
        " in " +
        pick.days +
        (pick.days === 1 ? " Tag)" : " Tagen)"),
    );
  const soon = upcomingExams(state, day).filter((s) => s.days > 0 && s.days <= 3);
  for (const s of soon)
    if (s.exam.id !== pick?.exam.id)
      lines.push(examKinds[s.exam.kind].label + " " + s.exam.title + " in " + s.days + (s.days === 1 ? " Tag" : " Tagen"));
  const tasks = timed.filter((i) => i.kind === "task");
  if (tasks.length) lines.push(tasks.length + (tasks.length === 1 ? " Aufgabe" : " Aufgaben") + " geplant");
  return lines;
}
