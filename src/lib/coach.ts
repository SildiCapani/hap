import { shiftDay, type FocusArea, type PlannerState, type WeekFocus } from "./planner.ts";
import { foodDays, foodInsights, foodSummary, trainingInsights, trainingWeeks } from "./progress.ts";
import { euro, periodSummary, savingsCheck } from "./money.ts";
import { upcomingExams } from "./study.ts";
import { planningWeek, preview } from "./weekplan.ts";

// Weekly focus: Hap computes the facts, the AI only picks and phrases the
// three things that matter most. Only numbers and plan names leave the
// device – no shop names, notes or to-do texts.

export const areas: Record<FocusArea, { label: string; color: string }> = {
  training: { label: "Training", color: "#F07B83" },
  essen: { label: "Essen", color: "#E5B073" },
  geld: { label: "Geld", color: "#98C5A9" },
  lernen: { label: "Lernen", color: "#92B9DB" },
  alltag: { label: "Alltag", color: "#B9A2F2" },
};

const pct = (a: number, b: number) => Math.round((a / b) * 100) + " %";
const dayName = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short" });

export function weekFacts(state: PlannerState, today: string) {
  const week = planningWeek(today);
  const lines: string[] = [];
  const add = (area: string, text: string) => lines.push(area + ": " + text);

  // Woche
  const next = preview(state, week);
  add("Woche", "ab " + week + (week > today ? " (kommende Woche)" : "") + ". " + next.lectures + " Vorlesungen, " + next.deadlines.length + " Fristen/Prüfungen.");

  // Training
  if (state.workouts.length) {
    add("Training", "geplant: " + (next.workouts.map((w) => dayName(w.date) + " " + w.name).join(", ") || "nichts"));
    const [last] = trainingWeeks(state, shiftDay(week, -1), 1);
    if (last.planned) add("Training", "letzte Woche " + last.done + " von " + last.planned + " Trainings gemacht.");
    for (const i of trainingInsights(state, today)) add("Training", i.text);
  }

  // Essen (last 7 finished days)
  const food = foodSummary(foodDays(state, today, 8).slice(0, -1));
  if (food.logged) {
    add("Essen", "letzte 7 Tage an " + food.logged + " Tagen eingetragen. Schnitt " + food.kcal + " von " + food.target + " kcal, Protein " + food.protein + " von " + food.proteinTarget + " g (an " + food.proteinHit + " Tagen erreicht).");
    for (const i of foodInsights(state, today)) add("Essen", i.text);
  } else if (state.foodLog.length) add("Essen", "letzte 7 Tage nichts eingetragen.");

  // Geld
  if (state.payday) {
    const p = periodSummary(state, today);
    const total = Math.round((new Date(p.end).getTime() - new Date(p.start).getTime()) / 864e5) + 1;
    add("Geld", "Gehaltsmonat Tag " + (total - p.daysLeft + 1) + " von " + total + ". Noch frei " + euro(p.free, false) + " (≈ " + euro(p.perDay, false) + "/Tag). Ausgegeben " + euro(p.spent, false) + ". Was übrig bleibt, ist Spaßgeld.");
    for (const c of p.byCategory.filter((c) => c.budget > 0))
      add("Geld", c.label + " " + euro(c.spent, false) + " von " + euro(c.budget, false) + " Budget (" + pct(c.spent, c.budget) + ").");
    for (const c of p.byCategory.filter((c) => !c.budget).sort((a, b) => b.spent - a.spent).slice(0, 3))
      add("Geld", c.label + " " + euro(c.spent, false) + " ohne Budget.");
    const check = savingsCheck(state, today);
    if (check.income) add("Geld", "spart " + Math.round(check.rate * 100) + " % (" + euro(check.saving, false) + "/Monat). Notgroschen " + euro(check.cash, false) + " von ≈ " + euro(check.cushion, false) + ".");
    if (!state.moneyEntries.some((e) => e.date >= shiftDay(today, -7))) add("Geld", "seit 7 Tagen keine Ausgabe eingetragen.");
  }

  // Lernen
  const exams = upcomingExams(state, today).filter((e) => e.days <= 45);
  for (const e of exams.slice(0, 4))
    add("Lernen", e.exam.title + " in " + e.days + " Tagen, noch " + Math.round(e.left / 60) + " h offen (≈ " + e.perDay + " min/Tag, " + { relaxed: "entspannt", steady: "machbar", tight: "knapp", critical: "kritisch", past: "vorbei" }[e.pressure] + ").");
  const studied = state.focus.filter((f) => f.date > shiftDay(today, -7) && f.date <= today).reduce((n, f) => n + f.minutes, 0);
  if (state.exams.length) add("Lernen", "letzte 7 Tage " + Math.round(studied / 60 * 10) / 10 + " h gelernt.");

  // To-dos: counts only, the texts stay private.
  const open = state.todos.filter((t) => !t.doneAt);
  const overdue = open.filter((t) => t.due && t.due.slice(0, 10) < today).length;
  if (open.length) add("To-dos", open.length + " offen, davon " + overdue + " überfällig.");

  // What was planned last time and whether it got done.
  const prev = state.weekFocus.filter((f) => f.id < week).sort((a, b) => b.id.localeCompare(a.id))[0];
  if (prev) add("Letzter Fokus", prev.items.map((i) => "„" + i.title + "“ " + (i.done ? "geschafft" : "nicht abgehakt")).join(", ") + ".");

  return { week, facts: lines.join("\n").slice(0, 6000), enough: lines.length >= 4 };
}

export const focusFor = (state: PlannerState, week: string) => state.weekFocus.find((f) => f.id === week) || null;

export async function fetchFocus(state: PlannerState, today: string): Promise<WeekFocus | string> {
  if (!state.accessToken) return "Für den Wochenfokus braucht Hap deinen App-Zugang (Einstellungen).";
  const { week, facts } = weekFacts(state, today);
  const response = await fetch(state.apiUrl.replace(/\/$/, "") + "/.netlify/functions/week-focus", {
    method: "POST",
    headers: { Authorization: "Bearer " + state.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ facts, today }),
    signal: AbortSignal.timeout(70000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung – der Fokus kommt beim nächsten Öffnen.";
  if (response.status === 401) return "Der App-Zugang stimmt nicht mit HAP_ACCESS_TOKEN auf Netlify überein.";
  if (response.status === 429) return "Für heute genug neu erstellt. Morgen wieder.";
  if (response.status === 503 || response.status === 404) return "Der Wochenfokus ist auf Netlify noch nicht verfügbar (neu deployen).";
  if (!response.ok) return "Der Fokus konnte gerade nicht erstellt werden.";
  const data = (await response.json().catch(() => null)) as Pick<WeekFocus, "good" | "items"> | null;
  if (!data || !Array.isArray(data.items)) return "Der Fokus konnte gerade nicht erstellt werden.";
  return { id: week, created: new Date().toISOString(), good: data.good || "", items: data.items.map((i) => ({ ...i, done: false })) };
}

// Keeps the last eight weeks.
export function saveFocus(list: WeekFocus[], focus: WeekFocus) {
  return [...list.filter((f) => f.id !== focus.id), focus].sort((a, b) => a.id.localeCompare(b.id)).slice(-8);
}
