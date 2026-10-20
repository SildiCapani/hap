import test from "node:test";
import assert from "node:assert/strict";
import { cleanReminders, dueReminders, markSent, subscriptionKey, validSubscription } from "../netlify/lib/push.mjs";

const now = Date.UTC(2026, 9, 20, 12, 0);
const r = (id, minutes) => ({ id, at: now + minutes * 60000, title: "T " + id, body: "B", url: "/" });

test("subscriptions and reminders are validated", () => {
  assert.equal(validSubscription({ endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } }), true);
  assert.equal(validSubscription({ endpoint: "http://push.example/abc", keys: { p256dh: "x", auth: "y" } }), false);
  assert.equal(validSubscription({ endpoint: "https://push.example/abc" }), false);
  assert.equal(cleanReminders([{ ...r("a", 5), url: "https://evil" }], now), null);
  assert.equal(cleanReminders("nope", now), null);
  const cleaned = cleanReminders([r("old", -120), r("a", 5), { ...r("b", 10), extra: 1 }], now);
  assert.deepEqual(cleaned.map((x) => x.id), ["a", "b"]);
  assert.equal("extra" in cleaned[1], false);
  assert.equal(subscriptionKey("https://a"), subscriptionKey("https://a"));
  assert.notEqual(subscriptionKey("https://a"), subscriptionKey("https://b"));
});

test("due reminders are sent once, late ones within 20 minutes", () => {
  const record = { reminders: [r("late", -10), r("lost", -30), r("now", 0), r("soon", 0.5), r("later", 5)], sent: [] };
  const due = dueReminders(record, now);
  assert.deepEqual(due.map((x) => x.id), ["late", "now", "soon"]);
  const after = markSent(record, due.map((x) => x.id), now);
  assert.deepEqual(dueReminders(after, now), []);
  // A new sync from the phone keeps the sent list, so nothing is repeated.
  assert.deepEqual(dueReminders({ ...after, reminders: [r("now", 0), r("later", 5)] }, now + 5 * 60000).map((x) => x.id), ["later"]);
});

test("app endpoints reject requests without the app token", async () => {
  const { default: backup } = await import("../netlify/functions/backup.mjs");
  const { default: generate } = await import("../netlify/functions/meal-generate.mjs");
  const { default: push } = await import("../netlify/functions/push.mjs");
  process.env.HAP_ACCESS_TOKEN = "t".repeat(40);
  Object.assign(process.env, { VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k", VAPID_SUBJECT: "mailto:a@b.c" });
  const wrong = { Authorization: "Bearer " + "x".repeat(40) };
  assert.equal((await backup(new Request("https://e.test", { headers: wrong }))).status, 401);
  assert.equal((await backup(new Request("https://e.test", { method: "PUT", headers: wrong, body: "{}" }))).status, 401);
  assert.equal((await generate(new Request("https://e.test", { method: "POST", headers: wrong }))).status, 401);
  assert.equal((await push(new Request("https://e.test", { method: "POST", headers: wrong, body: "{}" }))).status, 401);
  assert.equal((await generate(new Request("https://e.test"))).status, 405);
  assert.equal((await push(new Request("https://e.test"))).status, 200, "public key stays readable");
});
