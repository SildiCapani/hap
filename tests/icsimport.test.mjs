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

test("organizer, attendees, meeting id, own reminder and Teams URL are taken over", async () => {
  const { icsToItems } = await import("../src/lib/icsImport.ts");
  const invite = wrap([
    [
      "BEGIN:VEVENT",
      "UID:full-1",
      "SEQUENCE:0",
      "SUMMARY:Sprint Review",
      "DTSTART;TZID=W. Europe Standard Time:20261028T130000",
      "DTEND;TZID=W. Europe Standard Time:20261028T134500",
      'ORGANIZER;CN="Wagner, Sebastian":mailto:wagner@firma.de',
      'ATTENDEE;CN=Anna Muster;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:anna@firma.de',
      "ATTENDEE;CN=Ben Beispiel:mailto:ben@firma.de",
      "ATTENDEE;CUTYPE=ROOM;CN=Raum 3.14:mailto:raum@firma.de",
      "LOCATION:Microsoft Teams-Besprechung",
      "CATEGORIES:Projekt",
      "X-MICROSOFT-CDO-BUSYSTATUS:TENTATIVE",
      "X-MICROSOFT-SKYPETEAMSMEETINGURL:https://teams.microsoft.com/l/meetup-join/xyz",
      "DESCRIPTION:Agenda:\\n1. Demo\\n2. Retro\\n\\n________________________________________________________________________________\\nMicrosoft Teams-Besprechung\\nBesprechungs-ID: 371 892 134 576\\nKennung: aB3xY9\\n________________________________________________________________________________",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "TRIGGER:-PT15M",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n"),
  ]);
  const [item] = icsToItems(invite, "2026-10-23");
  assert.equal(item.organizer, "Wagner, Sebastian");
  assert.equal(item.attendees, 2, "the room is not a person");
  assert.equal(item.alarm, 15);
  assert.equal(item.task.lead, 15);
  assert.equal(item.tentative, true);
  assert.equal(item.task.title, "Sprint Review (vorläufig)");
  assert.equal(item.task.category, "uni", "category 'Projekt' counts as study work");
  assert.equal(item.link, "https://teams.microsoft.com/l/meetup-join/xyz");
  const lines = item.task.note.split("\n");
  assert.ok(lines.includes("Von: Wagner, Sebastian"));
  assert.ok(lines.includes("Mit: Anna Muster, Ben Beispiel"));
  assert.ok(lines.includes("Meeting-ID 371 892 134 576 · Kennung aB3xY9"));
  assert.ok(lines.includes("1. Demo"));
  assert.ok(!item.task.note.includes("Microsoft Teams-Besprechung"), "online location and boilerplate are dropped");
});

test("a cancellation removes the imported meeting, a real room feeds travel planning", async () => {
  const { icsToItems, applyImport } = await import("../src/lib/icsImport.ts");
  const event = (extra) => ["BEGIN:VEVENT", "UID:room-1", "SUMMARY:Kundentermin", "DTSTART;TZID=Europe/Berlin:20261029T150000", "DTEND;TZID=Europe/Berlin:20261029T160000", "LOCATION:Hauptbahnhof Stuttgart\\, Treffpunkt Gleis 8", ...extra, "END:VEVENT"].join("\r\n");
  const places = [{ id: "hbf", name: "Hauptbahnhof", minutes: 20, mode: "transit", keywords: ["Hauptbahnhof"], lectures: false, training: false }];
  const [item] = icsToItems(wrap([event([])]), "2026-10-23", places);
  assert.equal(item.task.placeId, "hbf");
  assert.equal(item.place, "Hauptbahnhof");
  assert.ok(item.task.note.startsWith("Ort: Hauptbahnhof Stuttgart, Treffpunkt Gleis 8"));
  let tasks = applyImport([{ id: "other", title: "x" }], [item]);
  assert.deepEqual(tasks.map((t) => t.id), ["other", item.id]);
  const cancel = "BEGIN:VCALENDAR\r\nMETHOD:CANCEL\r\n" + event(["STATUS:CANCELLED", "SEQUENCE:1"]) + "\r\nEND:VCALENDAR";
  const [gone] = icsToItems(cancel, "2026-10-23", places);
  assert.equal(gone.cancelled, true);
  tasks = applyImport(tasks, [gone]);
  assert.deepEqual(tasks.map((t) => t.id), ["other"]);
});
