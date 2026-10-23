import test from "node:test";
import assert from "node:assert/strict";
import { icsToItems, meetingLink } from "../src/lib/icsImport.ts";

process.env.TZ = "Europe/Berlin";
const wrap = (events) => "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:REQUEST\r\n" + events.join("\r\n") + "\r\nEND:VCALENDAR\r\n";
const teams = [
  "BEGIN:VEVENT",
  "UID:040000008200E00074C5B7101A82E0080000000",
  "SUMMARY:Projektmeeting Werkstudent",
  "DTSTART;TZID=W. Europe Standard Time:20261027T100000",
  "DTEND;TZID=W. Europe Standard Time:20261027T110000",
  "LOCATION:Microsoft Teams-Besprechung",
  "DESCRIPTION:________________________________________________________________________________\\nMicrosoft Teams Benötigen Sie Hilfe?\\nJetzt an der Besprechung teilnehmen <https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=x>\\nBesprechungs-ID: 123 456\\n________________________________________________________________________________",
  "END:VEVENT",
].join("\r\n");

test("a Teams invitation becomes a task with time, duration and join link", () => {
  const [item] = icsToItems(wrap([teams]), "2026-10-23");
  assert.equal(item.title, "Projektmeeting Werkstudent");
  assert.equal(item.date, "2026-10-27");
  assert.equal(item.time, "10:00");
  assert.equal(item.duration, 60);
  assert.equal(item.repeat, "none");
  assert.match(item.link, /^https:\/\/teams\.microsoft\.com\/l\/meetup-join\//);
  assert.equal(item.task.icon, "laptop");
  assert.ok(!item.task.note.includes("_____"));
  assert.equal(icsToItems(wrap([teams]), "2026-10-23")[0].id, item.id, "same invitation, same id");
});

test("open weekly series become a repeating task, series with an end are expanded", () => {
  const weekly = ["BEGIN:VEVENT", "UID:w1", "SUMMARY:Jour fixe", "DTSTART;TZID=Europe/Berlin:20261020T090000", "DTEND;TZID=Europe/Berlin:20261020T093000", "RRULE:FREQ=WEEKLY;BYDAY=TU", "EXDATE;TZID=Europe/Berlin:20261103T090000", "END:VEVENT"].join("\r\n");
  const limited = ["BEGIN:VEVENT", "UID:c1", "SUMMARY:Tutorium", "DTSTART;TZID=Europe/Berlin:20261026T140000", "DTEND;TZID=Europe/Berlin:20261026T150000", "RRULE:FREQ=WEEKLY;COUNT=3", "END:VEVENT"].join("\r\n");
  const past = ["BEGIN:VEVENT", "UID:p1", "SUMMARY:Alt", "DTSTART:20261001T080000Z", "DTEND:20261001T090000Z", "END:VEVENT"].join("\r\n");
  const items = icsToItems(wrap([weekly, limited, past]), "2026-10-23");
  const jour = items.find((i) => i.title === "Jour fixe");
  assert.equal(jour.repeat, "weekly");
  assert.deepEqual(jour.task.skipped, ["2026-11-03"]);
  assert.equal(jour.task.category, "life");
  const tut = items.filter((i) => i.title === "Tutorium");
  assert.deepEqual(tut.map((i) => i.date), ["2026-10-26", "2026-11-02", "2026-11-09"]);
  assert.equal(tut[0].task.category, "uni");
  assert.equal(new Set(tut.map((i) => i.id)).size, 3);
  assert.ok(!items.some((i) => i.title === "Alt"), "past single events are skipped");
  assert.equal(meetingLink("Join: https://zoom.us/j/123 or https://example.com"), "https://zoom.us/j/123");
});
