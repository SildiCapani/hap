// Minimal iCalendar (RFC 5545) reader for subscribed calendars: single and
// recurring events (DAILY/WEEKLY/MONTHLY/YEARLY), exceptions, time zones.
// Times are converted to the device's local time.

export type CalEvent = {
  id: string;
  calId: string;
  date: string;
  start: string;
  end: string;
  allDay: boolean;
  title: string;
  location: string;
  note: string;
};

type Stamp = { ms: number; allDay: boolean };
type Raw = Record<string, { value: string; params: Record<string, string> }[]>;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const clock = (d: Date) => pad(d.getHours()) + ":" + pad(d.getMinutes());

// Outlook writes Windows zone names; map the common ones to IANA names.
const windowsZones: Record<string, string> = {
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Romance Standard Time": "Europe/Paris",
  "GMT Standard Time": "Europe/London",
  "E. Europe Standard Time": "Europe/Chisinau",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Pacific Standard Time": "America/Los_Angeles",
  UTC: "UTC",
};

function zoneOffset(ms: number, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - ms;
}

function zonedTime(y: number, mo: number, d: number, h: number, mi: number, s: number, tzid: string) {
  const zone = windowsZones[tzid] || tzid.replace(/^\/?(mozilla\.org\/[^/]+\/)?/, "");
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const first = wall - zoneOffset(wall, zone);
    // A second pass handles the hours around daylight saving changes.
    return wall - zoneOffset(first, zone);
  } catch {
    return new Date(y, mo - 1, d, h, mi, s).valueOf();
  }
}

export function parseStamp(value: string, params: Record<string, string> = {}): Stamp | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!m[4] || params.VALUE === "DATE") return { ms: new Date(y, mo - 1, d).valueOf(), allDay: true };
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] || 0)];
  if (m[7]) return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
  if (params.TZID) return { ms: zonedTime(y, mo, d, h, mi, s, params.TZID), allDay: false };
  return { ms: new Date(y, mo - 1, d, h, mi, s).valueOf(), allDay: false };
}

function duration(value: string) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return 0;
  const [w, d, h, mi, s] = m.slice(2).map((x) => Number(x || 0));
  return (m[1] === "-" ? -1 : 1) * ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000;
}

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function readBlocks(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: Raw[] = [];
  let current: Raw | null = null;
  let depth = 0;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("BEGIN:")) depth++;
    else if (line.startsWith("END:") && depth) depth--;
    else if (line === "END:VEVENT") {
      events.push(current);
      current = null;
    } else {
      // NAME;PARAM=a;PARAM2="b:c":VALUE – the value starts after the first colon outside quotes.
      let quoted = false, split = -1;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') quoted = !quoted;
        else if (line[i] === ":" && !quoted) {
          split = i;
          break;
        }
      }
      if (split < 0) continue;
      const [name, ...rawParams] = line.slice(0, split).split(";");
      const params: Record<string, string> = {};
      for (const p of rawParams) {
        const [k, v = ""] = p.split("=");
        params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
      }
      // Properties of nested blocks (reminders: VALARM) are kept apart.
      const key = (depth ? "ALARM-" : "") + name.toUpperCase();
      (current[key] ??= []).push({ value: line.slice(split + 1), params });
    }
  }
  return events;
}

