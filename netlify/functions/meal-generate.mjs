import { getStore } from "@netlify/blobs";
import {
  authorized,
  generationConfigured,
  json,
  queueGeneration,
  targetWeek,
} from "../lib/meals.mjs";

// "Plan jetzt erstellen" in the app. Uses the app token, never the job secret,
// and only starts a run when the target week has no plan yet.
export default async function handler(request) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  if (!generationConfigured())
    return json({ error: "Generation not configured" }, 503);
  const week = targetWeek();
  try {
    const store = getStore({ name: "hap-meals", consistency: "strong" });
    if (await store.get("weeks/" + week, { type: "json" }))
      return json({ status: "already-generated", weekStart: week });
    await queueGeneration();
    return json({ status: "queued", weekStart: week });
  } catch {
    console.error("Could not start meal generation");
    return json({ error: "Unavailable" }, 503);
  }
}
