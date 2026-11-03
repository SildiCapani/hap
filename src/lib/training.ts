import {
  dateKey,
  newId,
  parseDate,
  shiftDay,
  monday,
  type Exercise,
  type PlannerState,
  type Profile,
  type Workout,
  type WorkoutLog,
} from "./planner.ts";

const ex = (name: string, sets: number, reps: number, weight: number): Exercise => ({
  id: newId("ex"),
  name,
  sets,
  reps,
  weight,
});

export const presets: { id: string; label: string; detail: string; build: () => Workout[] }[] = [
  {
    id: "ppl",
    label: "Push / Pull / Legs",
    detail: "3–6× pro Woche · Muskelaufbau",
    build: () => [
      { id: newId("wo"), name: "Push", weekdays: [1, 4], time: "18:00", duration: 75, exercises: [ex("Bankdrücken", 4, 8, 60), ex("Schulterdrücken", 3, 10, 30), ex("Schrägbank Kurzhantel", 3, 10, 22), ex("Seitheben", 3, 15, 8), ex("Trizeps am Kabel", 3, 12, 20)] },
      { id: newId("wo"), name: "Pull", weekdays: [2, 5], time: "18:00", duration: 75, exercises: [ex("Klimmzüge", 4, 8, 0), ex("Langhantelrudern", 4, 8, 50), ex("Latziehen", 3, 10, 50), ex("Face Pulls", 3, 15, 15), ex("Bizepscurls", 3, 12, 12)] },
      { id: newId("wo"), name: "Legs", weekdays: [3, 6], time: "17:00", duration: 75, exercises: [ex("Kniebeugen", 4, 6, 70), ex("Rumänisches Kreuzheben", 3, 8, 60), ex("Beinpresse", 3, 12, 120), ex("Beinbeuger", 3, 12, 35), ex("Wadenheben", 4, 15, 40)] },
    ],
  },
  {
    id: "upper-lower",
    label: "Oberkörper / Unterkörper",
    detail: "4× pro Woche · Kraft & Masse",
    build: () => [
      { id: newId("wo"), name: "Oberkörper", weekdays: [1, 4], time: "18:00", duration: 70, exercises: [ex("Bankdrücken", 4, 6, 60), ex("Langhantelrudern", 4, 8, 50), ex("Schulterdrücken", 3, 10, 30), ex("Latziehen", 3, 10, 50), ex("Dips", 3, 10, 0)] },
      { id: newId("wo"), name: "Unterkörper", weekdays: [2, 5], time: "18:00", duration: 70, exercises: [ex("Kniebeugen", 4, 6, 70), ex("Kreuzheben", 3, 5, 90), ex("Ausfallschritte", 3, 10, 16), ex("Beinbeuger", 3, 12, 35), ex("Planks (Sek.)", 3, 45, 0)] },
    ],
  },
  {
    id: "fullbody",
    label: "Ganzkörper",
    detail: "3× pro Woche · wenig Zeit",
    build: () => [
      { id: newId("wo"), name: "Ganzkörper A", weekdays: [1, 5], time: "18:00", duration: 60, exercises: [ex("Kniebeugen", 3, 8, 60), ex("Bankdrücken", 3, 8, 55), ex("Langhantelrudern", 3, 8, 45), ex("Planks (Sek.)", 3, 45, 0)] },
      { id: newId("wo"), name: "Ganzkörper B", weekdays: [3], time: "18:00", duration: 60, exercises: [ex("Kreuzheben", 3, 5, 80), ex("Schulterdrücken", 3, 8, 30), ex("Klimmzüge", 3, 8, 0), ex("Ausfallschritte", 3, 10, 14)] },
    ],
  },
];

