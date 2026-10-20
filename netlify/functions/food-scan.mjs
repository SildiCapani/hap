import { getStore } from "@netlify/blobs";
import { authorized, berlinDay, json } from "../lib/meals.mjs";
import { analyzeFood, DAILY_LIMIT, validImage } from "../lib/food.mjs";

// Estimates calories from a food photo or a short description. Needs the
// app token; a daily limit keeps the OpenAI costs predictable.
export default async function handler(request) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  if (!process.env.OPENAI_API_KEY || !(process.env.FOOD_MODEL || process.env.OPENAI_MODEL))
    return json({ error: "Not configured" }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const image = body?.image || "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if ((image && !validImage(image)) || (!image && !note))
    return json({ error: "Invalid input" }, 400);
  const store = getStore({ name: "hap-food", consistency: "strong" });
  const key = "count/" + berlinDay();
  const count = (await store.get(key, { type: "json" }))?.count || 0;
  if (count >= DAILY_LIMIT) return json({ error: "Daily limit reached", limit: DAILY_LIMIT }, 429);
  await store.setJSON(key, { count: count + 1 });
  try {
    return json(await analyzeFood({ image, note }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Food analysis failed");
    return json({ error: "Analysis failed" }, 502);
  }
}
