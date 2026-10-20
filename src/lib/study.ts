import {
  parseDate,
  shiftDay,
  tasksFor,
  type Exam,
  type PlannerState,
} from "./planner.ts";
import { minutes } from "./rapla.ts";

export const examKinds = {
  exam: { label: "Klausur", color: "#F07B83" },
  assignment: { label: "Abgabe", color: "#E5B073" },
  presentation: { label: "Präsentation", color: "#92B9DB" },
} as const;

export function daysUntil(date: string, today: string) {
  return Math.round(
    (parseDate(date).valueOf() - parseDate(today).valueOf()) / 86400000,
  );
}

export function studiedMinutes(state: PlannerState, examId: string, until?: string) {
  return state.focus
    .filter((f) => f.examId === examId && (!until || f.date <= until))
    .reduce((sum, f) => sum + f.minutes, 0);
}

export type ExamStatus = {
  exam: Exam;
  days: number;
  done: number;
  left: number;
  perDay: number;
  today: number;
  topicsDone: number;
  pressure: "relaxed" | "steady" | "tight" | "critical" | "past";
};

// Remaining hours are spread evenly over the days before the deadline.
export function examStatus(state: PlannerState, exam: Exam, today: string): ExamStatus {
  const days = daysUntil(exam.date, today);
  const done = studiedMinutes(state, exam.id);
  const left = Math.max(0, exam.hours * 60 - done);
  const doneToday = state.focus
    .filter((f) => f.examId === exam.id && f.date === today)
    .reduce((sum, f) => sum + f.minutes, 0);
  const leftBeforeToday = left + doneToday;
  const perDay = days <= 0 ? left : Math.ceil(leftBeforeToday / days);
  const pressure =
    days < 0
      ? "past"
      : left === 0
        ? "relaxed"
        : perDay > 240
          ? "critical"
          : perDay > 120
            ? "tight"
            : perDay > 45
              ? "steady"
              : "relaxed";
  return {
    exam,
    days,
    done,
    left,
    perDay,
    today: doneToday,
    topicsDone: exam.topics.filter((t) => t.done).length,
    pressure,
  };
}

export function upcomingExams(state: PlannerState, today: string) {
  return state.exams
    .map((e) => examStatus(state, e, today))
    .filter((s) => s.days >= 0)
    .sort((a, b) => a.days - b.days);
}

// The exam that needs attention today: most minutes still missing today.
export function focusPick(state: PlannerState, today: string) {
  return upcomingExams(state, today)
    .filter((s) => s.left > 0 && s.perDay - s.today > 0)
    .sort((a, b) => b.perDay - b.today - (a.perDay - a.today) || a.days - b.days)[0];
}

export type Slot = { start: number; end: number };

// Free gaps between 08:00 and 22:00, considering tasks and lectures.
export function freeSlots(state: PlannerState, day: string, from = 8 * 60, to = 22 * 60): Slot[] {
  const busy: Slot[] = [
    ...tasksFor(state, day).map((t) => ({
      start: minutes(t.time),
      end: minutes(t.time) + t.duration,
    })),
    ...state.uniEvents
      .filter((e) => e.date === day && e.kind !== "info")
      .map((e) => ({ start: minutes(e.start), end: minutes(e.end) })),
  ].sort((a, b) => a.start - b.start);
  const slots: Slot[] = [];
  let cursor = from;
  for (const b of busy) {
    if (b.start > cursor) slots.push({ start: cursor, end: Math.min(b.start, to) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= to) break;
  }
  if (cursor < to) slots.push({ start: cursor, end: to });
  return slots.filter((s) => s.end - s.start >= 30);
}

export function suggestBlock(state: PlannerState, day: string, wanted: number, after = 0) {
  const slot = freeSlots(state, day).find((s) => s.end - Math.max(s.start, after) >= Math.min(wanted, 45));
  if (!slot) return null;
  const start = Math.ceil(Math.max(slot.start, after) / 15) * 15;
  return { start, length: Math.min(wanted, slot.end - start, 120) };
}

export function clock(total: number) {
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}

export function hoursLabel(mins: number) {
  if (mins < 60) return mins + " Min.";
  const h = mins / 60;
  return (Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")) + " h";
}

export function focusByDay(state: PlannerState, today: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = shiftDay(today, i - count + 1);
    return {
      date: d,
      minutes: state.focus.filter((f) => f.date === d).reduce((s, f) => s + f.minutes, 0),
    };
  });
}

export function studyStreak(state: PlannerState, today: string, goal = 25) {
  const per = new Map<string, number>();
  for (const f of state.focus) per.set(f.date, (per.get(f.date) || 0) + f.minutes);
  let day = (per.get(today) || 0) >= goal ? today : shiftDay(today, -1);
  let count = 0;
  while ((per.get(day) || 0) >= goal && count < 3660) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}
