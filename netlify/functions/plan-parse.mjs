import { authorized, json } from "../lib/meals.mjs";
import { aiConfigured, structured, withinDailyLimit } from "../lib/ai.mjs";

// Turns free text like "nach der Vorlesung 2 h DB lernen, danach Gym" into
// tasks, using the user's schedule of the next days as context.
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "date", "time", "duration", "category", "repeat"],
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          duration: { type: "number" },
          category: { type: "string", enum: ["uni", "sport", "food", "life"] },
          repeat: { type: "string", enum: ["none", "daily", "weekdays", "weekly"] },
        },
      },
    },
  },
};

export function cleanTasks(result) {
  return (result?.tasks || [])
    .filter((t) => t && typeof t.title === "string" && t.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))
    .slice(0, 12)
    .map((t) => ({
      title: t.title.trim().slice(0, 120),
      date: t.date,
      time: t.time,
      duration: Math.max(5, Math.min(600, Math.round(Number(t.duration) || 30))),
      category: ["uni", "sport", "food", "life"].includes(t.category) ? t.category : "life",
      repeat: ["none", "daily", "weekdays", "weekly"].includes(t.repeat) ? t.repeat : "none",
    }));
}

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
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
  const now = typeof body?.now === "string" ? body.now.slice(0, 40) : "";
  const context = typeof body?.context === "string" ? body.context.slice(0, 6000) : "";
  if (!text || !now) return json({ error: "Invalid input" }, 400);
  if (!(await withinDailyLimit("parse", 60))) return json({ error: "Daily limit reached" }, 429);
  try {
    const result = await structured({
      name: "planned_tasks",
      maxTokens: 2000,
      instructions:
        "Du planst Aufgaben für einen Studenten. Lies seinen Satz und gib die gemeinten Aufgaben zurück: Datum JJJJ-MM-TT, Startzeit HH:MM, Dauer in Minuten, Kategorie (uni = Lernen/Uni, sport, food = Essen/Einkaufen, life = sonst). Beziehe dich auf seinen Kalender: „nach der Vorlesung“ heißt direkt nach dem Ende des passenden Termins, „danach“ heißt nach der vorherigen Aufgabe. Ohne Zeitangabe: nächste sinnvolle freie Zeit. Plane nichts in die Vergangenheit und überschneide keine Termine. Titel kurz auf Deutsch.",
      content: [{ type: "input_text", text: "Jetzt: " + now + "\nKalender der nächsten Tage:\n" + (context || "(leer)") + "\n\nSatz: " + text }],
      schema,
    });
    return json({ tasks: cleanTasks(result) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Parse failed");
    return json({ error: "Failed" }, 502);
  }
}
