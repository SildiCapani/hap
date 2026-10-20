import { tasksFor, type Place, type PlannerState } from "./planner.ts";
import { minutes } from "./rapla.ts";
import { workoutsFor } from "./training.ts";

// Plans the way between home and the places of the day with fixed travel
// times: leave early enough, go home in long gaps, and flag tight changes.
export const HOME = "home";

export type Leg = {
  key: string;
  from: string;
  to: string;
  depart: number;
  minutes: number;
  mode: Place["mode"];
  estimated: boolean;
  late: number; // minutes missing to arrive on time
  target: string; // title of the appointment the leg leads to ("" for the way home)
};

type Located = { key: string; title: string; start: number; end: number; place: string };

const online = /\b(online|zoom|teams|webex|meet\.google|remote|digital)\b/i;
export const modeLabel = { transit: "Bahn/ÖPNV", walk: "zu Fuß" } as const;

function byKeywords(places: Place[], text: string) {
  const t = text.toLowerCase();
  return places.find((p) => p.keywords.some((k) => k.trim() && t.includes(k.trim().toLowerCase())));
}

// Where the appointments of a day take place; items without a known place are skipped.
export function locatedItems(state: PlannerState, day: string): Located[] {
  const places = state.places;
  if (!places.length) return [];
  const known = (id?: string) => (id === HOME || places.some((p) => p.id === id) ? id : undefined);
  const out: Located[] = [];
  for (const t of tasksFor(state, day)) {
    const place = known(t.placeId);
    if (place) out.push({ key: "t:" + t.id, title: t.title, start: minutes(t.time), end: minutes(t.time) + t.duration, place });
  }
  for (const e of state.uniEvents.filter((x) => x.date === day && x.kind !== "info")) {
    if (minutes(e.end) - minutes(e.start) >= 9 * 60) continue;
    const text = [e.title, ...e.rooms].join(" ");
    if (online.test(text)) continue;
    const place = byKeywords(places, text) || places.find((p) => p.lectures);
    if (place) out.push({ key: "u:" + e.id, title: e.title, start: minutes(e.start), end: minutes(e.end), place: place.id });
  }
  for (const e of state.calEvents.filter((x) => x.date === day && !x.allDay)) {
    const text = e.title + " " + e.location;
    if (online.test(text)) continue;
    const place = byKeywords(places, text);
    if (place) out.push({ key: "c:" + e.id, title: e.title, start: minutes(e.start), end: minutes(e.end), place: place.id });
  }
  const gym = places.find((p) => p.training);
  if (gym)
    for (const w of workoutsFor(state, day))
      out.push({ key: "w:" + w.id, title: w.name + " – Training", start: minutes(w.time), end: minutes(w.time) + w.duration, place: gym.id });
  const campus = places.find((p) => p.lectures);
  if (campus)
    for (const x of state.exams.filter((e) => e.date === day && e.time && e.kind !== "assignment"))
      out.push({ key: "e:" + x.id, title: x.title, start: minutes(x.time), end: minutes(x.time) + 90, place: campus.id });
  return out.sort((a, b) => a.start - b.start);
}

function travel(places: Place[], from: string, to: string) {
  if (from === to) return { minutes: 0, mode: "walk" as const, estimated: false };
  const a = places.find((p) => p.id === from), b = places.find((p) => p.id === to);
  if (from === HOME && b) return { minutes: b.minutes, mode: b.mode, estimated: false };
  if (to === HOME && a) return { minutes: a.minutes, mode: a.mode, estimated: false };
  // Between two places only the times from home are known; use the longer one.
  const longer = (a?.minutes || 0) >= (b?.minutes || 0) ? a : b;
  return { minutes: longer?.minutes || 20, mode: longer?.mode || "transit", estimated: true };
}

export function travelPlan(state: PlannerState, day: string): Leg[] {
  if (!state.transport.enabled) return [];
  const places = state.places;
  const buffer = state.transport.buffer;
  const items = locatedItems(state, day);
  const legs: Leg[] = [];
  let at = HOME;
  let free = -Infinity; // when the previous appointment ends
  const add = (from: string, to: string, depart: number, target: string, key: string) => {
    const t = travel(places, from, to);
    const start = Math.max(0, depart);
    legs.push({
      key,
      from,
      to,
      depart: start,
      minutes: t.minutes,
      mode: t.mode,
      estimated: t.estimated,
      late: Math.max(0, Math.round(free - depart)),
      target,
    });
  };
  for (const item of items) {
    if (at !== HOME && Number.isFinite(free)) {
      // A long gap is spent at home – also between two appointments at the
      // same place – when at least an hour remains there.
      const back = travel(places, at, HOME).minutes, out = travel(places, HOME, item.place).minutes;
      if (item.start - free >= back + out + 2 * buffer + 60) {
        add(at, HOME, free, "", "travel:" + item.key + ":home");
        at = HOME;
        free = free + back;
      }
    }
    if (item.place === at) {
      free = Math.max(free, item.end);
      continue;
    }
    add(at, item.place, item.start - buffer - travel(places, at, item.place).minutes, item.title, "travel:" + item.key);
    at = item.place;
    free = item.end;
  }
  if (at !== HOME && Number.isFinite(free)) add(at, HOME, free, "", "travel:end:" + day);
  return legs.filter((l) => l.minutes > 0);
}

export function placeName(state: PlannerState, id: string) {
  return id === HOME ? "Zuhause" : state.places.find((p) => p.id === id)?.name || "Unterwegs";
}

export const placePresets = [
  { name: "DHBW", minutes: 35, mode: "transit" as const, keywords: ["DHBW", "LE1", "Lerchenstr"], lectures: true, training: false },
  { name: "Gym", minutes: 10, mode: "walk" as const, keywords: ["Gym", "Fitness"], training: true, lectures: false },
  { name: "Hauptbahnhof", minutes: 20, mode: "transit" as const, keywords: ["Hbf", "Hauptbahnhof"], lectures: false, training: false },
  { name: "Flughafen", minutes: 45, mode: "transit" as const, keywords: ["Flughafen", "Airport", "STR "], lectures: false, training: false },
];
