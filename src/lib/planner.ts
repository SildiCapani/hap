import type { UniEvent } from "./rapla";
import type { CalEvent } from "./ics";

export const categories = {
  uni: { label: "Uni", color: "#C4A3EF", pale: "#2D263C", icon: "graduation" },
  sport: {
    label: "Sport",
    color: "#E5B073",
    pale: "#352A21",
    icon: "dumbbell",
  },
  food: { label: "Essen", color: "#98C5A9", pale: "#23342B", icon: "utensils" },
  life: {
    label: "Alltag",
    color: "#92B9DB",
    pale: "#23313E",
    icon: "sparkles",
  },
} as const;
export type Category = keyof typeof categories;
export type Repeat = "none" | "daily" | "weekdays" | "weekly";
export type Task = {
  id: string;
  title: string;
  note: string;
  date: string;
  time: string;
  duration: number;
  category: Category;
  icon: string;
  repeat: Repeat;
  skipped: string[];
  placeId?: string;
  lead?: number; // own reminder minutes (e.g. from an invitation), else the global setting
  source?: string; // "ics:<uid>" for imported invitations
};
export type Meal = {
  date: string;
  breakfast: string;
  lunch: string;
  dinner: string;
};
export type MealPlan = {
  weekStart: string;
  generatedAt: string;
  days: Meal[];
  groceries: { name: string; amount: string; category: string }[];
};
export type ExamKind = "exam" | "assignment" | "presentation";
export type Exam = {
  id: string;
  title: string;
  kind: ExamKind;
  date: string;
  time: string;
  hours: number;
  topics: { id: string; title: string; done: boolean }[];
  note: string;
};
export type FocusSession = {
  id: string;
  date: string;
  start: string;
  minutes: number;
  examId: string;
  label: string;
};
export type ActiveFocus = {
  examId: string;
  label: string;
  startedAt: number;
  endsAt: number;
  minutes: number;
  pausedLeft: number | null;
};
export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
};
export type Workout = {
  id: string;
  name: string;
  weekdays: number[];
  time: string;
  duration: number;
  exercises: Exercise[];
};
export type WorkoutLog = {
  id: string;
  workoutId: string;
  name: string;
  date: string;
  minutes: number;
  entries: {
    exerciseId: string;
    name: string;
    sets: { reps: number; weight: number }[];
  }[];
};
// One workout moved for a single day (another time and/or another date).
export type WorkoutMove = { id: string; workoutId: string; from: string; to: string; time: string };
export type SetDraft = { reps: string; weight: string; done: boolean };
export type ActiveWorkout = {
  workoutId: string;
  day: string;
  startedAt: number;
  sets: Record<string, SetDraft[]>;
};
export type RemindMode = "none" | "once" | "daily" | "weekly" | "hourly" | "before";
export type Todo = {
  id: string;
  title: string;
  due: string; // "YYYY-MM-DDTHH:MM" or ""
  remind: {
    mode: RemindMode;
    at: string; // once: "YYYY-MM-DDTHH:MM"
    time: string; // daily/weekly: "HH:MM"
    weekday: number;
    hours: number; // hourly: every n hours between 08:00 and 22:00
    before: number; // minutes before due
  };
  createdAt: string;
  doneAt: string | null;
};
export type FoodEntry = {
  id: string;
  date: string;
  time: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: { name: string; amount: string; kcal: number }[];
  source: "photo" | "manual" | "barcode";
};
export type Calendar = {
  id: string;
  name: string;
  url: string;
  color: string;
  lead: number; // reminder minutes before an event, 0 = none
  syncedAt: string;
  error: string;
  asTodos?: boolean; // e.g. Moodle deadlines become to-dos
  imported?: string[]; // events already turned into to-dos (also if deleted later)
};
export type Place = {
  id: string;
  name: string;
  minutes: number; // travel time from home
  mode: "transit" | "walk";
  keywords: string[];
  lectures: boolean; // lectures from Rapla take place here
  training: boolean; // workouts take place here
};
export type TransportSettings = {
  enabled: boolean;
  buffer: number;
  remind: number; // minutes before leaving, -1 = off
};
export type Goal = "bulk" | "cut" | "maintain";
export type Profile = {
  age: number;
  male: boolean;
  height: number;
  weight: number;
  goal: Goal;
  diet: string;
  kcalOffset?: number; // correction from the measured energy need (Verlauf)
};
export type NotifySettings = {
  enabled: boolean;
  lead: number;
  lectures: boolean;
  tasks: boolean;
  exams: boolean;
  training: boolean;
  briefing: string;
  review: string;
};
export type PlannerState = {
  version: 1;
  tasks: Task[];
  done: Record<string, boolean>;
  groceries: Record<string, boolean>;
  started: string;
  name: string;
  gentle: boolean;
  apiUrl: string;
  accessToken: string;
  mealPlan: MealPlan | null;
  importedWeeks: string[];
  raplaUrl: string;
  uniEvents: UniEvent[];
  uniSynced: string;
  exams: Exam[];
  focus: FocusSession[];
  activeFocus: ActiveFocus | null;
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  workoutMoves: WorkoutMove[];
  activeWorkout: ActiveWorkout | null;
  bodyWeight: { date: string; kg: number }[];
  protein: Record<string, number>;
  profile: Profile;
  notify: NotifySettings;
  installHidden: boolean;
  cloudLinked: boolean;
  todos: Todo[];
  foodLog: FoodEntry[];
  calendars: Calendar[];
  calEvents: CalEvent[];
  places: Place[];
  transport: TransportSettings;
  groceryList: { weekStart: string; basis: string; items: MealPlan["groceries"] } | null;
  weekPlanned: string; // Monday of the last week planned with the Sunday review
};
export const defaultProfile: Profile = {
  age: 22,
  male: true,
  height: 180,
  weight: 75,
  goal: "bulk",
  diet: "",
};
export const defaultTransport: TransportSettings = { enabled: false, buffer: 5, remind: 5 };
export const defaultNotify: NotifySettings = {
  enabled: false,
  lead: 10,
  lectures: true,
  tasks: true,
  exams: true,
  training: true,
  briefing: "07:30",
  review: "21:30",
};
const extras = (): Omit<
  PlannerState,
  | "version"
  | "tasks"
  | "done"
  | "groceries"
  | "started"
  | "name"
  | "gentle"
  | "apiUrl"
  | "accessToken"
  | "mealPlan"
  | "importedWeeks"
