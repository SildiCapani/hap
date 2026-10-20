import { getStore } from "@netlify/blobs";
import { berlinDay } from "./meals.mjs";

// Shared helper for small structured OpenAI calls (store: false).
export async function structured({ instructions, content, name, schema, model, maxTokens = 3000 }, env = process.env, fetcher = fetch) {
  const chosen = model || env.OPENAI_MODEL;
  if (!env.OPENAI_API_KEY || !chosen) throw new Error("Missing configuration");
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      model: chosen,
      store: false,
      max_output_tokens: maxTokens,
      instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name, strict: true, schema } },
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
  return JSON.parse(output);
}

// Per-feature daily cap so AI costs stay predictable.
export async function withinDailyLimit(feature, limit) {
  const store = getStore({ name: "hap-food", consistency: "strong" });
  const key = "count/" + feature + "/" + berlinDay();
  const count = (await store.get(key, { type: "json" }))?.count || 0;
  if (count >= limit) return false;
  await store.setJSON(key, { count: count + 1 });
  return true;
}

export const aiConfigured = (env = process.env) => !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL;
