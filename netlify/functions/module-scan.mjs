import { authorized, json } from "../lib/meals.mjs";
import { aiConfigured, structured, withinDailyLimit } from "../lib/ai.mjs";
import { validImage } from "../lib/food.mjs";

// Reads modules (name, ECTS, exam type, date, topics) from a screenshot,
// a PDF (e.g. Modulhandbuch) or pasted text and suggests study hours.
export const moduleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["modules"],
  properties: {
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "ects", "exam", "date", "hours", "topics"],
        properties: {
          name: { type: "string" },
          ects: { type: "number" },
          exam: { type: "string", enum: ["Klausur", "Abgabe", "Präsentation", "Mündlich", "Sonstiges"] },
          date: { type: "string" },
          hours: { type: "number" },
          topics: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

export function cleanModules(result) {
  return (result?.modules || [])
    .filter((m) => m && typeof m.name === "string" && m.name.trim())
    .slice(0, 30)
    .map((m) => ({
      name: m.name.trim().slice(0, 80),
      ects: Math.max(0, Math.min(30, Number(m.ects) || 0)),
      exam: ["Klausur", "Abgabe", "Präsentation", "Mündlich", "Sonstiges"].includes(m.exam) ? m.exam : "Sonstiges",
      date: /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : "",
      hours: Math.max(1, Math.min(200, Math.round(Number(m.hours) || 10))),
      topics: (Array.isArray(m.topics) ? m.topics : []).filter((t) => typeof t === "string" && t.trim()).slice(0, 10).map((t) => t.trim().slice(0, 60)),
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
  const text = typeof body?.text === "string" ? body.text.slice(0, 20000) : "";
  const image = typeof body?.image === "string" ? body.image : "";
  const pdf = typeof body?.pdf === "string" ? body.pdf : "";
  if ((image && !validImage(image)) || (pdf && !/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(pdf)) || pdf.length > 4.5 * 1024 * 1024 || (!text && !image && !pdf))
    return json({ error: "Invalid input" }, 400);
  if (!(await withinDailyLimit("modules", 10))) return json({ error: "Daily limit reached" }, 429);
  const content = [{ type: "input_text", text: "Heute ist " + new Date().toISOString().slice(0, 10) + ". " + (text ? "Text:\n" + text : "Lies die Module aus dem Dokument.") }];
  if (image) content.push({ type: "input_image", image_url: image, detail: "high" });
  if (pdf) content.push({ type: "input_file", filename: "module.pdf", file_data: pdf });
  try {
    const result = await structured({
      name: "study_modules",
      maxTokens: 6000,
      instructions:
        "Du hilfst einem Informatik-Studenten (DHBW) bei der Lernplanung. Extrahiere alle Module bzw. Kurse des aktuellen Semesters aus dem Material (Moodle-Kursliste, Modulhandbuch, Studienverlaufsplan). Pro Modul: Name (kurz, ohne Kursnummern), ECTS (0 wenn unbekannt), Prüfungsform, Prüfungsdatum als JJJJ-MM-TT nur wenn angegeben (sonst leer), empfohlene Stunden NUR für die Prüfungsvorbereitung (Richtwert ca. 5 h pro ECTS, mehr bei mathematischen/schweren Fächern, weniger bei Seminaren) und bis zu 8 Hauptthemen. Erfinde keine Module.",
      content,
      schema: moduleSchema,
    });
    return json({ modules: cleanModules(result) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Module scan failed");
    return json({ error: "Failed" }, 502);
  }
}