export const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Exercises to pick from when changing a workout. Timed ones count seconds
// instead of repetitions ("(Sek.)" in the name).
export const library: { group: string; items: Omit<Exercise, "id">[] }[] = [
  { group: "Bauch", items: [
    { name: "Crunches", sets: 3, reps: 15, weight: 0 },
    { name: "Beinheben hängend", sets: 3, reps: 12, weight: 0 },
    { name: "Planks (Sek.)", sets: 3, reps: 45, weight: 0 },
    { name: "Kabel-Crunches", sets: 3, reps: 12, weight: 25 },
    { name: "Russian Twists", sets: 3, reps: 20, weight: 5 },
    { name: "Ab-Wheel", sets: 3, reps: 10, weight: 0 },
    { name: "Seitstütz (Sek.)", sets: 2, reps: 30, weight: 0 },
  ] },
  { group: "Beine", items: [
    { name: "Kniebeugen", sets: 4, reps: 6, weight: 70 },
    { name: "Beinpresse", sets: 3, reps: 12, weight: 120 },
    { name: "Rumänisches Kreuzheben", sets: 3, reps: 8, weight: 60 },
    { name: "Ausfallschritte", sets: 3, reps: 10, weight: 16 },
    { name: "Beinstrecker", sets: 3, reps: 12, weight: 40 },
    { name: "Beinbeuger", sets: 3, reps: 12, weight: 35 },
    { name: "Wadenheben", sets: 4, reps: 15, weight: 40 },
  ] },
  { group: "Brust", items: [
    { name: "Bankdrücken", sets: 4, reps: 8, weight: 60 },
    { name: "Schrägbank Kurzhantel", sets: 3, reps: 10, weight: 22 },
    { name: "Butterfly", sets: 3, reps: 12, weight: 40 },
    { name: "Dips", sets: 3, reps: 10, weight: 0 },
    { name: "Liegestütze", sets: 3, reps: 15, weight: 0 },
  ] },
  { group: "Rücken", items: [
    { name: "Klimmzüge", sets: 4, reps: 8, weight: 0 },
    { name: "Latziehen", sets: 3, reps: 10, weight: 50 },
    { name: "Langhantelrudern", sets: 4, reps: 8, weight: 50 },
    { name: "Kabelrudern", sets: 3, reps: 12, weight: 45 },
    { name: "Kreuzheben", sets: 3, reps: 5, weight: 90 },
  ] },
  { group: "Schultern", items: [
    { name: "Schulterdrücken", sets: 3, reps: 10, weight: 30 },
    { name: "Seitheben", sets: 3, reps: 15, weight: 8 },
    { name: "Face Pulls", sets: 3, reps: 15, weight: 15 },
    { name: "Reverse Butterfly", sets: 3, reps: 15, weight: 25 },
  ] },
  { group: "Arme", items: [
    { name: "Bizepscurls", sets: 3, reps: 12, weight: 12 },
    { name: "Hammercurls", sets: 3, reps: 12, weight: 12 },
    { name: "Trizeps am Kabel", sets: 3, reps: 12, weight: 20 },
    { name: "French Press", sets: 3, reps: 10, weight: 20 },
  ] },
];

// Three core exercises to add to any workout in one go.
export const coreBlock = ["Beinheben hängend", "Kabel-Crunches", "Planks (Sek.)"];

export function fromLibrary(name: string): Exercise {
  const item = library.flatMap((g) => g.items).find((i) => i.name === name);
  return { id: newId("ex"), ...(item || { name, sets: 3, reps: 10, weight: 0 }) };
}

export const timed = (name: string) => /\(sek\.?\)|sekunden/i.test(name);

// Rotation (e.g. Push ↔ Pull): the rotating workouts share their days and
// take turns, no matter the weekday. The turn follows what was actually
// trained: after the last logged one comes the next, and every planned
// rotation day from today on moves it one further. Skipped days in the past
// do not count, so a missed Push stays the next Push.
export const rotation = (state: PlannerState) => {
  const group = state.workouts.filter((w) => w.rotate);
  return group.length > 1 ? { group, days: new Set(group.flatMap((w) => w.weekdays)) } : null;
};

