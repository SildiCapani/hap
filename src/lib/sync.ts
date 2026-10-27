import type { PlannerState } from "./planner.ts";

// Data that belongs to one device (secrets, permissions, running sessions,
// feeds each device downloads itself) is never synced.
export const LOCAL_KEYS = [
  "accessToken",
  "apiUrl",
  "cloudLinked",
  "installHidden",
  "activeFocus",
  "activeWorkout",
  "notify",
  "uniEvents",
  "uniSynced",
  "calEvents",
  "quotes",
] as const;

export type Synced = Record<string, unknown>;

export function subset(state: PlannerState): Synced {
  const out: Synced = { ...state };
  for (const k of LOCAL_KEYS) delete out[k];
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const keyOf = (item: unknown) => {
  const o = item as Record<string, unknown> | null;
  return o && typeof o === "object" ? String(o.id ?? o.date ?? JSON.stringify(o)) : JSON.stringify(item);
};

// Lists of records are merged item by item: whatever only one side changed
// wins; if both changed the same item, this device wins.
function mergeList(base: unknown[] = [], local: unknown[] = [], remote: unknown[] = []) {
  if ([...local, ...remote].every((x) => typeof x !== "object" || x === null))
    return [...new Set([...local, ...remote].map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x));
  const b = new Map(base.map((x) => [keyOf(x), x]));
  const l = new Map(local.map((x) => [keyOf(x), x]));
  const r = new Map(remote.map((x) => [keyOf(x), x]));
  const out: unknown[] = [];
  for (const [k, li] of l) {
    const ri = r.get(k), bi = b.get(k);
    if (ri === undefined) {
      // Missing remotely: deleted there unless this device changed it since.
      if (bi === undefined || !same(li, bi)) out.push(li);
    } else out.push(same(li, bi) ? ri : li);
  }
  for (const [k, ri] of r) {
    if (l.has(k)) continue;
    const bi = b.get(k);
    // Missing locally: deleted here unless the other device changed it since.
    if (bi === undefined || !same(ri, bi)) out.push(ri);
  }
  return out;
}

function mergeRecord(base: Record<string, unknown> = {}, local: Record<string, unknown> = {}, remote: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)])) {
    const v = mergeValue(base[k], local[k], remote[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) return mergeList(Array.isArray(base) ? base : [], local, remote);
  const isRecord = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  // Records of flags (done, groceries, protein) merge per key.
  if (isRecord(local) && isRecord(remote) && Object.values(local as object).every((v) => typeof v !== "object"))
    return mergeRecord(isRecord(base) ? (base as Record<string, unknown>) : {}, local as Record<string, unknown>, remote as Record<string, unknown>);
  return local;
}

export function merge3(base: Synced | null, local: Synced, remote: Synced): Synced {
  return mergeRecord(base || {}, local, remote) as Synced;
}

export function applySynced(state: PlannerState, merged: Synced): PlannerState {
  const next = { ...state, ...merged } as PlannerState;
  for (const k of LOCAL_KEYS) (next as Record<string, unknown>)[k] = state[k];
  return next;
}

export const sameData = same;
