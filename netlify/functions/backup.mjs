import { getStore } from "@netlify/blobs";
import { authorized, json } from "../lib/meals.mjs";

// Cloud copy of the app data in Netlify Blobs: GET returns the latest copy,
// PUT replaces it. The app token is never part of the stored data.
export default async function handler(request) {
  if (request.method !== "GET" && request.method !== "PUT")
    return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  try {
    const store = getStore({ name: "hap-backup", consistency: "strong" });
    if (request.method === "GET") {
      const backup = await store.get("latest", { type: "json" });
      return backup ? json(backup) : json({ error: "No backup yet" }, 404);
    }
    const raw = await request.text();
    if (raw.length > 4 * 1024 * 1024) return json({ error: "Too large" }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid body" }, 400);
    }
    if (!body?.state || typeof body.state !== "object" || Array.isArray(body.state))
      return json({ error: "Invalid backup" }, 400);
    const savedAt = new Date().toISOString();
    await store.setJSON("latest", { state: { ...body.state, accessToken: "" }, savedAt });
    return json({ status: "saved", savedAt });
  } catch {
    console.error("Backup storage failed");
    return json({ error: "Storage unavailable" }, 503);
  }
}
