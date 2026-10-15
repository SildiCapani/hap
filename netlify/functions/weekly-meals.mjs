import { json } from "../lib/meals.mjs";

export default async function handler() {
  const env = process.env;
  if (
    !env.HAP_JOB_SECRET ||
    env.HAP_JOB_SECRET.length < 32 ||
    !env.OPENAI_API_KEY ||
    !env.OPENAI_MODEL ||
    !env.MEAL_PLAN_PROMPT
  ) {
    console.error("Meal planning is missing required environment variables");
    return json({ error: "Not configured" }, 503);
  }
  const origin = env.URL;
  if (!origin?.startsWith("https://"))
    throw new Error("Missing Netlify site URL");
  const response = await fetch(
    origin + "/.netlify/functions/generate-meals-background",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + env.HAP_JOB_SECRET },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Could not start meal generation (" + response.status + ")",
    );
  return json({ status: "queued" });
}
// Checks daily so a failed Sunday run is retried. A stored week never generates again.
// On Sunday, generate the following week; on other days, fill a missing current week.
export const config = { schedule: "0 6 * * *" };
