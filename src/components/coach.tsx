import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronRight, RefreshCw, Sparkles, Square, SquareCheck } from "lucide-react-native";
import { parseDate, type WeekFocus } from "@/lib/planner";
import { areas, fetchFocus, focusFor, saveFocus, weekFacts } from "@/lib/coach";
import { planningWeek } from "@/lib/weekplan";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, Sheet, s, useToday } from "./planner-ui";

const violet = "#B9A2F2";
// Weeks already tried in this session, so a failing request is not repeated
// on every render or tab switch.
const tried = new Set<string>();

function useWeekFocus() {
  const { state, update } = usePlanner();
  const today = useToday();
  const week = planningWeek(today);
  const focus = focusFor(state, week);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    const result = await fetchFocus(state, today);
    setBusy(false);
    if (typeof result === "string") return setError(result);
    update((prev) => ({ ...prev, weekFocus: saveFocus(prev.weekFocus, result) }));
  }
  function toggle(index: number) {
    if (!focus) return;
    tap("light");
    const next: WeekFocus = { ...focus, items: focus.items.map((i, j) => (j === index ? { ...i, done: !i.done } : i)) };
    update((prev) => ({ ...prev, weekFocus: saveFocus(prev.weekFocus, next) }));
  }
  return { state, today, week, focus, busy, error, create, toggle };
}

function FocusSheet({ focus, close }: { focus: ReturnType<typeof useWeekFocus>; close: () => void }) {
  const { focus: f, busy, error, week } = focus;
  return (
    <Sheet
      title="Dein Wochenfokus"
      subtitle={"Woche ab " + parseDate(week).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
      close={close}
      footer={
        <>
          <Button quiet icon={RefreshCw} disabled={busy} onPress={() => void focus.create()}>Neu</Button>
          <Button onPress={close}>Fertig</Button>
        </>
      }
    >
      {busy && (
        <View style={[s.row, { gap: 10 }]}>
          <ActivityIndicator color={violet} />
          <Text style={s.muted}>Schaue mir deine Woche an …</Text>
        </View>
      )}
      {f?.good ? (
        <View style={[s.row, { gap: 10, alignItems: "flex-start" }]}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#98C5A9", marginTop: 7 }} />
          <Text style={[s.body, { flex: 1, color: "#98C5A9", lineHeight: 20 }]}>{f.good}</Text>
        </View>
      ) : null}
      {f?.items.map((item, i) => (
        <View key={i} style={{ gap: 6, opacity: item.done ? 0.55 : 1 }}>
          <Text style={[s.eyebrow, { color: areas[item.area]?.color || violet }]}>{(areas[item.area]?.label || "Alltag").toUpperCase()}</Text>
          <Text style={{ color: C.ink, fontSize: 19, fontWeight: "700", letterSpacing: -0.3 }}>{item.title}</Text>
          {item.why ? <Text style={[s.muted, { lineHeight: 19 }]}>{item.why}</Text> : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            onPress={() => focus.toggle(i)}
            style={[s.row, { gap: 10, marginTop: 4, padding: 12, borderRadius: 14, backgroundColor: "#16161A", borderWidth: 1, borderColor: "#26262C", alignItems: "flex-start" }]}
          >
            {item.done ? <SquareCheck size={20} color={violet} /> : <Square size={20} color={C.muted} />}
            <Text style={[s.body, { flex: 1, lineHeight: 20, textDecorationLine: item.done ? "line-through" : "none" }]}>{item.action}</Text>
          </Pressable>
        </View>
      ))}
      {f && !f.items.length ? <Text style={s.muted}>Diese Woche gibt es nichts Dringendes. Mach weiter wie bisher.</Text> : null}
      {error ? <Text style={s.formError}>{error}</Text> : null}
    </Sheet>
  );
}

// Home card: the most important open point in one line, tap for all.
export function FocusCard() {
  const focus = useWeekFocus();
  const { state, today, week, focus: f, busy, error } = focus;
  const [open, setOpen] = useState(false);
  // Created once per week, on the first visit of Home.
  useEffect(() => {
    if (f || !state.accessToken || tried.has(week) || !weekFacts(state, today).enough) return;
    const timer = setTimeout(() => {
      tried.add(week);
      void focus.create();
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, !!f, state.accessToken]);
  if (!state.accessToken) return null;
  const first = f?.items.find((i) => !i.done);
  const done = f ? f.items.filter((i) => i.done).length : 0;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Wochenfokus öffnen" onPress={() => setOpen(true)} style={[s.card, s.row, { padding: 16, marginBottom: 16, gap: 12 }]}>
        <Sparkles size={20} color={violet} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.eyebrow, { color: violet }]}>
            WOCHENFOKUS{f && f.items.length ? " · " + done + "/" + f.items.length : ""}
          </Text>
          <Text style={[s.h3, { marginTop: 3 }]} numberOfLines={1}>
            {busy && !f ? "Wird erstellt …" : first ? first.title : f ? (f.items.length ? "Alles geschafft" : "Nichts Dringendes") : error ? "Gerade nicht verfügbar" : "Antippen zum Erstellen"}
          </Text>
          {first ? <Text style={[s.micro, { marginTop: 2 }]} numberOfLines={1}>{first.action}</Text> : null}
        </View>
        {busy && !f ? <ActivityIndicator size="small" color={violet} /> : <ChevronRight size={18} color={C.muted} />}
      </Pressable>
      {open && (
        <FocusSheetOpen
          focus={focus}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Opening the sheet without a focus yet starts creating one.
function FocusSheetOpen({ focus, close }: { focus: ReturnType<typeof useWeekFocus>; close: () => void }) {
  useEffect(() => {
    if (focus.focus || focus.busy) return;
    const timer = setTimeout(() => void focus.create(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <FocusSheet focus={focus} close={close} />;
}
