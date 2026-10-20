import { authorized, json, planSchema } from "../lib/meals.mjs";
import { aiConfigured, structured, withinDailyLimit } from "../lib/ai.mjs";

// Recalculates the shopping list after the user changed dishes of the week.
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
  const dishes = Array.isArray(body?.dishes) ? body.dishes.filter((d) => typeof d === "string" && d.trim()).map((d) => d.slice(0, 120)) : [];
  if (!dishes.length || dishes.length > 30) return json({ error: "Invalid dishes" }, 400);
  if (!(await withinDailyLimit("groceries", 15))) return json({ error: "Daily limit reached" }, 429);
  try {
    const result = await structured({
      name: "grocery_list",
      instructions:
        "Erstelle eine zusammengefasste Einkaufsliste auf Deutsch für genau diese Gerichte einer Woche. Doppelte Zutaten zusammenführen, realistische Mengen, sinnvolle Kategorien (z. B. Gemüse, Kühlregal, Vorrat). Berücksichtige die Vorgaben zu Personen und Budget.",
      content: [{ type: "input_text", text: (process.env.MEAL_PLAN_PROMPT || "") + "\n\nGerichte:\n- " + dishes.join("\n- ") }],
      schema: { type: "object", additionalProperties: false, required: ["groceries"], properties: { groceries: planSchema.properties.groceries } },
    });
    const items = (result.groceries || [])
      .filter((g) => g && ["name", "amount", "category"].every((k) => typeof g[k] === "string" && g[k].trim()))
      .slice(0, 80);
    return json({ groceries: items });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Grocery list failed");
    return json({ error: "Failed" }, 502);
  }
}
