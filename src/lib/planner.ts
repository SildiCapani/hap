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
};
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
export function readState(raw: string): PlannerState {
  const value = JSON.parse(raw) as PlannerState;
  value.importedWeeks ??= [];
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

