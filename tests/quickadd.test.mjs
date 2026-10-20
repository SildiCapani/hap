import test from "node:test";
import assert from "node:assert/strict";
import { parseQuick } from "../src/lib/quickadd.ts";

const today = "2026-10-20"; // Dienstag
const now = new Date(2026, 9, 20, 13, 15);

test("relative days, time and duration are extracted", () => {
  const d = parseQuick("morgen 10 uhr DB lernen 2h", today, now);
  assert.deepEqual(
    { ...d },
    { title: "DB lernen", date: "2026-10-21", time: "10:00", duration: 120, category: "uni", icon: "graduation", repeat: "none" },
  );
  const g = parseQuick("Gym push 18:30 90min", today, now);
  assert.equal(g.category, "sport");
  assert.equal(g.time, "18:30");
  assert.equal(g.duration, 90);
  assert.equal(g.date, today);
});
test("weekdays, dates and repeats", () => {
  assert.equal(parseQuick("freitag abgabe verteilte systeme", today, now).date, "2026-10-23");
  assert.equal(parseQuick("am di wäsche", today, now).date, "2026-10-27");
  assert.equal(parseQuick("so viel wie möglich lesen", today, now).date, today);
  assert.equal(parseQuick("24.12. Weihnachten", today, now).date, "2026-12-24");
  assert.equal(parseQuick("1.2. Klausur KI um 9", today, now).date, "2027-02-01");
  const r = parseQuick("jeden montag laufen 7 uhr", today, now);
  assert.equal(r.repeat, "weekly");
  assert.equal(r.date, "2026-10-26");
  assert.equal(r.title, "Laufen");
  assert.equal(parseQuick("täglich 1,5h lernen", today, now).duration, 90);
});
test("defaults without time use the next hour and empty input is rejected", () => {
  assert.equal(parseQuick("einkaufen", today, now).time, "14:00");
  assert.equal(parseQuick("einkaufen", today, now).category, "food");
  assert.equal(parseQuick("   ", today, now), null);
  assert.equal(parseQuick("morgen", today, now), null);
});
