import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCalendarUrl, parseIcs } from "../src/lib/ics.ts";

process.env.TZ = "Europe/Berlin";
const ics = (events) => "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + events.join("\r\n") + "\r\nEND:VCALENDAR\r\n";
const ev = (lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

test("single, all-day, UTC and zoned events become local times", () => {
  const text = ics([
    ev(["UID:train", "SUMMARY:ICE 593 Stuttgart → Berlin", "DTSTART;TZID=Europe/Berlin:20261023T081200", "DTEND;TZID=Europe/Berlin:20261023T134500", "LOCATION:Stuttgart Hbf\\, Gleis 8"]),
    ev(["UID:flight", "SUMMARY:LH 1234 FRA-JFK", "DTSTART:20261024T090000Z", "DTEND:20261024T173000Z"]),
    ev(["UID:ny", "SUMMARY:Meeting NY", "DTSTART;TZID=America/New_York:20261024T090000", "DURATION:PT1H"]),
    ev(["UID:trip", "SUMMARY:Urlaub", "DTSTART;VALUE=DATE:20261026", "DTEND;VALUE=DATE:20261028"]),
    ev(["UID:x", "SUMMARY:Abgesagt", "STATUS:CANCELLED", "DTSTART:20261023T100000Z"]),
  ]);
  const out = parseIcs(text, "c", "2026-10-20", "2026-11-30");
  const pick = (t) => out.filter((e) => e.title === t).map((e) => [e.date, e.start, e.end, e.allDay]);
  assert.deepEqual(pick("ICE 593 Stuttgart → Berlin"), [["2026-10-23", "08:12", "13:45", false]]);
  assert.equal(out.find((e) => e.title.startsWith("ICE")).location, "Stuttgart Hbf, Gleis 8");
  assert.deepEqual(pick("LH 1234 FRA-JFK"), [["2026-10-24", "11:00", "19:30", false]]);
  assert.deepEqual(pick("Meeting NY"), [["2026-10-24", "15:00", "16:00", false]]);
  assert.deepEqual(pick("Urlaub"), [["2026-10-26", "00:00", "23:59", true], ["2026-10-27", "00:00", "23:59", true]]);
  assert.equal(pick("Abgesagt").length, 0);
});

test("overnight events are split per day and recurring series respect exceptions", () => {
  const text = ics([
    ev(["UID:night", "SUMMARY:Nachtzug", "DTSTART;TZID=Europe/Berlin:20261030T220000", "DTEND;TZID=Europe/Berlin:20261031T070000"]),
    ev(["UID:gym", "SUMMARY:Gym", "DTSTART;TZID=Europe/Berlin:20200106T180000", "DTEND;TZID=Europe/Berlin:20200106T190000", "RRULE:FREQ=WEEKLY;BYDAY=MO,TH", "EXDATE;TZID=Europe/Berlin:20261026T180000"]),
    ev(["UID:gym", "RECURRENCE-ID;TZID=Europe/Berlin:20261029T180000", "SUMMARY:Gym (später)", "DTSTART;TZID=Europe/Berlin:20261029T200000", "DTEND;TZID=Europe/Berlin:20261029T210000"]),
    ev(["UID:three", "SUMMARY:Kurs", "DTSTART:20261021T080000Z", "RRULE:FREQ=DAILY;COUNT=3"]),
  ]);
  const out = parseIcs(text, "c", "2026-10-20", "2026-11-03");
  assert.deepEqual(out.filter((e) => e.title === "Nachtzug").map((e) => [e.date, e.start, e.end]), [["2026-10-30", "22:00", "23:59"], ["2026-10-31", "00:00", "07:00"]]);
  assert.deepEqual(out.filter((e) => e.title.startsWith("Gym")).map((e) => [e.date, e.start, e.title]), [
    ["2026-10-22", "18:00", "Gym"],
    ["2026-10-29", "20:00", "Gym (später)"],
    ["2026-11-02", "18:00", "Gym"],
  ]);
  assert.deepEqual(out.filter((e) => e.title === "Kurs").map((e) => e.date), ["2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.equal(normalizeCalendarUrl("webcal://p01-caldav.icloud.com/published/2/abc"), "https://p01-caldav.icloud.com/published/2/abc");
  assert.equal(normalizeCalendarUrl("http://example.com/a.ics"), "");
});