export function rotationPick(state: PlannerState, day: string, today = dateKey()): Workout | null {
  const rot = rotation(state);
  if (!rot || !rot.days.has(parseDate(day).getDay())) return null;
  const ids = rot.group.map((w) => w.id);
  const logs = state.workoutLogs.filter((l) => ids.includes(l.workoutId) && l.date <= day).sort((a, b) => a.date.localeCompare(b.date));
  const onDay = logs.find((l) => l.date === day);
  if (onDay) return rot.group.find((w) => w.id === onDay.workoutId)!;
  const last = logs[logs.length - 1];
  let index = last ? ids.indexOf(last.workoutId) + 1 : 0;
  for (let d = last && last.date >= today ? shiftDay(last.date, 1) : today; d < day; d = shiftDay(d, 1))
    if (rot.days.has(parseDate(d).getDay())) index++;
  return rot.group[index % ids.length];
}

export function workoutsFor(state: PlannerState, day: string): Workout[] {
  const weekday = parseDate(day).getDay();
  const moves = state.workoutMoves ?? [];
  const rotating = !!rotation(state);
  const pick = rotating ? rotationPick(state, day) : null;
  const regular = state.workouts.filter(
    (w) => (w.rotate && rotating ? pick?.id === w.id : w.weekdays.includes(weekday)) && !moves.some((m) => m.workoutId === w.id && m.from === day),
  );
  const moved = moves.flatMap((m) => {
    const w = m.to === day ? state.workouts.find((x) => x.id === m.workoutId) : undefined;
    return w && !regular.some((r) => r.id === w.id) ? [{ ...w, time: m.time }] : [];
  });
  return [...regular, ...moved].sort((a, b) => a.time.localeCompare(b.time));
}

// The move that put this workout on this day, if it was moved.
export function moveOf(state: PlannerState, workoutId: string, day: string) {
  return (state.workoutMoves ?? []).find((m) => m.workoutId === workoutId && m.to === day);
}

// Can the workout shown on `day` go to `to`? Not onto a day where it already takes place.
export function canMoveWorkout(state: PlannerState, workoutId: string, day: string, to: string) {
  return to === day || !workoutsFor(state, to).some((w) => w.id === workoutId);
}

// Move the workout shown on `day` to another date/time for this one time only.
// Moving it back to its original slot removes the exception again.
export function moveWorkout(state: PlannerState, workoutId: string, day: string, to: string, time: string): PlannerState {
  const workout = state.workouts.find((w) => w.id === workoutId);
  if (!workout || !canMoveWorkout(state, workoutId, day, to)) return state;
  const from = moveOf(state, workoutId, day)?.from ?? day;
  const rest = (state.workoutMoves ?? []).filter((m) => !(m.workoutId === workoutId && m.from === from));
  const back = to === from && time === workout.time;
  return { ...state, workoutMoves: back ? rest : [...rest, { id: workoutId + ":" + from, workoutId, from, to, time }] };
}

export function loggedOn(state: PlannerState, workoutId: string, day: string) {
  return state.workoutLogs.find((l) => l.workoutId === workoutId && l.date === day);
}

export function lastEntry(state: PlannerState, exerciseName: string, before?: string) {
  const logs = [...state.workoutLogs]
    .filter((l) => !before || l.date < before)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const log of logs) {
    const entry = log.entries.find((e) => e.name === exerciseName && e.sets.length);
    if (entry) return { date: log.date, sets: entry.sets };
  }
  return null;
}

// ---------- Progression ----------
// Based on ACSM (2009): raise the load by about 2–10 % once the target reps
// are beaten, and the NSCA "2-for-2" idea of confirming that over two
// sessions. Steps are a percentage of the current weight (lower body ~5 %,
// everything else ~2,5 %), rounded to what the equipment allows – so a step
// stays 2,5 kg where 2,5 kg is the smallest sensible jump.

