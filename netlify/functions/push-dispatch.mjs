import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { dueReminders, markSent } from "../lib/push.mjs";

// Runs every two minutes and sends all reminders that are due.
export default async function handler() {
  const env = process.env;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const store = getStore({ name: "hap-push", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "subs/" });
  for (const { key } of blobs) {
    const record = await store.get(key, { type: "json" });
    if (!record) continue;
    const due = dueReminders(record);
    if (!due.length) continue;
    const sent = [];
    let gone = false;
    for (const r of due) {
      try {
        await webpush.sendNotification(
          record.subscription,
          JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.id }),
          { TTL: 3600, urgency: "high" },
        );
        sent.push(r.id);
      } catch (error) {
        // 404/410: the browser dropped this subscription for good.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          gone = true;
          break;
        }
        console.error("Push failed (" + (error?.statusCode || "network") + ")");
      }
    }
    if (gone) await store.delete(key);
    else if (sent.length) {
      // Re-read so a sync from the phone during this run is not overwritten.
      const latest = (await store.get(key, { type: "json" })) || record;
      await store.setJSON(key, markSent(latest, sent));
    }
  }
}

export const config = { schedule: "*/2 * * * *" };
