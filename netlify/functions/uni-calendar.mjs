import { json } from "../lib/meals.mjs";
import { parseRapla, raplaWeeksUrl, validRaplaUrl } from "../../src/lib/rapla.ts";

// Browsers cannot read Rapla directly (no CORS headers), so the web app asks
// this function. Only DHBW Rapla calendar links are fetched.
export default async function handler(request) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const { url, from, weeks } = body || {};
  if (
    typeof url !== "string" ||
    !validRaplaUrl(url) ||
    typeof from !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from)
  )
    return json({ error: "Invalid calendar link" }, 400);
  try {
    const response = await fetch(raplaWeeksUrl(url, from, Number(weeks) || 20), {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return json({ error: "Calendar unavailable" }, 502);
    const events = parseRapla(await response.text(), from);
    return json({ events });
  } catch {
    console.error("Rapla fetch failed");
    return json({ error: "Calendar unavailable" }, 502);
  }
}