const lowerCompound = /kniebeug|squat|kreuzheb|deadlift|beinpresse|hip ?thrust|ausfallschritt|bulgarian/i;
const dumbbell = /kurzhantel|curl|seitheb|hammer|french|fliegend|russian|ausfallschritt/i;

export function loadStep(name: string, weight: number) {
  const min = dumbbell.test(name) ? (weight < 10 ? 1 : 2) : 2.5;
  const ideal = weight * (lowerCompound.test(name) ? 0.05 : 0.025);
  return Math.max(min, Math.round(ideal / min) * min);
}

export function sessionsOf(state: PlannerState, exerciseName: string, before?: string) {
  return [...state.workoutLogs]
    .filter((l) => !before || l.date < before)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((l) => {
      const entry = l.entries.find((e) => e.name === exerciseName && e.sets.length);
      return entry ? [{ date: l.date, sets: entry.sets }] : [];
    });
}

const kg = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 864e5);

export function suggestion(state: PlannerState, exercise: Exercise, day: string) {
  const sessions = sessionsOf(state, exercise.name, day);
  const last = sessions[sessions.length - 1];
  if (!last) return { weight: exercise.weight, reps: exercise.reps, note: "Erstes Mal: sauber starten" };
  const top = Math.max(...last.sets.map((s) => s.weight));
  const hit = (sets: { reps: number }[]) => sets.length >= exercise.sets && sets.every((s) => s.reps >= exercise.reps);
  if (top === 0 && timed(exercise.name))
    return hit(last.sets)
      ? { weight: 0, reps: exercise.reps + 5, note: "Alle Sätze geschafft: +5 Sek." }
      : { weight: 0, reps: exercise.reps, note: "Gleiche Zeit wie letztes Mal" };
  if (top === 0)
    return hit(last.sets)
      ? { weight: 0, reps: exercise.reps + 1, note: "Alle Sätze geschafft: +1 Wdh." }
      : { weight: 0, reps: exercise.reps, note: "Gleiche Wdh. wie letztes Mal" };

  const step = loadStep(exercise.name, top);
  const gap = daysBetween(last.date, day);
  if (gap > 21) {
    const back = Math.max(step, Math.round((top * 0.9) / step) * step);
    return { weight: back, reps: exercise.reps, note: "Nach " + Math.round(gap / 7) + " Wochen Pause: " + kg(back) + " kg zum Einstieg" };
  }
  // Recent sessions at today's top weight, newest first.
  const atTop: { date: string; sets: { reps: number; weight: number }[] }[] = [];
  for (const x of [...sessions].reverse()) {
    if (Math.max(...x.sets.map((s) => s.weight)) !== top) break;
    atTop.push(x);
  }
  const working = last.sets.filter((s) => s.weight === top);
  const surplus = Math.min(...working.map((s) => s.reps)) - exercise.reps;
  const hits = atTop.findIndex((x) => !hit(x.sets));
  const streak = hits < 0 ? atTop.length : hits;

  if (hit(last.sets)) {
    const novice = sessions.length < 6;
    const big = step / top > 0.05;
    // Small jumps follow quickly; big ones (e.g. 12 → 14 kg curls) wait
    // until the reps clearly run ahead.
    const ready = big ? surplus >= 2 || (streak >= 2 && surplus >= 1) : surplus >= 2 || streak >= 2 || novice;
    if (gap > 10) return { weight: top, reps: exercise.reps, note: "Nach " + gap + " Tagen Pause: Gewicht halten" };
    if (ready)
      return { weight: Math.round((top + step) * 100) / 100, reps: exercise.reps, note: "+" + kg(step) + " kg · " + (surplus >= 2 ? "Wdh. klar über dem Ziel" : streak >= 2 ? streak + "× alle Wdh. geschafft" : "alle Wdh. geschafft") };
    if (big) return { weight: top, reps: exercise.reps + Math.max(1, surplus + 1), note: "Erst " + (exercise.reps + 2) + " Wdh. schaffen, dann +" + kg(step) + " kg" };
    return { weight: top, reps: exercise.reps, note: "Noch 1× alle Wdh., dann +" + kg(step) + " kg" };
  }
  const misses = atTop.findIndex((x) => hit(x.sets));
  if ((misses < 0 ? atTop.length : misses) >= 3) {
    const back = Math.max(step, Math.round((top * 0.9) / step) * step);
    return { weight: back, reps: exercise.reps, note: "3× nicht geschafft: " + kg(back) + " kg, dann neu aufbauen" };
  }
  return { weight: top, reps: exercise.reps, note: "Gewicht halten, Wdh. steigern" };
}

