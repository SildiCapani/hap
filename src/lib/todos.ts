import {
  dateKey,
  localStamp,
  parseDate,
  parseStamp,
  shiftDay,
  type Todo,
} from "./planner.ts";

export const remindModes = {
  none: "Keine",
  once: "Einmal",
  daily: "Täglich",
  weekly: "Wöchentlich",
  hourly: "Alle paar Stunden",
  before: "Vor der Endzeit",
} as const;

export const defaultRemind: Todo["remind"] = {
  mode: "none",
  at: "",
  time: "09:00",
  weekday: 1,
  hours: 3,
  before: 60,
};

export type TodoState = "overdue" | "today" | "soon" | "later" | "open";

export function todoState(todo: Todo, now = new Date()): TodoState {
  if (!todo.due) return "open";
  const due = parseStamp(todo.due);
  if (due.valueOf() < now.valueOf()) return "overdue";
  const today = dateKey(now);
  const day = todo.due.slice(0, 10);
  if (day === today) return "today";
  return day <= shiftDay(today, 3) ? "soon" : "later";
}

// Open first, then by deadline (none last), then newest.
export function sortTodos(list: Todo[]) {
  return [...list].sort(
    (a, b) =>
      (a.due ? 0 : 1) - (b.due ? 0 : 1) ||
      a.due.localeCompare(b.due) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export function dueLabel(todo: Todo, now = new Date()) {
  if (!todo.due) return "";
  const due = parseStamp(todo.due);
  const today = dateKey(now);
  const day = todo.due.slice(0, 10);
  const time = todo.due.slice(11, 16);
  if (day === today) return "Heute " + time;
  if (day === shiftDay(today, 1)) return "Morgen " + time;
  if (day === shiftDay(today, -1)) return "Gestern " + time;
  return (
    due.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }) +
    " " +
    time
  );
}

export function remindLabel(todo: Todo) {
  const r = todo.remind;
  if (r.mode === "none") return "";
  if (r.mode === "once") return r.at ? "Erinnerung " + dueLabel({ ...todo, due: r.at }) : "";
  if (r.mode === "daily") return "Täglich " + r.time;
  if (r.mode === "weekly")
    return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][r.weekday] + " " + r.time;
  if (r.mode === "hourly") return "Alle " + r.hours + " Std.";
  return (r.before >= 1440 ? r.before / 1440 + " Tag" : r.before >= 60 ? r.before / 60 + " Std." : r.before + " Min.") + " vorher";
}

// Reminder times for one open to-do within the next days.
export function todoTimes(todo: Todo, now = Date.now(), days = 4): number[] {
  if (todo.doneAt) return [];
  const r = todo.remind;
  const today = dateKey(new Date(now));
  const at = (day: string, time: string) => parseStamp(day + "T" + time).valueOf();
  const until = parseDate(shiftDay(today, days)).valueOf();
  const dueAt = todo.due ? parseStamp(todo.due).valueOf() : Infinity;
  let times: number[] = [];
  if (r.mode === "once" && r.at) times = [parseStamp(r.at).valueOf()];
  if (r.mode === "before" && todo.due) times = [dueAt - r.before * 60000];
  for (let i = 0; i < days; i++) {
    const day = shiftDay(today, i);
    if (r.mode === "daily") times.push(at(day, r.time));
    if (r.mode === "weekly" && parseDate(day).getDay() === r.weekday) times.push(at(day, r.time));
    if (r.mode === "hourly" && i < 2)
      for (let h = 8; h <= 22; h += Math.max(1, r.hours)) times.push(at(day, String(h).padStart(2, "0") + ":00"));
  }
  // Repeating reminders stop at the deadline.
  return times.filter((t) => t > now && t <= until && (r.mode === "once" || r.mode === "before" || t <= dueAt));
}

export function newStamp(daysAhead = 0, time = "18:00") {
  return shiftDay(dateKey(), daysAhead) + "T" + time;
}

export { localStamp };
