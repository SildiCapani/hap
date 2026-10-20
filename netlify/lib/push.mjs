import { createHash } from "node:crypto";

// Web push for the home screen app: the device sends its upcoming reminders,
// a scheduled function delivers them when they are due.
export const DISPATCH_EVERY_MIN = 2;

export function subscriptionKey(endpoint) {
  return "subs/" + createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

export function validSubscription(sub) {
  return (
    !!sub &&
    typeof sub.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    sub.endpoint.length < 1000 &&
    typeof sub.keys?.p256dh === "string" &&
    typeof sub.keys?.auth === "string"
  );
}

const text = (v, max) => typeof v === "string" && v.length <= max;

export function cleanReminders(list, now = Date.now()) {
  if (!Array.isArray(list)) return null;
  const valid = list.every(
    (r) =>
      r &&
      text(r.id, 200) &&
      Number.isFinite(r.at) &&
      text(r.title, 200) &&
      text(r.body, 500) &&
      (r.url === undefined || (text(r.url, 100) && r.url.startsWith("/"))),
  );
  if (!valid) return null;
  return list
    .filter((r) => r.at > now - 60 * 60 * 1000 && r.at < now + 8 * 24 * 3600 * 1000)
    .slice(0, 80)
    .map(({ id, at, title, body, url }) => ({ id, at, title, body, url: url || "/" }));
}

// Reminders that should go out in this run. Late ones are still sent for a
// while (a phone may have been offline), very old ones are dropped.
export function dueReminders(record, now = Date.now()) {
  const sent = new Set(record.sent || []);
  const windowEnd = now + (DISPATCH_EVERY_MIN * 60 * 1000) / 2;
  return record.reminders.filter(
    (r) => !sent.has(r.id) && r.at <= windowEnd && r.at > now - 20 * 60 * 1000,
  );
}

export function markSent(record, ids, now = Date.now()) {
  // Remember sent ids for two days so a later sync cannot resend them.
  const keep = new Set(record.reminders.filter((r) => r.at > now - 2 * 24 * 3600 * 1000).map((r) => r.id));
  return {
    ...record,
    sent: [...new Set([...(record.sent || []).filter((id) => keep.has(id)), ...ids])].slice(-300),
  };
}