> => ({
  raplaUrl: "",
  uniEvents: [],
  uniSynced: "",
  exams: [],
  focus: [],
  activeFocus: null,
  workouts: [],
  workoutLogs: [],
  activeWorkout: null,
  workoutMoves: [],
  bodyWeight: [],
  protein: {},
  profile: { ...defaultProfile },
  notify: { ...defaultNotify },
  installHidden: false,
  cloudLinked: false,
  todos: [],
  foodLog: [],
  calendars: [],
  calEvents: [],
  places: [],
  transport: { ...defaultTransport },
  groceryList: null,
  weekPlanned: "",
});
export const storageKey = "hap.planner.v1";
export const repeats: Record<Repeat, string> = {
  none: "Einmalig",
  daily: "Täglich",
  weekdays: "Mo – Fr",
  weekly: "Wöchentlich",
};
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
// Local "YYYY-MM-DDTHH:MM" (no time zone), used for deadlines and reminders.
export function localStamp(date = new Date()): string {
  return (
    dateKey(date) +
    "T" +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}
export function parseStamp(stamp: string): Date {
  const [day, time = "00:00"] = stamp.split("T");
  const d = parseDate(day);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function shiftDay(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function monday(date: string): string {
  return shiftDay(date, -((parseDate(date).getDay() + 6) % 7));
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parseDate(value).valueOf()) &&
    dateKey(parseDate(value)) === value
  );
}
export function occurs(task: Task, day: string): boolean {
  if (day < task.date || task.skipped.includes(day)) return false;
  if (task.repeat === "none") return day === task.date;
  const weekday = parseDate(day).getDay();
  return (
    task.repeat === "daily" ||
    (task.repeat === "weekdays" && weekday > 0 && weekday < 6) ||
    (task.repeat === "weekly" && weekday === parseDate(task.date).getDay())
  );
}
export function tasksFor(state: PlannerState, day: string): Task[] {
  return state.tasks
    .filter((t) => occurs(t, day))
    .sort((a, b) => a.time.localeCompare(b.time));
}
export function occurrenceKey(task: Task, day: string): string {
  return `${task.id}:${day}`;
}
export function progress(state: PlannerState, day: string) {
  const tasks = tasksFor(state, day);
  const done = tasks.filter((t) => state.done[occurrenceKey(t, day)]).length;
  return {
    total: tasks.length,
    done,
    perfect: tasks.length > 0 && done === tasks.length,
  };
}
export function streak(state: PlannerState, today: string): number {
  let day = progress(state, today).perfect ? today : shiftDay(today, -1);
  let count = 0;
  while (day >= state.started && progress(state, day).perfect && count < 3660) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}
export function taskXp(task: Task): number {
  return Math.min(60, Math.max(10, Math.round(task.duration / 3)));
}
export function dayXp(state: PlannerState, day: string): number {
  const tasks = tasksFor(state, day)
    .filter((t) => state.done[occurrenceKey(t, day)])
    .reduce((sum, t) => sum + taskXp(t), 0);
  const focus = state.focus
    .filter((f) => f.date === day)
    .reduce((sum, f) => sum + f.minutes, 0);
  const training = state.workoutLogs.filter((l) => l.date === day).length * 60;
  const todos = state.todos.filter((t) => t.doneAt?.slice(0, 10) === day).length * 15;
  return tasks + focus + training + todos;
}
export function totalXp(state: PlannerState, today: string): number {
  const days = new Set<string>([
    ...Object.keys(state.done)
      .filter((k) => state.done[k])
      .map((k) => k.slice(-10)),
    ...state.focus.map((f) => f.date),
    ...state.workoutLogs.map((l) => l.date),
    ...state.todos.flatMap((t) => (t.doneAt ? [t.doneAt.slice(0, 10)] : [])),
  ]);
  let xp = 0;
  for (const d of days) if (d <= today) xp += dayXp(state, d);
  return xp;
}
export function levelFor(xp: number) {
  // Each level needs 100 XP more than the previous one.
  let level = 1,
    need = 200,
    rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need += 100;
  }
  return { level, into: rest, need };
}
export function newId(prefix: string) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}
// Ends the running focus round and records the given minutes.
export function finishFocus(state: PlannerState, mins: number): PlannerState {
  const active = state.activeFocus;
  if (!active) return state;
  const start = new Date(active.startedAt);
  return {
    ...state,
    activeFocus: null,
    focus:
      mins < 1
        ? state.focus
        : [
            ...state.focus,
            {
              id: "focus-" + active.startedAt,
              date: dateKey(start),
              start:
                String(start.getHours()).padStart(2, "0") +
                ":" +
                String(start.getMinutes()).padStart(2, "0"),
              minutes: mins,
              examId: active.examId,
              label: active.label,
            },
          ],
  };
}
export function createState(today = dateKey()): PlannerState {
  const sample = (
    id: string,
    title: string,
    time: string,
    duration: number,
    category: Category,
    icon: string,
    repeat: Repeat,
    note: string,
  ): Task => ({
    id,
    title,
    time,
    duration,
    category,
    icon,
    repeat,
    note,
    date: today,
    skipped: [],
  });
  return {
    version: 1,
    started: today,
    name: "",
    gentle: true,
    apiUrl: "",
    accessToken: "",
    mealPlan: null,
    importedWeeks: [],
    ...extras(),
    done: {},
    groceries: {},
    tasks: [
      sample(
        "start-1",
        "In Ruhe in den Tag starten",
        "08:00",
        10,
        "life",
        "sun",
        "daily",
        "Ein Glas Wasser, kurz durchatmen und den Tag planen.",
      ),
      sample(
        "start-2",
        "Eine Fokusrunde für die Uni",
        "09:00",
        45,
        "uni",
        "graduation",
        "weekdays",
        "Dein wichtigstes Thema zuerst. Passe Zeit und Titel an deinen Stundenplan an.",
      ),
      sample(
        "start-3",
        "Zeit für Bewegung",
        "17:30",
        30,
        "sport",
        "dumbbell",
        "daily",
        "Spaziergang, Training oder Mobility – du entscheidest.",
      ),
      sample(
        "start-4",
        "Abendessen & Feierabend",
        "19:00",
        30,
        "food",
        "utensils",
        "daily",
        "Diese Beispielaufgabe kannst du später durch Gerichte aus deinem Essensplan ergänzen.",
      ),
    ],
  };
}
export function validMealPlan(value: unknown): value is MealPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as MealPlan;
  return (
    validDate(p.weekStart) &&
    typeof p.generatedAt === "string" &&
    Array.isArray(p.days) &&
    p.days.length === 7 &&
    p.days.every(
      (d, i) =>
        validDate(d.date) &&
        d.date === shiftDay(p.weekStart, i) &&
        ["breakfast", "lunch", "dinner"].every(
          (k) => typeof d[k as keyof Meal] === "string",
        ),
    ) &&
    Array.isArray(p.groceries) &&
    p.groceries.every(
      (g) =>
        typeof g.name === "string" &&
        typeof g.amount === "string" &&
        typeof g.category === "string",
    )
  );
}
const isArray = (v: unknown) => Array.isArray(v);
export function readState(raw: string): PlannerState {
  const value = JSON.parse(raw) as PlannerState;
  if (!value || typeof value !== "object")
    throw new Error("Das ist kein gültiges Hap-Backup.");
  value.importedWeeks ??= [];
  const defaults = extras();
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[])
    (value as Record<string, unknown>)[key] ??= defaults[key];
  value.profile = { ...defaultProfile, ...value.profile };
  if (typeof value.profile.kcalOffset !== "number" || !Number.isFinite(value.profile.kcalOffset)) delete value.profile.kcalOffset;
  value.notify = { ...defaultNotify, ...value.notify };
  value.transport = { ...defaultTransport, ...(value.transport as Partial<TransportSettings>) };
  if (
    typeof value.raplaUrl !== "string" ||
    ![
      value.todos,
      value.foodLog,
      value.calendars,
      value.calEvents,
      value.places,
      value.uniEvents,
      value.exams,
      value.focus,
      value.workouts,
      value.workoutLogs,
      value.bodyWeight,
    ].every(isArray) ||
    !value.exams.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        validDate(e.date) &&
        Number.isFinite(e.hours) &&
        isArray(e.topics),
    ) ||
    !value.focus.every(
      (f) => validDate(f.date) && Number.isFinite(f.minutes) && f.minutes > 0,
    ) ||
    !value.workouts.every(
      (w) =>
        typeof w.name === "string" && isArray(w.weekdays) && isArray(w.exercises),
    ) ||
    !value.workoutLogs.every((l) => validDate(l.date) && isArray(l.entries)) ||
    !value.todos.every((t) => typeof t.id === "string" && typeof t.title === "string" && !!t.remind) ||
    !value.foodLog.every((f) => validDate(f.date) && Number.isFinite(f.kcal)) ||
    typeof value.protein !== "object" ||
    isArray(value.protein)
  )
    throw new Error("Die Lern- oder Trainingsdaten sind ungültig.");
  if (
    !Array.isArray(value.importedWeeks) ||
    !value.importedWeeks.every(validDate)
  )
    throw new Error("Ungültige Planhistorie.");
  if (
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !validDate(value.started) ||
    typeof value.name !== "string" ||
    typeof value.gentle !== "boolean" ||
    typeof value.apiUrl !== "string" ||
    typeof value.accessToken !== "string"
  )
    throw new Error("Das ist kein gültiges Hap-Backup.");
  if (
    !value.done ||
    !value.groceries ||
    Array.isArray(value.done) ||
    Array.isArray(value.groceries) ||
    typeof value.done !== "object" ||
    typeof value.groceries !== "object" ||
    !Object.values(value.done).every((v) => typeof v === "boolean") ||
    !Object.values(value.groceries).every((v) => typeof v === "boolean")
  )
    throw new Error("Die gespeicherten Häkchen sind ungültig.");
  if (
    new Set(value.tasks.map((t) => t.id)).size !== value.tasks.length ||
    !value.tasks.every(
      (t) =>
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        t.title.trim() &&
        typeof t.note === "string" &&
        validDate(t.date) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) &&
        Number.isFinite(t.duration) &&
        t.duration > 0 &&
        t.duration <= 1440 &&
        t.category in categories &&
        t.repeat in repeats &&
        typeof t.icon === "string" &&
        Array.isArray(t.skipped) &&
        t.skipped.every(validDate),
    )
  )
    throw new Error("Die gespeicherten Aufgaben sind ungültig.");
  if (value.mealPlan !== null && !validMealPlan(value.mealPlan))
    throw new Error("Der gespeicherte Essensplan ist ungültig.");
  return value;
}
export function importMeals(state: PlannerState, plan: MealPlan): PlannerState {
  if (state.importedWeeks.includes(plan.weekStart))
    return state.mealPlan?.generatedAt === plan.generatedAt
      ? state
      : { ...state, mealPlan: plan };
  const additions: Task[] = plan.days.flatMap((d) =>
    (["breakfast", "lunch", "dinner"] as const).map((slot, i) => ({
      id: "meal-" + d.date + "-" + slot,
      title: d[slot],
      date: d.date,
      time: ["08:00", "12:30", "19:00"][i],
      duration: 30,
      category: "food",
      icon: i === 0 ? "coffee" : "utensils",
      repeat: "none",
      note: "Aus deinem Wochenessensplan.",
      skipped: [],
    })),
  );
  return {
    ...state,
    mealPlan: plan,
    importedWeeks: [...state.importedWeeks, plan.weekStart],
    tasks: [
      ...state.tasks,
      ...additions.filter(
        (t) => !state.tasks.some((existing) => existing.id === t.id),
      ),
    ],
  };
}

