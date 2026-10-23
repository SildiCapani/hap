import { dateKey, shiftDay, type Category, type Place, type Repeat, type Task } from "./planner.ts";
import { parseIcs, readEvents, type RawEvent } from "./ics.ts";

export type ImportItem = {
  id: string;
  source: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  repeat: Repeat;
  allDay: boolean;
  link: string;
  organizer: string;
  attendees: number;
  alarm: number | null;
  tentative: boolean;
  cancelled: boolean;
  place: string;
  task: Task;
};

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => pad(d.getHours()) + ":" + pad(d.getMinutes());

// Stable id so importing the same invitation again updates the task.
function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function meetingLink(text: string) {
  const urls = text.match(/https:\/\/[^\s<>"')\]]+/g) || [];
  return urls.find((u) => /teams\.microsoft\.com|teams\.live\.com|zoom\.us|meet\.google\.com|webex\.com/i.test(u)) || urls[0] || "";
}

// Teams/Zoom put the dial-in data into the description.
function meetingId(text: string) {
  const id = /(?:Besprechungs-ID|Meeting[- ]ID|Konferenz-ID)\s*:?\s*([\d ]{6,})/i.exec(text)?.[1]?.trim();
  const code = /(?:Kennung|Passcode|Kenncode|Password|Passwort)\s*:?\s*([A-Za-z0-9]{4,12})/i.exec(text)?.[1];
  return [id && "Meeting-ID " + id, code && "Kennung " + code].filter(Boolean).join(" · ");
}

const online = (text: string) => /teams|zoom|webex|online|meet\.google|skype/i.test(text);

// The agenda without the meeting boilerplate (join hints, dial-in blocks, lines of underscores).
function agenda(text: string) {
  const cut = text.search(/_{10,}|Microsoft Teams[- ]Besprechung|Microsoft Teams meeting|Join Zoom Meeting|Jetzt an der Besprechung teilnehmen/i);
  return (cut >= 0 ? text.slice(0, cut) : text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^https?:\/\//.test(l))
    .join("\n")
    .slice(0, 900);
}

function note(e: RawEvent, link: string) {
  const people = e.attendees.length
    ? e.attendees.slice(0, 4).join(", ") + (e.attendees.length > 4 ? " +" + (e.attendees.length - 4) : "")
    : "";
  return [
    e.location && !online(e.location) && "Ort: " + e.location,
    e.organizer && "Von: " + e.organizer,
    people && "Mit: " + people,
    meetingId(e.note),
    link && "Link: " + link,
    agenda(e.note),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);
}

const uniWords = /vorlesung|übung|seminar|klausur|prüfung|lern|tutorium|projekt|uni|dhbw|kurs|studium/i;
const sportWords = /training|sport|gym|lauf|fußball|fitness/i;

function category(e: RawEvent): Category {
  const text = e.title + " " + e.categories.join(" ");
  if (sportWords.test(text)) return "sport";
  if (uniWords.test(text)) return "uni";
  return "life";
}

// A real room (not Teams) that matches one of the user's places feeds the travel planning.
function placeFor(e: RawEvent, places: Place[]) {
  if (!e.location || online(e.location)) return undefined;
  const text = e.location.toLowerCase();
  return places.find((p) => p.keywords.some((k) => k.trim() && text.includes(k.trim().toLowerCase())))?.id;
}

// Simple open-ended series map to the planner's repeats; anything else
// (an end date, a count, unusual days) is expanded into single events.
function repeatOf(e: RawEvent): Repeat | null {
  if (!e.rrule) return "none";
  const r = Object.fromEntries(e.rrule.split(";").map((p) => p.split("=")).map(([k, v]) => [k.toUpperCase(), v || ""]));
  if (r.UNTIL || r.COUNT || (r.INTERVAL && r.INTERVAL !== "1")) return null;
  const days = (r.BYDAY || "").split(",").filter(Boolean).map((d) => d.slice(-2));
  if (r.FREQ === "DAILY" && !days.length) return "daily";
  if (r.FREQ === "WEEKLY" && days.sort().join(",") === "FR,MO,TH,TU,WE") return "weekdays";
  const weekday = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][new Date(e.start).getDay()];
  if (r.FREQ === "WEEKLY" && (!days.length || (days.length === 1 && days[0] === weekday))) return "weekly";
  return null;
}

function toItem(e: RawEvent, start: number, repeat: Repeat, skipped: string[], places: Place[], suffix = ""): ImportItem {
  const d = new Date(start);
  const link = e.link || meetingLink(e.note + " " + e.location);
  const isOnline = !!link || online(e.title + " " + e.location);
  const cat = category(e);
  const id = "ics-" + hash(e.uid + suffix);
  const duration = e.allDay ? 30 : Math.min(1440, Math.max(5, Math.round(e.length / 60000)));
  const placeId = placeFor(e, places);
  const task: Task = {
    id,
    title: e.title + (e.tentative ? " (vorläufig)" : ""),
    note: note(e, link) + (e.allDay ? "\nGanztägig" : ""),
    date: dateKey(d),
    time: e.allDay ? "09:00" : clock(d),
    duration,
    category: cat,
    icon: isOnline ? "laptop" : cat === "uni" ? "graduation" : cat === "sport" ? "dumbbell" : "sparkles",
    repeat,
    skipped,
    source: "ics:" + e.uid,
    ...(e.alarm !== null ? { lead: e.alarm } : {}),
    ...(placeId ? { placeId } : {}),
  };
  return {
    id,
    source: task.source as string,
    title: task.title,
    date: task.date,
    time: task.time,
    duration,
    repeat,
    allDay: e.allDay,
    link,
    organizer: e.organizer,
    attendees: e.attendees.length,
    alarm: e.alarm,
    tentative: e.tentative,
    cancelled: e.cancelled,
    place: placeId ? places.find((p) => p.id === placeId)?.name || "" : "",
    task,
  };
}

export function icsToItems(text: string, today = dateKey(), places: Place[] = []): ImportItem[] {
  const items: ImportItem[] = [];
  for (const e of readEvents(text)) {
    const repeat = repeatOf(e);
    if (repeat) {
      // A past single event is not worth importing; series keep running.
      if (repeat === "none" && dateKey(new Date(e.start)) < today && !e.cancelled) continue;
      items.push(toItem(e, e.start, repeat, e.exdates.map((ms) => dateKey(new Date(ms))), places));
      continue;
    }
    if (e.cancelled) {
      items.push(toItem(e, e.start, "none", [], places));
      continue;
    }
    // Series with an end or special rules: the next half year as single tasks.
    const single = parseIcs(text, "import", today, shiftDay(today, 180)).filter((x) => x.title === e.title && x.id.includes(e.uid) && x.id.endsWith(":0"));
    for (const occ of single.slice(0, 60)) {
      const [h, m] = occ.start.split(":").map(Number);
      const d = new Date(occ.date + "T12:00:00");
      d.setHours(h, m, 0, 0);
      items.push(toItem(e, d.valueOf(), "none", [], places, ":" + occ.date));
    }
  }
  return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// Applies chosen items: an invitation replaces every task it created before
// (moved meetings, changed series); a cancellation removes them.
export function applyImport(tasks: Task[], chosen: ImportItem[]) {
  const sources = new Set(chosen.map((i) => i.source));
  const ids = new Set(chosen.map((i) => i.id));
  return [
    ...tasks.filter((t) => !ids.has(t.id) && (!t.source || !sources.has(t.source))),
    ...chosen.filter((i) => !i.cancelled).map((i) => i.task),
  ];
}
