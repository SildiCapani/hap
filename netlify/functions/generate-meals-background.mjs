import { getStore } from "@netlify/blobs";
import { authorized, generatePlan, json, targetWeek } from "../lib/meals.mjs";

// A background function gives the model time to finish; no API key reaches the browser.
export default async function handler(request) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (!authorized(request, process.env.HAP_JOB_SECRET))
    return json({ error: "Unauthorized" }, 401);
  const week = targetWeek();
  const store = getStore({ name: "hap-meals", consistency: "strong" });
  const key = "weeks/" + week;
  if (await store.get(key, { type: "json" }))
    return json({ status: "already-generated" });
  const lockKey = "locks/" + week;
  // Separate time buckets allow recovery after a crashed run without a permanent lock.
  const bucket = Math.floor(Date.now() / (30 * 60 * 1000));
  const lock = await store.setJSON(
    lockKey + "/" + bucket,
    { startedAt: new Date().toISOString() },
    { onlyIfNew: true },
  );
  if (!lock.modified) return json({ status: "already-running" });
  try {
    const plan = await generatePlan(week);
    const result = await store.setJSON(key, plan, { onlyIfNew: true });
    if (result.modified) await store.setJSON("latest", plan);
    console.info("Meal plan stored for " + week);
    return json({ status: "generated", weekStart: week });
  } catch (error) {
    await store.delete(lockKey + "/" + bucket);
    console.error(
      error instanceof Error ? error.message : "Meal generation failed",
    );
    throw error;
  }
}