const weekdays: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Start times of all occurrences that may touch the window.
function occurrences(start: Stamp, rule: string | undefined, from: number, to: number, length: number) {
  if (!rule) return [start.ms];
  const r = Object.fromEntries(rule.split(";").map((p) => p.split("=")).map(([k, v]) => [k.toUpperCase(), v || ""]));
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseStamp(r.UNTIL)?.ms ?? Infinity : Infinity;
  const base = new Date(start.ms);
  const byDay = r.BYDAY ? r.BYDAY.split(",").map((d) => weekdays[d.slice(-2)]).filter((d) => d !== undefined) : [];
  const out: number[] = [];
  // Old daily/weekly series: jump close to the window instead of walking years.
  const period = r.FREQ === "DAILY" ? 86400000 * interval : r.FREQ === "WEEKLY" ? 7 * 86400000 * interval : 0;
  const skip = period ? Math.max(0, Math.floor((from - length - start.ms) / period) - 1) : 0;
  let n = skip * Math.max(1, byDay.length);
  for (let step = skip; step < skip + 3000 && n < count; step++) {
    const candidates: Date[] = [];
    const d = new Date(base);
    if (r.FREQ === "DAILY") d.setDate(base.getDate() + step * interval);
    else if (r.FREQ === "WEEKLY") {
      d.setDate(base.getDate() + step * interval * 7);
      if (byDay.length) {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        for (const wd of [...byDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
          const c = new Date(monday);
          c.setDate(monday.getDate() + ((wd + 6) % 7));
          if (c.valueOf() >= base.valueOf()) candidates.push(c);
        }
      }
    } else if (r.FREQ === "MONTHLY") d.setMonth(base.getMonth() + step * interval);
    else if (r.FREQ === "YEARLY") d.setFullYear(base.getFullYear() + step * interval);
    else return [start.ms];
    if (!candidates.length) candidates.push(d);
    for (const c of candidates) {
      if (c.valueOf() > until || n >= count) return out;
      n++;
      if (c.valueOf() + length >= from && c.valueOf() <= to) out.push(c.valueOf());
    }
    if (d.valueOf() > to) break;
  }
  return out;
}

export function parseIcs(text: string, calId: string, fromDay: string, toDay: string): CalEvent[] {
  const from = new Date(fromDay + "T00:00:00").valueOf();
  const to = new Date(toDay + "T23:59:59").valueOf();
  const blocks = readBlocks(text);
  const overridden = new Set<string>();
  for (const b of blocks)
    if (b["RECURRENCE-ID"]) {
      const s = parseStamp(b["RECURRENCE-ID"][0].value, b["RECURRENCE-ID"][0].params);
      if (s) overridden.add((b.UID?.[0].value || "") + "@" + s.ms);
    }
  const out: CalEvent[] = [];
  for (const b of blocks) {
    if (b.STATUS?.[0].value.toUpperCase() === "CANCELLED") continue;
    const start = b.DTSTART && parseStamp(b.DTSTART[0].value, b.DTSTART[0].params);
    if (!start) continue;
    const uid = b.UID?.[0].value || b.SUMMARY?.[0].value || String(start.ms);
    const endStamp = b.DTEND && parseStamp(b.DTEND[0].value, b.DTEND[0].params);
    const length = endStamp
      ? Math.max(0, endStamp.ms - start.ms)
      : b.DURATION
        ? duration(b.DURATION[0].value)
        : start.allDay
          ? 86400000
          : 0;
    const excluded = new Set(
      (b.EXDATE || []).flatMap((x) => x.value.split(",").map((v) => parseStamp(v, x.params)?.ms)),
    );
    const isOverride = !!b["RECURRENCE-ID"];
    const title = unescape(b.SUMMARY?.[0].value || "Termin").slice(0, 120);
    const location = unescape(b.LOCATION?.[0].value || "").slice(0, 160);
    const note = unescape(b.DESCRIPTION?.[0].value || "").slice(0, 400);
    for (const ms of occurrences(start, isOverride ? undefined : b.RRULE?.[0].value, from, to, length)) {
      if (excluded.has(ms) || (!isOverride && overridden.has(uid + "@" + ms))) continue;
      // Split events that cross midnight into one piece per day (max. 14 days).
      const first = new Date(ms), last = new Date(ms + Math.max(length, 1) - 1);
      const day = new Date(first.getFullYear(), first.getMonth(), first.getDate());
      for (let i = 0; i < 14 && day.valueOf() <= last.valueOf(); i++) {
        const key = dayKey(day);
        if (day.valueOf() + 86400000 > from && day.valueOf() <= to) {
          const startsToday = dayKey(first) === key, endsToday = dayKey(last) === key;
          out.push({
            id: calId + ":" + uid + ":" + ms + ":" + i,
            calId,
            date: key,
            start: start.allDay ? "00:00" : startsToday ? clock(first) : "00:00",
            end: start.allDay ? "23:59" : endsToday ? clock(new Date(ms + length)) : "23:59",
            allDay: start.allDay,
            title,
            location,
            note,
          });
        }
        day.setDate(day.getDate() + 1);
      }
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 3000);
}

export function normalizeCalendarUrl(value: string) {
  const url = value.trim().replace(/^webcals?:\/\//i, "https://");
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export type RawEvent = {
  uid: string;
  title: string;
  location: string;
  note: string;
  start: number;
  allDay: boolean;
  length: number;
  rrule: string;
  exdates: number[];
  cancelled: boolean;
  tentative: boolean;
  organizer: string;
  attendees: string[];
  alarm: number | null; // minutes before start
  categories: string[];
  link: string;
};

const person = (x: { value: string; params: Record<string, string> }) =>
  (x.params.CN || x.value.replace(/^mailto:/i, "")).replace(/^"|"$/g, "").trim();

// Single events of a file with their repeat rule, for importing an .ics file
// (e.g. a Teams invitation) into the plan. A cancellation file (METHOD:CANCEL)
// marks its events as cancelled so they can be removed.
export function readEvents(text: string): RawEvent[] {
  const method = /^METHOD:(\w+)/im.exec(text)?.[1]?.toUpperCase() || "";
  const out: RawEvent[] = [];
  for (const b of readBlocks(text)) {
    if (b["RECURRENCE-ID"]) continue;
    const start = b.DTSTART && parseStamp(b.DTSTART[0].value, b.DTSTART[0].params);
    if (!start) continue;
    const end = b.DTEND && parseStamp(b.DTEND[0].value, b.DTEND[0].params);
    const trigger = b["ALARM-TRIGGER"]?.find((t) => !t.params.VALUE && t.params.RELATED !== "END");
    const before = trigger ? -duration(trigger.value) / 60000 : NaN;
    const organizer = b.ORGANIZER ? person(b.ORGANIZER[0]) : "";
    out.push({
      uid: b.UID?.[0].value || b.SUMMARY?.[0].value || String(start.ms),
      title: unescape(b.SUMMARY?.[0].value || "Termin").replace(/^(Abgesagt|Canceled|Cancelled):\s*/i, "").slice(0, 120),
      location: unescape(b.LOCATION?.[0].value || "").slice(0, 160),
      note: unescape(b.DESCRIPTION?.[0].value || ""),
      start: start.ms,
      allDay: start.allDay,
      length: end ? Math.max(0, end.ms - start.ms) : b.DURATION ? duration(b.DURATION[0].value) : start.allDay ? 86400000 : 30 * 60000,
      rrule: b.RRULE?.[0].value || "",
      exdates: (b.EXDATE || []).flatMap((x) => x.value.split(",").map((v) => parseStamp(v, x.params)?.ms ?? 0)).filter(Boolean),
      cancelled: method === "CANCEL" || b.STATUS?.[0].value.toUpperCase() === "CANCELLED",
      tentative:
        b.STATUS?.[0].value.toUpperCase() === "TENTATIVE" ||
        b["X-MICROSOFT-CDO-BUSYSTATUS"]?.[0].value.toUpperCase() === "TENTATIVE",
      organizer,
      attendees: (b.ATTENDEE || [])
        .filter((a) => (a.params.CUTYPE || "INDIVIDUAL").toUpperCase() === "INDIVIDUAL")
        .map(person)
        .filter((n) => n && n !== organizer)
        .slice(0, 40),
      alarm: Number.isFinite(before) && before >= 0 && before <= 7 * 1440 ? Math.round(before) : null,
      categories: (b.CATEGORIES || []).flatMap((c) => unescape(c.value).split(",")).map((c) => c.trim()).filter(Boolean),
      link: (b["X-MICROSOFT-SKYPETEAMSMEETINGURL"] || b["X-MICROSOFT-ONLINEMEETINGCONFLINK"] || b.URL || [])[0]?.value || "",
    });
  }
  return out;
}
