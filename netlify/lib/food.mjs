// Photo (or text) to nutrition estimate via the OpenAI Responses API.
export const DAILY_LIMIT = 40;

const macro = { type: "number" };
export const foodSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "confidence", "hint", "items"],
  properties: {
    name: { type: "string" },
    confidence: { type: "string", enum: ["hoch", "mittel", "niedrig"] },
    hint: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "kcal", "protein", "carbs", "fat"],
        properties: { name: { type: "string" }, amount: { type: "string" }, kcal: macro, protein: macro, carbs: macro, fat: macro },
      },
    },
  },
};

const round = (n) => Math.max(0, Math.round(Number(n) || 0));

export function validateFood(value) {
  if (!value || typeof value.name !== "string" || !Array.isArray(value.items) || value.items.length > 20)
    throw new Error("Invalid food estimate");
  const items = value.items
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim().slice(0, 80),
      amount: String(i.amount || "").slice(0, 40),
      kcal: Math.min(5000, round(i.kcal)),
      protein: Math.min(500, round(i.protein)),
      carbs: Math.min(800, round(i.carbs)),
      fat: Math.min(400, round(i.fat)),
    }));
  const sum = (k) => items.reduce((n, i) => n + i[k], 0);
  return {
    name: value.name.trim().slice(0, 80) || "Mahlzeit",
    confidence: ["hoch", "mittel", "niedrig"].includes(value.confidence) ? value.confidence : "niedrig",
    hint: typeof value.hint === "string" ? value.hint.slice(0, 200) : "",
    items,
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
  };
}

export function validImage(image) {
  return (
    typeof image === "string" &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) &&
    image.length < 3 * 1024 * 1024
  );
}

export async function analyzeFood({ image, note }, env = process.env, fetcher = fetch) {
  const model = env.FOOD_MODEL || env.OPENAI_MODEL;
  if (!env.OPENAI_API_KEY || !model) throw new Error("Missing configuration");
  const content = [
    {
      type: "input_text",
      text:
        (image ? "Schätze die Nährwerte der Mahlzeit auf dem Foto." : "Schätze die Nährwerte dieser Mahlzeit.") +
        (note ? " Angaben des Nutzers: " + note.slice(0, 300) : ""),
    },
  ];
  if (image) content.push({ type: "input_image", image_url: image, detail: "high" });
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 2500,
      instructions:
        "Du bist Ernährungsberater. Erkenne jede Komponente der Mahlzeit, schätze realistische Portionsgrößen (sichtbare Tellergröße, Besteck als Maßstab) und gib pro Komponente kcal, Protein, Kohlenhydrate und Fett in Gramm an. Alles auf Deutsch. name: kurzer Name des Gerichts. hint: ein kurzer Satz, was die Schätzung unsicher macht (z. B. Öl, Soße), sonst leer. Wenn kein Essen zu sehen ist: items leer und hint erklärt das.",
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "food_estimate", strict: true, schema: foodSchema } },
    }),
  });
  if (!response.ok) throw new Error("OpenAI request failed (" + response.status + ")");
  const data = await response.json();
  if (data.status !== "completed") throw new Error("OpenAI response incomplete");
  const output = (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
  return validateFood(JSON.parse(output));
}
