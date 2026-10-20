import { dateKey, monday, newId, parseDate, shiftDay, type PlannerState, type Task } from "./planner.ts";
import { clock, examStatus, freeSlots, upcomingExams } from "./study.ts";
import { weekSummary, workoutsFor } from "./training.ts";
import { agenda } from "./agenda.ts";

export const AUTO_NOTE = "Automatisch geplant (Wochenplanung)";

// On weekends the review plans the coming week, otherwise the current one.
export function planningWeek(today = dateKey()) {
  const day = parseDate(today).getDay();
  return day === 0 || day === 6 ? shiftDay(monday(today), 7) : monday(today);
}

export function weekDays(weekStart: string, today = dateKey()) {
  return Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i)).filter((d) => d >= today);
}

export function review(state: PlannerState, weekStart: string) {
  const last = shiftDay(weekStart, -7);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(last, i));
  const focus = state.focus.filter((f) => days.includes(f.date)).reduce((n, f) => n + f.minutes, 0);
  const todos = state.todos.filter((t) => t.doneAt && days.includes(t.doneAt.slice(0, 10))).length;
  const training = weekSummary(state, last);
  return { focus, todos, training };
}

export function preview(state: PlannerState, weekStart: string) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  const lectures = days.flatMap((d) => agenda(state, d).timed.filter((i) => i.kind === "uni"));
  return {
    lectureMinutes: lectures.reduce((n, l) => n + l.end - l.start, 0),
    lectures: lectures.length,
    deadlines: [
      ...state.exams.filter((e) => days.includes(e.date)).map((e) => ({ date: e.date, title: e.title })),
      ...state.todos.filter((t) => !t.doneAt && t.due && days.includes(t.due.slice(0, 10))).map((t) => ({ date: t.due.slice(0, 10), title: t.title })),
    ].sort((a, b) => a.date.localeCompare(b.date)),
    workouts: days.flatMap((d) => workoutsFor(state, d).map((w) => ({ date: d, name: w.name }))),
  };
}

// Suggested study minutes per exam for the planned days of the week.
export function suggestedTargets(state: PlannerState, weekStart: string, today = dateKey()) {
  const days = weekDays(weekStart, today);
  return upcomingExams(state, today)
    .filter((x) => x.left > 0 && x.days > 0)
    .map((x) => {
      const usable = days.filter((d) => d < x.exam.date).length;
      const perDay = examStatus(state, x.exam, days[0] || today).perDay;
      return { exam: x.exam, minutes: Math.min(x.left, Math.round((perDay * usable) / 15) * 15) };
    })
    .filter((t) => t.minutes > 0);
}

// Spreads the targets as study blocks (45–90 min, max 3 h a day) into free
// time before each exam. Earlier automatic blocks of that week are replaced.
export function autoSchedule(state: PlannerState, weekStart: string, targets: Record<string, number>, now = new Date()) {
  const today = dateKey(now);
  const days = weekDays(weekStart, today);
  const keep = state.tasks.filter((t) => !(t.note === AUTO_NOTE && days.includes(t.date) && !state.done[t.id + ":" + t.date]));
  let working: PlannerState = { ...state, tasks: keep };
  const left = { ...targets };
  const created: Task[] = [];
  const perDay: Record<string, number> = {};
  for (let round = 0; round < 6; round++) {
    let placed = false;
    for (const day of days) {
      if ((perDay[day] || 0) >= 180) continue;
      // Most urgent first: remaining minutes divided by days left before the exam.
      const candidates = state.exams
        .filter((e) => (left[e.id] || 0) >= 30 && day < e.date)
        .sort((a, b) => left[b.id] / Math.max(1, days.filter((d) => d < b.date).length) - left[a.id] / Math.max(1, days.filter((d) => d < a.date).length));
      const exam = candidates[0];
      if (!exam) continue;
      const earliest = day === today ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 15) / 15) * 15 : 8 * 60;
      const slot = freeSlots(working, day, Math.max(8 * 60, earliest), 21 * 60 + 30).find((s) => s.end - s.start >= 45);
      if (!slot) continue;
      const start = Math.ceil(slot.start / 15) * 15;
      const length = Math.min(90, left[exam.id], slot.end - start, 180 - (perDay[day] || 0));
      if (length < 30) continue;
      const task: Task = {
        id: newId("task"),
        title: "Lernen: " + exam.title,
        note: AUTO_NOTE,
        date: day,
        time: clock(start),
        duration: length,
        category: "uni",
        icon: "brain",
        repeat: "none",
        skipped: [],
      };
      created.push(task);
      working = { ...working, tasks: [...working.tasks, task] };
      left[exam.id] -= length;
      perDay[day] = (perDay[day] || 0) + length;
      placed = true;
    }
    if (!placed) break;
  }
  return { tasks: working.tasks, created, missing: Object.values(left).reduce((n, m) => n + Math.max(0, m), 0) };
}
