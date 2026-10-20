import { getStore } from "@netlify/blobs";
import { authorized, json } from "../lib/meals.mjs";

// Synced copy of the app data in Netlify Blobs. GET returns it with its
// revision; PUT replaces it only if the device saw the latest revision
// (otherwise 409 with the current copy, so the device merges first).
// The app token is never part of the stored data.
export default async function handler(request) {
  if (request.method !== "GET" && request.method !== "PUT")
    return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  try {
    const store = getStore({ name: "hap-backup", consistency: "strong" });
    const current = await store.get("latest", { type: "json" });
    if (current && !current.rev) current.rev = current.savedAt;
    if (request.method === "GET")
      return current ? json(current) : json({ error: "No backup yet" }, 404);
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
    if (current && !body.force && body.baseRev !== current.rev)
      return json({ error: "Conflict", ...current }, 409);
    const savedAt = new Date().toISOString();
    const rev = savedAt + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON("latest", { state: { ...body.state, accessToken: "" }, savedAt, rev });
    return json({ status: "saved", savedAt, rev });
  } catch {
    console.error("Backup storage failed");
    return json({ error: "Storage unavailable" }, 503);
  }
}
