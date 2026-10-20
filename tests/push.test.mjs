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

test("food estimates are cleaned and summed, inputs are checked", async () => {
  const { validateFood, validImage, analyzeFood } = await import("../netlify/lib/food.mjs");
  const food = validateFood({
    name: " Nudeln ",
    confidence: "mittel",
    hint: "",
    items: [
      { name: "Pasta", amount: "200 g", kcal: 300.4, protein: 11, carbs: 60, fat: 2 },
      { name: "Soße", amount: "100 g", kcal: -5, protein: 3, carbs: 8, fat: 9999 },
      { name: "", amount: "", kcal: 100, protein: 0, carbs: 0, fat: 0 },
    ],
  });
  assert.equal(food.name, "Nudeln");
  assert.equal(food.items.length, 2);
  assert.equal(food.kcal, 300);
  assert.equal(food.fat, 402);
  assert.equal(validImage("data:image/jpeg;base64,AAAA"), true);
  assert.equal(validImage("https://evil.example/x.jpg"), false);
  let sent;
  const result = await analyzeFood(
    { image: "", note: "Mensa Schnitzel mit Pommes" },
    { OPENAI_API_KEY: "k", OPENAI_MODEL: "m" },
    async (url, options) => {
      sent = JSON.parse(options.body);
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ name: "Schnitzel", confidence: "mittel", hint: "", items: [{ name: "Schnitzel", amount: "1", kcal: 500, protein: 30, carbs: 25, fat: 28 }] }) }] }] });
    },
  );
  assert.equal(result.kcal, 500);
  assert.equal(sent.store, false);
  assert.equal(sent.input[0].content.length, 1, "text only without photo");
});
