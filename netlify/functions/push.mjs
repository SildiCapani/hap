import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { authorized, json } from "../lib/meals.mjs";
import { cleanReminders, subscriptionKey, validSubscription } from "../lib/push.mjs";

// GET: public VAPID key. PUT: save subscription + upcoming reminders.
// POST: send a test notification now. DELETE: remove a subscription.
// Everything except GET needs the personal app token.
export default async function handler(request) {
  const env = process.env;
  const configured =
    !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY && !!env.VAPID_SUBJECT;
  if (request.method === "GET")
    return configured
      ? json({ publicKey: env.VAPID_PUBLIC_KEY })
      : json({ error: "Not configured" }, 503);
  if (!["PUT", "POST", "DELETE"].includes(request.method))
    return json({ error: "Method not allowed" }, 405);
  if (!configured || !env.HAP_ACCESS_TOKEN || env.HAP_ACCESS_TOKEN.length < 32)
    return json({ error: "Not configured" }, 503);
  if (!authorized(request, env.HAP_ACCESS_TOKEN))
    return json({ error: "Unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const sub = body?.subscription;
  if (!validSubscription(sub))
    return json({ error: "Invalid subscription" }, 400);
  try {
    const store = getStore({ name: "hap-push", consistency: "strong" });
    const key = subscriptionKey(sub.endpoint);
    if (request.method === "POST") {
      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          JSON.stringify({ title: "Test von Hap ✅", body: "Push funktioniert. So sehen deine Erinnerungen aus.", url: "/settings", tag: "test" }),
          { TTL: 600, urgency: "high" },
        );
        return json({ status: "sent" });
      } catch (error) {
        console.error("Test push failed (" + (error?.statusCode || "network") + ")");
        return json({ error: "Push failed", upstream: error?.statusCode || "network" }, 502);
      }
    }
    if (request.method === "DELETE") {
      await store.delete(key);
      return json({ status: "removed" });
    }
    const reminders = cleanReminders(body.reminders);
    if (!reminders) return json({ error: "Invalid reminders" }, 400);
    const previous = await store.get(key, { type: "json" });
    await store.setJSON(key, {
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      reminders,
      sent: previous?.sent || [],
      updatedAt: new Date().toISOString(),
    });
    return json({ status: "saved", count: reminders.length });
  } catch {
    console.error("Push storage failed");
    return json({ error: "Storage unavailable" }, 503);
  }
}
