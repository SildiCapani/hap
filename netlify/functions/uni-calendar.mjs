import { json } from "../lib/meals.mjs";
import { parseRapla, raplaWeeksUrl, validRaplaUrl } from "../../src/lib/rapla.ts";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "de-DE,de;q=0.9",
};

// Follows at most three redirects, and only within rapla.dhbw.de.
async function fetchRapla(url) {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const response = await fetch(current, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return response;
    const next = new URL(location, current);
    if (next.protocol !== "https:" || next.hostname !== "rapla.dhbw.de")
      throw Object.assign(new Error("redirect"), { upstream: "redirect" });
    current = next.toString();
  }
  throw Object.assign(new Error("redirect"), { upstream: "redirect" });
}

// Browsers cannot read Rapla directly (no CORS headers), so the web app asks
// this function. Only DHBW Rapla calendar links are fetched. Errors name the
// cause (upstream status, timeout) but never echo the page, which holds the key.
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
    const response = await fetchRapla(raplaWeeksUrl(url, from, Number(weeks) || 20));
    if (!response.ok) {
      console.error("Rapla answered " + response.status);
      return json({ error: "Calendar unavailable", upstream: response.status }, 502);
    }
    const html = await response.text();
    if (!html.includes("week_table")) {
      // Rapla answers 200 with a short text when a link is not published.
      const title = /<title>([^<]{0,80})<\/title>/i.exec(html)?.[1]?.trim() || html.replace(/<[^>]+>/g, " ").trim().slice(0, 120);
      console.error("Rapla returned no calendar");
      return json({ error: "No calendar", upstream: 200, detail: title }, 422);
    }
    return json({ events: parseRapla(html, from) });
  } catch (error) {
    const upstream = error?.upstream || (error?.name === "TimeoutError" ? "timeout" : "network");
    console.error("Rapla fetch failed (" + upstream + ")");
    return json({ error: "Calendar unavailable", upstream }, 502);
  }
}
