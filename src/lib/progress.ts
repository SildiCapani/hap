import { monday, parseDate, shiftDay, type PlannerState, type Profile } from "./planner.ts";
import { exerciseHistory, nutrition, volume, weekSummary, workoutsFor } from "./training.ts";

// Development over time for training and food: pure functions on the stored
// logs, so everything works offline and costs nothing.

export type Insight = { tone: "good" | "tip"; text: string };

const kg = (n: number, digits = 1) => String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");
const signed = (n: number, digits = 1) => (n > 0 ? "+" : n < 0 ? "−" : "±") + kg(Math.abs(n), digits);

function days(today: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftDay(today, i - count + 1));
}

// ---------- Training ----------

export function trainingWeeks(state: PlannerState, today: string, count: number) {
  const current = monday(today);
  return Array.from({ length: count }, (_, i) => {
    const start = shiftDay(current, (i - count + 1) * 7);
    const end = shiftDay(start, 6);
    const logs = state.workoutLogs.filter((l) => l.date >= start && l.date <= end);
    return {
      start,
      ...weekSummary(state, start),
      volume: Math.round(logs.reduce((n, l) => n + volume(l), 0)),
      minutes: logs.reduce((n, l) => n + l.minutes, 0),
    };
  });
}

export type ExerciseTrend = {
  name: string;
  points: { date: string; best: number }[]; // in range
  sessions: number;
  change: number; // estimated 1RM, first → last in range
  best: number; // all-time best estimated 1RM
  bestDate: string;
  stalled: boolean;
};

