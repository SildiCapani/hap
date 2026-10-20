import { timingSafeEqual } from "node:crypto";

export function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function berlinDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function shift(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekOf(day) {
  return shift(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
}
export function targetWeek(now = new Date()) {
  const day = berlinDay(now);
  return weekOf(
    new Date(day + "T12:00:00Z").getUTCDay() === 0 ? shift(day, 1) : day,
  );
}
export const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["days", "groceries"],
  properties: {
    days: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "breakfast", "lunch", "dinner"],
        properties: {
          date: { type: "string" },
          breakfast: { type: "string" },
          lunch: { type: "string" },
          dinner: { type: "string" },
        },
      },
    },
    groceries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "category"],
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          category: { type: "string" },
        },
      },
    },
  },
};
export function validatePlan(value, weekStart) {
  if (
    !value ||
    !Array.isArray(value.days) ||
    value.days.length !== 7 ||
    !value.days.every(
      (d, i) =>
        d.date === shift(weekStart, i) &&
        ["breakfast", "lunch", "dinner"].every(
          (key) => typeof d[key] === "string" && d[key].trim(),
        ),
    )
  )
    throw new Error("Invalid seven-day meal plan");
  if (
    !Array.isArray(value.groceries) ||
    !value.groceries.length ||
    !value.groceries.every((g) =>
      ["name", "amount", "category"].every(
        (key) => typeof g[key] === "string" && g[key].trim(),
      ),
    )
  )
    throw new Error("Invalid groceries");
  return value;
}
export async function generatePlan(
  weekStart,
  env = process.env,
  fetcher = fetch,
  profile = "",
) {
  for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL", "MEAL_PLAN_PROMPT"])
    if (!env[key]?.trim()) throw new Error("Missing configuration: " + key);
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      store: false,
      max_output_tokens: 10000,
      instructions:
        "Erstelle einen Wochenessensplan auf Deutsch. Befolge die Vorgaben des Nutzers zu Personen, Budget, Vorlieben und Unverträglichkeiten. Erzeuge genau sieben Tage von " +
        weekStart +
        " bis " +
        shift(weekStart, 6) +
        ". Je ein konkretes Gericht mit Portionsangabe pro Frühstück, Mittagessen und Abendessen. Ergänze eine zusammengefasste Einkaufsliste mit passenden Mengen für alle Mahlzeiten; doppelte Zutaten zusammenführen. Keine erfundenen persönlichen Vorlieben oder medizinischen Angaben.",
      input: profile
        ? env.MEAL_PLAN_PROMPT + "\n\n" + profile
        : env.MEAL_PLAN_PROMPT,
      text: {
        format: {
          type: "json_schema",
          name: "weekly_meal_plan",
          strict: true,
          schema: planSchema,
        },
      },
    }),
  });
  if (!response.ok)
    throw new Error("OpenAI request failed (" + response.status + ")");
  const data = await response.json();
  if (data.status !== "completed")
    throw new Error("OpenAI response incomplete");
  const output = (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
  const plan = validatePlan(JSON.parse(output), weekStart);
  return { weekStart, generatedAt: new Date().toISOString(), ...plan };
}
export function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
