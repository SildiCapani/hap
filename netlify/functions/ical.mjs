import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { authorized, json } from "../lib/meals.mjs";

// Fetches a subscribed calendar (.ics) for the web app; browsers cannot read
// most calendar feeds directly (no CORS). Needs the app token and refuses
// private network addresses, so it cannot be used to reach internal hosts.
function privateAddress(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => privateAddress(a.address))) return null;
  return url;
}

export default async function handler(request) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  try {
    let url = typeof body?.url === "string" ? await safeUrl(body.url.replace(/^webcals?:\/\//i, "https://")) : null;
    if (!url) return json({ error: "Invalid calendar link" }, 400);
    for (let i = 0; i < 4; i++) {
      const response = await fetch(url, {
        redirect: "manual",
        headers: { Accept: "text/calendar, */*", "User-Agent": "Hap Calendar/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        url = await safeUrl(new URL(location, url).toString());
        if (!url) return json({ error: "Invalid redirect" }, 400);
        continue;
      }
      if (!response.ok) return json({ error: "Calendar unavailable", upstream: response.status }, 502);
      const text = await response.text();
      if (text.length > 5 * 1024 * 1024) return json({ error: "Calendar too large" }, 413);
      if (!text.includes("BEGIN:VCALENDAR")) return json({ error: "Not a calendar" }, 422);
      return new Response(text, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, no-store" } });
    }
    return json({ error: "Too many redirects" }, 502);
  } catch (error) {
    const upstream = error?.name === "TimeoutError" ? "timeout" : "network";
    console.error("Calendar fetch failed (" + upstream + ")");
    return json({ error: "Calendar unavailable", upstream }, 502);
  }
}