export function exerciseTrends(state: PlannerState, today: string, range: number): ExerciseTrend[] {
  const from = shiftDay(today, -range + 1);
  const names = [...new Set(state.workoutLogs.flatMap((l) => l.entries.filter((e) => e.sets.length).map((e) => e.name)))];
  return names
    .map((name) => {
      const all = exerciseHistory(state, name).filter((h) => h.date <= today);
      const points = all.filter((h) => h.date >= from);
      const top = all.reduce((b, h) => (h.best > b.best ? h : b), all[0] || { date: "", best: 0 });
      // Stalled: the last three sessions did not beat what came before them.
      const before = all.slice(0, -3);
      const recent = all.slice(-3);
      const stalled = before.length > 0 && recent.length === 3 && Math.max(...recent.map((h) => h.best)) <= Math.max(...before.map((h) => h.best)) && top.best > 0;
      return {
        name,
        points,
        sessions: points.length,
        change: points.length > 1 ? Math.round((points[points.length - 1].best - points[0].best) * 10) / 10 : 0,
        best: top.best,
        bestDate: top.date,
        stalled,
      };
    })
    .filter((t) => t.points.length > 0)
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

// Least-squares slope of the body weight in kg per week.
export function weightTrend(state: PlannerState, today: string, range: number) {
  const from = shiftDay(today, -range + 1);
  const points = state.bodyWeight.filter((b) => b.date >= from && b.date <= today);
  const first = points[0], last = points[points.length - 1];
  const span = first && last ? Math.round((parseDate(last.date).getTime() - parseDate(first.date).getTime()) / 864e5) : 0;
  if (points.length < 2 || span < 7) return { points, perWeek: null, span };
  const xs = points.map((p) => (parseDate(p.date).getTime() - parseDate(first.date).getTime()) / 864e5);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = points.reduce((a, p) => a + p.kg, 0) / points.length;
  const slope = xs.reduce((n, x, i) => n + (x - mx) * (points[i].kg - my), 0) / xs.reduce((n, x) => n + (x - mx) ** 2, 0);
  return { points, perWeek: Math.round(slope * 7 * 100) / 100, span };
}

// Sensible weekly change per goal (kg per week).
export const weightGoal: Record<Profile["goal"], [number, number]> = {
  bulk: [0.1, 0.4],
  maintain: [-0.2, 0.2],
  cut: [-0.75, -0.25],
};

export function trainingInsights(state: PlannerState, today: string): Insight[] {
  const out: Insight[] = [];
  const weeks = trainingWeeks(state, today, 5).slice(0, 4); // four finished weeks
  const planned = weeks.reduce((n, w) => n + w.planned, 0);
  const done = weeks.reduce((n, w) => n + Math.min(w.done, w.planned || w.done), 0);
  if (planned >= 4) {
    const rate = done / planned;
    if (rate >= 0.9) out.push({ tone: "good", text: "Die letzten 4 Wochen " + done + " von " + planned + " Trainings geschafft – genau diese Regelmäßigkeit bringt Fortschritt." });
    else if (rate < 0.6) {
      const perWeek = Math.max(1, Math.round(done / 4));
      out.push({ tone: "tip", text: "Nur " + done + " von " + planned + " geplanten Trainings in 4 Wochen. Ein Plan mit " + perWeek + "–" + (perWeek + 1) + " festen Tagen, den du wirklich schaffst, bringt mehr als einer, der ausfällt." });
    }
  }
  const trends = exerciseTrends(state, today, 365);
  const records = trends.filter((t) => !t.stalled && t.bestDate >= shiftDay(today, -29) && exerciseHistory(state, t.name).length > 1).map((t) => t.name);
  if (records.length) out.push({ tone: "good", text: "Neue Bestwerte in den letzten 30 Tagen: " + records.slice(0, 4).join(", ") + (records.length > 4 ? " und " + (records.length - 4) + " weitere" : "") + "." });
  for (const t of trends.filter((x) => x.stalled).slice(0, 2))
    out.push({ tone: "tip", text: t.name + " stagniert seit 3 Trainings. Probier eine leichtere Woche (−10 % Gewicht) oder wechsel das Wiederholungsschema, z. B. 3×10 statt 4×6." });
  const recent = trainingWeeks(state, today, 8);
  const now = recent.slice(4).reduce((n, w) => n + w.volume, 0), prev = recent.slice(0, 4).reduce((n, w) => n + w.volume, 0);
  if (prev > 0 && now > 0) {
    const pct = Math.round((now / prev - 1) * 100);
    if (pct >= 10) out.push({ tone: "good", text: "Dein Trainingsvolumen ist " + pct + " % höher als in den 4 Wochen davor." });
    else if (pct <= -20) out.push({ tone: "tip", text: "Dein Trainingsvolumen ist " + Math.abs(pct) + " % niedriger als in den 4 Wochen davor. Gewollt (Deload)? Sonst plan die Trainings fest in den Kalender." });
  }
  out.push(...weightInsights(state, today));
  return out;
}

function weightInsights(state: PlannerState, today: string): Insight[] {
  const { goal } = state.profile;
  const trend = weightTrend(state, today, 42);
  const latest = state.bodyWeight[state.bodyWeight.length - 1];
  if (!latest || latest.date < shiftDay(today, -13))
    return [{ tone: "tip", text: "Trag 1–2× pro Woche morgens dein Gewicht ein. Dann sieht Hap, ob dein Essen zu deinem Ziel passt." }];
  if (trend.perWeek === null) return [];
  const [low, high] = weightGoal[goal];
  const rate = signed(trend.perWeek, 2) + " kg/Woche";
  if (trend.perWeek < low)
    return [{ tone: "tip", text: goal === "cut" ? "Du nimmst " + rate + " ab – das ist sehr schnell und kostet Muskeln. Iss etwa 200 kcal mehr." : "Dein Gewicht geht " + rate + " – für „" + (goal === "bulk" ? "Muskelaufbau" : "Gewicht halten") + "“ zu wenig. Iss etwa " + (goal === "bulk" ? 250 : 150) + " kcal mehr pro Tag." }];
  if (trend.perWeek > high)
    return [{ tone: "tip", text: goal === "cut" ? "Du nimmst nur " + rate + " ab. Etwa 200 kcal weniger oder mehr Schritte bringen dich ins Ziel." : "Du nimmst " + rate + " zu – schneller als nötig, das ist eher Fett. Etwa 150–200 kcal weniger reichen." }];
  return [{ tone: "good", text: "Dein Gewicht entwickelt sich mit " + rate + " genau passend zu deinem Ziel." }];
}

// ---------- Food ----------

export type FoodDay = { date: string; kcal: number; protein: number; carbs: number; fat: number; logged: boolean; target: { kcal: number; protein: number }; training: boolean };

export function foodDays(state: PlannerState, today: string, range: number): FoodDay[] {
  return days(today, range).map((date) => {
    const entries = state.foodLog.filter((f) => f.date === date);
    const sum = (k: "kcal" | "protein" | "carbs" | "fat") => entries.reduce((n, f) => n + f[k], 0);
    const training = workoutsFor(state, date).length > 0 || state.workoutLogs.some((l) => l.date === date);
    const target = nutrition(state.profile, training);
    return {
      date,
      kcal: sum("kcal"),
      protein: sum("protein") + (state.protein[date] || 0),
      carbs: sum("carbs"),
      fat: sum("fat"),
      // Days without any meal entry are unknown, not zero calories.
      logged: entries.some((f) => f.kcal > 0),
      target: { kcal: target.kcal, protein: target.protein },
      training,
    };
  });
}

export function foodSummary(list: FoodDay[]) {
  const logged = list.filter((d) => d.logged);
  const avg = (f: (d: FoodDay) => number) => (logged.length ? Math.round(logged.reduce((n, d) => n + f(d), 0) / logged.length) : 0);
  return {
    days: list.length,
    logged: logged.length,
    kcal: avg((d) => d.kcal),
    target: avg((d) => d.target.kcal),
    protein: avg((d) => d.protein),
    proteinTarget: avg((d) => d.target.protein),
    proteinHit: logged.filter((d) => d.protein >= d.target.protein * 0.9).length,
    onTarget: logged.filter((d) => Math.abs(d.kcal - d.target.kcal) <= d.target.kcal * 0.1).length,
  };
}

// Real energy need from what was eaten and how the weight moved
// (about 7700 kcal per kg body weight). Needs a few weeks of data.
export function measuredNeed(state: PlannerState, today: string) {
  const list = foodDays(state, today, 28);
  const logged = list.filter((d) => d.logged);
  const trend = weightTrend(state, today, 28);
  if (logged.length < 14 || trend.perWeek === null || trend.span < 14 || trend.points.length < 3) return null;
  const eaten = logged.reduce((n, d) => n + d.kcal, 0) / logged.length;
  const need = Math.round((eaten - (trend.perWeek * 7700) / 7) / 10) * 10;
  // What the formula assumes for the same days without goal surplus/deficit.
  const p = { ...state.profile, goal: "maintain" as const, kcalOffset: 0 };
  const formula = Math.round(list.reduce((n, d) => n + nutrition(p, d.training).kcal, 0) / list.length / 10) * 10;
  return { need, eaten: Math.round(eaten), perWeek: trend.perWeek, formula, offset: Math.max(-600, Math.min(600, need - formula)), logged: logged.length };
}

export function foodInsights(state: PlannerState, today: string): Insight[] {
  const out: Insight[] = [];
  const list = foodDays(state, today, 14).slice(0, -1); // today is not over yet
  const sum = foodSummary(list);
  if (sum.logged < 3) return [{ tone: "tip", text: "Trag ein paar Tage dein Essen ein – ab 3 Tagen zeigt Hap hier, was du verbessern kannst." }];
  if (sum.logged < list.length * 0.6)
    out.push({ tone: "tip", text: "Nur an " + sum.logged + " von " + list.length + " Tagen eingetragen. Je vollständiger, desto genauer werden Auswertung und Bedarf." });
  if (sum.proteinHit >= sum.logged * 0.8) out.push({ tone: "good", text: "Protein an " + sum.proteinHit + " von " + sum.logged + " Tagen erreicht – stark für den Muskelaufbau." });
  else {
    const gap = sum.proteinTarget - sum.protein;
    if (gap > 10) out.push({ tone: "tip", text: "Protein nur an " + sum.proteinHit + " von " + sum.logged + " Tagen erreicht, im Schnitt fehlen " + gap + " g. Einfach: 250 g Skyr (≈ 28 g) oder ein Shake (≈ 25 g) dazu." });
  }
  // With enough data the measured need beats the formula as reference.
  const need = measuredNeed(state, today);
  const target = sum.target + (need ? need.offset - (state.profile.kcalOffset || 0) : 0);
  const diff = sum.kcal - target;
  if (Math.abs(diff) > target * 0.1)
    out.push({ tone: "tip", text: "Im Schnitt " + sum.kcal + " kcal statt " + target + " kcal (" + (diff > 0 ? "+" : "−") + Math.abs(diff) + "). " + (diff > 0 ? "Kleinere Portionen oder weniger Snacks am Abend." : "Eine Zwischenmahlzeit mehr, z. B. Haferflocken mit Milch.") });
  else out.push({ tone: "good", text: "Deine Kalorien liegen im Schnitt nah an deinem " + (need ? "gemessenen " : "") + "Ziel (" + sum.kcal + " von " + target + " kcal)." });
  const logged = list.filter((d) => d.logged);
  const weekend = logged.filter((d) => [0, 6].includes(parseDate(d.date).getDay()));
  const week = logged.filter((d) => ![0, 6].includes(parseDate(d.date).getDay()));
  if (weekend.length >= 2 && week.length >= 3) {
    const a = weekend.reduce((n, d) => n + d.kcal, 0) / weekend.length, b = week.reduce((n, d) => n + d.kcal, 0) / week.length;
    if (a - b > 400) out.push({ tone: "tip", text: "Am Wochenende isst du im Schnitt " + Math.round(a - b) + " kcal mehr als unter der Woche." });
  }
  if (need && Math.abs(need.offset - (state.profile.kcalOffset || 0)) >= 100)
    out.push({ tone: "tip", text: "Aus Essen und Gewicht gemessen liegt dein Bedarf bei etwa " + need.need + " kcal, die Formel schätzt " + need.formula + " kcal. Du kannst deine Ziele unten daran anpassen." });
  return out;
}
