import { dateKey, newId, shiftDay, type PlannerState, type Task, type Todo } from "./planner.ts";
import { clock, freeSlots } from "./study.ts";
import { minutes } from "./rapla.ts";

// Work time for deadlines (e.g. Moodle submissions): the effort is spread as
// blocks of 30–90 min into free time before the due date, so the work is
// done a day early where possible.

export const DEADLINE_NOTE = "Automatisch geplant (Abgabe)";

// A first guess from the title; the user confirms or changes it.
export function estimateEffort(title: string) {
  const t = title.toLowerCase();
  if (/hausarbeit|seminararbeit|projektarbeit|studienarbeit|bericht|paper|ausarbeitung|portfolio|essay/.test(t)) return 600;
  if (/projekt|programmier|implementier/.test(t)) return 360;
  if (/präsentation|vortrag|referat|poster/.test(t)) return 300;
  if (/quiz|umfrage|feedback|anmeld|registrier|einschreib|wahl/.test(t)) return 30;
  if (/übung|blatt|aufgabe|assignment|abgabe|labor|praktikum|lab\b/.test(t)) return 180;
  return 120;
}

export const blocksOf = (state: PlannerState, todoId: string) => state.tasks.filter((t) => t.todoId === todoId);
const isDone = (state: PlannerState, t: Task) => !!state.done[t.id + ":" + t.date];

export function deadlineStatus(state: PlannerState, todo: Todo, today = dateKey()) {
  const blocks = blocksOf(state, todo.id);
  const done = blocks.filter((b) => isDone(state, b)).reduce((n, b) => n + b.duration, 0);
  const planned = blocks.filter((b) => !isDone(state, b) && b.date >= today).reduce((n, b) => n + b.duration, 0);
  const left = Math.max(0, (todo.effort ?? 0) - done);
  return { effort: todo.effort, done, planned, left, missing: Math.max(0, left - planned) };
}

// Open deadlines in the next three weeks that still need time in the plan.
export function deadlinesToPlan(state: PlannerState, today = dateKey()) {
  const until = shiftDay(today, 21);
  return state.todos
    .filter((t) => !t.doneAt && t.due && t.due.slice(0, 10) >= today && t.due.slice(0, 10) <= until && t.effort !== 0)
    .filter((t) => t.effort === undefined || deadlineStatus(state, t, today).missing >= 30)
    .sort((a, b) => a.due.localeCompare(b.due));
}

// Removes the blocks of a deadline that are not done yet (from today on).
export function dropBlocks(state: PlannerState, todoId: string, today = dateKey()) {
  return state.tasks.filter((t) => !(t.todoId === todoId && t.date >= today && !isDone(state, t)));
}

const up15 = (n: number) => Math.ceil(n / 15) * 15;

export function planDeadline(state: PlannerState, todo: Todo, effort: number, now = new Date()) {
  const today = dateKey(now);
  const todoNext: Todo = { ...todo, effort };
  let working: PlannerState = { ...state, tasks: dropBlocks(state, todo.id, today), todos: state.todos.map((t) => (t.id === todo.id ? todoNext : t)) };
  let left = deadlineStatus(working, todoNext, today).left;
  const dueDay = todo.due.slice(0, 10);
  const dueAt = minutes(todo.due.slice(11, 16) || "23:59");
  const days: string[] = [];
  for (let d = today; d < dueDay; d = shiftDay(d, 1)) days.push(d);
  if (!days.length && dueDay >= today) days.push(dueDay);
  // Even spread, but never tiny bits or whole days.
  const cap = Math.min(180, Math.max(45, up15(left / Math.max(1, days.length))));
  const perDay: Record<string, number> = {};
  const created: Task[] = [];
  for (let round = 0; round < 4 && left > 0; round++) {
    let placed = false;
    for (const day of days) {
      if (left <= 0) break;
      if ((perDay[day] || 0) >= cap) continue;
      const earliest = day === today ? up15(now.getHours() * 60 + now.getMinutes() + 15) : 8 * 60;
      const latest = day === dueDay ? Math.min(21 * 60 + 30, dueAt - 60) : 21 * 60 + 30;
      const want = Math.min(up15(left), 30);
      const slot = freeSlots(working, day, Math.max(8 * 60, earliest), latest).find((s) => s.end - up15(s.start) >= want);
      if (!slot) continue;
      const start = up15(slot.start);
      // A small rest may go a little over the daily share instead of being lost.
      const length = Math.min(90, up15(left), slot.end - start, Math.max(want, cap - (perDay[day] || 0)));
      if (length < want) continue;
      const task: Task = {
        id: newId("task"),
        title: ("Abgabe: " + todo.title).slice(0, 80),
        note: DEADLINE_NOTE,
        date: day,
        time: clock(start),
        duration: length,
        category: "uni",
        icon: "laptop",
        repeat: "none",
        skipped: [],
        todoId: todo.id,
      };
      created.push(task);
      working = { ...working, tasks: [...working.tasks, task] };
      left -= length;
      perDay[day] = (perDay[day] || 0) + length;
      placed = true;
    }
    if (!placed) break;
  }
  return { state: working, created, missing: Math.max(0, left) };
}
