import { dateKey, shiftDay, type Category, type Repeat, type Task } from "./planner.ts";
import { parseIcs, readEvents, type RawEvent } from "./ics.ts";

export type ImportItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  repeat: Repeat;
  allDay: boolean;
  link: string;
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

// Invitations carry long boilerplate; keep the meaningful first lines.
function cleanNote(e: RawEvent, link: string) {
  const lines = e.note
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^[_\-=*]{5,}$/.test(l) && !/^https?:\/\//.test(l) && !/^<|>$/.test(l));
  return [e.location, lines.slice(0, 4).join(" · "), link].filter(Boolean).join("\n").slice(0, 600);
}

const uniWords = /vorlesung|übung|seminar|klausur|prüfung|lern|tutorium|projekt|uni|dhbw|kurs/i;

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

function toItem(e: RawEvent, start: number, repeat: Repeat, skipped: string[], suffix = ""): ImportItem {
  const d = new Date(start);
  const link = meetingLink(e.note + " " + e.location);
  const online = !!link || /teams|zoom|online|webex/i.test(e.title + e.location);
  const category: Category = uniWords.test(e.title) ? "uni" : "life";
  const id = "ics-" + hash(e.uid + suffix);
  const duration = e.allDay ? 30 : Math.min(1440, Math.max(5, Math.round(e.length / 60000)));
  const task: Task = {
    id,
    title: e.title,
    note: cleanNote(e, link) + (e.allDay ? "\nGanztägig" : ""),
    date: dateKey(d),
    time: e.allDay ? "09:00" : clock(d),
    duration,
    category,
    icon: online ? "laptop" : category === "uni" ? "graduation" : "sparkles",
    repeat,
    skipped,
  };
  return { id, title: e.title, date: task.date, time: task.time, duration, repeat, allDay: e.allDay, link, task };
}

export function icsToItems(text: string, today = dateKey()): ImportItem[] {
  const items: ImportItem[] = [];
  for (const e of readEvents(text)) {
    const repeat = repeatOf(e);
    if (repeat) {
      // A past single event is not worth importing; series keep running.
      if (repeat === "none" && dateKey(new Date(e.start)) < today) continue;
      items.push(toItem(e, e.start, repeat, e.exdates.map((ms) => dateKey(new Date(ms)))));
      continue;
    }
    // Series with an end or special rules: the next half year as single tasks.
    const single = parseIcs(text, "import", today, shiftDay(today, 180)).filter((x) => x.title === e.title && x.id.includes(e.uid) && x.id.endsWith(":0"));
    for (const occ of single.slice(0, 60)) {
      const [h, m] = occ.start.split(":").map(Number);
      const d = new Date(occ.date + "T12:00:00");
      d.setHours(h, m, 0, 0);
      items.push(toItem(e, d.valueOf(), "none", [], ":" + occ.date));
    }
  }
  return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
