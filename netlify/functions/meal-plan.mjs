import { getStore } from "@netlify/blobs";
import { authorized, berlinDay, json, weekOf } from "../lib/meals.mjs";

export default async function handler(request) {
  if (request.method !== "GET")
    return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  try {
    const store = getStore({ name: "hap-meals", consistency: "strong" });
    const current = await store.get("weeks/" + weekOf(berlinDay()), {
      type: "json",
    });
    const plan = current || (await store.get("latest", { type: "json" }));
    return plan ? json(plan) : json({ error: "No plan yet" }, 404);
  } catch {
    console.error("Meal plan storage read failed");
    return json({ error: "Storage unavailable" }, 503);
  }
}
