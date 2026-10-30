import { authorized, json } from "../lib/meals.mjs";
import { aiConfigured, structured, withinDailyLimit } from "../lib/ai.mjs";

// Turns the week's facts (computed in the app) into at most three short
// focus points. The app sends numbers only, no personal texts.
const AREAS = ["training", "essen", "geld", "lernen", "alltag"];

export const focusSchema = {
  type: "object",
  additionalProperties: false,
  required: ["good", "items"],
  properties: {
    good: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "title", "why", "action"],
        properties: {
          area: { type: "string", enum: AREAS },
          title: { type: "string" },
          why: { type: "string" },
          action: { type: "string" },
        },
      },
    },
  },
};

const clip = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

export function cleanFocus(result) {
  return {
    good: clip(result?.good, 120),
    items: (Array.isArray(result?.items) ? result.items : [])
      .map((i) => ({ area: AREAS.includes(i?.area) ? i.area : "alltag", title: clip(i?.title, 40), why: clip(i?.why, 120), action: clip(i?.action, 100) }))
      .filter((i) => i.title && i.action)
      .slice(0, 3),
  };
}

export const INSTRUCTIONS = [
  "Du bist der Wochen-Coach in Hap, der Planer-App eines 22-jährigen Informatik-Studenten (DHBW Stuttgart). Du bekommst Fakten zu seiner Woche, von der App berechnet.",
  "Wähle die 1–3 Dinge, die diese Woche am meisten bringen. Dringendes zuerst (nahe Prüfung, Budget fast leer), dann was den größten Unterschied macht. Lieber 2 starke Punkte als 3 schwache. Nichts, was schon gut läuft.",
  "Pro Punkt: title = 2–4 Wörter, wie eine Überschrift („Protein hoch“, „Freizeit bremsen“). why = ein kurzer Satz mit der konkreten Zahl aus den Fakten. action = eine konkrete Sache für diese Woche, die man abhaken kann, mit Zahl oder Tag („Mo, Mi, Fr Skyr zur Mensa“, „Bis Sonntag max. 25 € Freizeit“).",
  "good = ein kurzer, ehrlicher Satz zu etwas, das gut läuft, mit Zahl. Leer lassen, wenn nichts wirklich gut läuft.",
  "Ton: wie ein guter Freund. Du-Form, direkt, locker, kein Coaching-Sprech, keine Floskeln („Du schaffst das!“), keine Emojis, keine Ausrufezeichen-Ketten. Jeder Satz muss Inhalt haben.",
  "Nutze nur Zahlen aus den Fakten, erfinde nichts. Wurde ein Punkt vom letzten Fokus nicht geschafft, mach ihn kleiner statt ihn zu wiederholen.",
  "Geld: nur Ausgaben, Budgets und Sparen. Keine Empfehlungen zu einzelnen Aktien, ETFs oder Anlagen. Übrig gebliebenes Geld ist Spaßgeld, das ist okay.",
].join("\n");

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32) return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN)) return json({ error: "Unauthorized" }, 401);
  if (!aiConfigured()) return json({ error: "Not configured" }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const facts = typeof body?.facts === "string" ? body.facts.slice(0, 6000) : "";
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : "";
  if (!facts.trim() || !today) return json({ error: "Invalid input" }, 400);
  if (!(await withinDailyLimit("week-focus", 5))) return json({ error: "Daily limit reached" }, 429);
  try {
    const result = await structured({
      name: "week_focus",
      maxTokens: 1500,
      instructions: INSTRUCTIONS,
      content: [{ type: "input_text", text: "Heute ist " + today + ".\n\nFakten:\n" + facts }],
      schema: focusSchema,
    });
    return json(cleanFocus(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Week focus failed");
    return json({ error: "Failed" }, 502);
  }
}