export function oneRepMax(weight: number, reps: number) {
  return reps <= 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function exerciseHistory(state: PlannerState, name: string) {
  return [...state.workoutLogs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((l) => {
      const e = l.entries.find((x) => x.name === name);
      if (!e || !e.sets.length) return [];
      return [{ date: l.date, best: Math.max(...e.sets.map((s) => oneRepMax(s.weight, s.reps))) }];
    });
}

export function volume(log: WorkoutLog) {
  return log.entries.reduce((sum, e) => sum + e.sets.reduce((s, x) => s + x.reps * x.weight, 0), 0);
}

export function weekSummary(state: PlannerState, today: string) {
  const start = monday(today);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const planned = days.reduce((n, d) => n + workoutsFor(state, d).length, 0);
  const done = state.workoutLogs.filter((l) => l.date >= start && l.date <= days[6]).length;
  return { planned, done };
}

export function trainingStreak(state: PlannerState, today: string) {
  // Weeks in a row (before the current one) where every planned workout was logged.
  let week = shiftDay(monday(today), -7);
  let count = 0;
  while (count < 520) {
    const s = weekSummary(state, week);
    if (!s.planned || s.done < s.planned) break;
    count++;
    week = shiftDay(week, -7);
  }
  const current = weekSummary(state, today);
  return count + (current.planned && current.done >= current.planned ? 1 : 0);
}

export const goals = {
  bulk: { label: "Muskelaufbau", kcal: 300 },
  maintain: { label: "Gewicht halten", kcal: 0 },
  cut: { label: "Definieren", kcal: -400 },
} as const;

// Mifflin-St Jeor with a moderate activity factor; training days get extra carbs.
export function nutrition(profile: Profile, trainingDay: boolean) {
  const bmr =
    10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.male ? 5 : -161);
  const base = bmr * 1.45 + goals[profile.goal].kcal + (profile.kcalOffset || 0);
  const kcal = Math.round((base + (trainingDay ? 250 : -100)) / 10) * 10;
  const protein = Math.round(profile.weight * (profile.goal === "cut" ? 2.2 : 2));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}

export function profileText(state: PlannerState) {
  const p = state.profile;
  const days = [...new Set(state.workouts.flatMap((w) => w.weekdays))].sort();
  const t = nutrition(p, true), r = nutrition(p, false);
  return (
    "Profil: " + p.age + " Jahre, " + (p.male ? "männlich" : "weiblich") + ", " + p.height + " cm, " + p.weight + " kg. " +
    "Ziel: " + goals[p.goal].label + ". " +
    (days.length ? "Trainingstage: " + days.map((d) => weekdayShort[d]).join(", ") + ". " : "") +
    "Tagesziele an Trainingstagen ca. " + t.kcal + " kcal und " + t.protein + " g Protein, an Ruhetagen ca. " + r.kcal + " kcal. " +
    "An Trainingstagen mehr Kohlenhydrate rund ums Training einplanen. Jede Mahlzeit proteinreich. " +
    (p.diet ? "Hinweise: " + p.diet + "." : "")
  );
}
