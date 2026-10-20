import { generationConfigured, json, queueGeneration } from "../lib/meals.mjs";

export default async function handler() {
  if (!generationConfigured()) {
    console.error("Meal planning is missing required environment variables");
    return json({ error: "Not configured" }, 503);
  }
  await queueGeneration();
  return json({ status: "queued" });
}
// Checks daily so a failed Sunday run is retried. A stored week never generates again.
// On Sunday, generate the following week; on other days, fill a missing current week.
export const config = { schedule: "0 6 * * *" };
