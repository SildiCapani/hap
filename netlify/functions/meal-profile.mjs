import { getStore } from "@netlify/blobs";
import { authorized, json } from "../lib/meals.mjs";

// Stores the nutrition profile text so the weekly generation can use it.
export default async function handler(request) {
  if (request.method !== "PUT")
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
  if (typeof body?.profile !== "string" || body.profile.length > 2000)
    return json({ error: "Invalid profile" }, 400);
  try {
    const store = getStore({ name: "hap-meals", consistency: "strong" });
    await store.setJSON("profile", {
      text: body.profile,
      updatedAt: new Date().toISOString(),
    });
    return json({ status: "saved" });
  } catch {
    console.error("Profile storage write failed");
    return json({ error: "Storage unavailable" }, 503);
  }
}
