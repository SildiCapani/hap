import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View, type DimensionValue, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { router } from "expo-router";
import {
  CalendarDays,
  Check,
  Footprints,
  TrainFront,
  Dumbbell,
  Flag,
  GraduationCap,
  MapPin,
  Plus,
  User,
} from "lucide-react-native";
import { newId, occurrenceKey, parseDate, type Task } from "@/lib/planner";
import { agenda, layout, type AgendaItem } from "@/lib/agenda";
import { modeLabel, placeName } from "@/lib/transport";
import { clock } from "@/lib/study";
import { moveWorkout } from "@/lib/training";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import type { UniEvent } from "@/lib/rapla";
import type { CalEvent } from "@/lib/ics";
import { Button, C, Icon, Sheet, s, useEditor, useToday } from "./planner-ui";

const HOUR = 60;
const GUTTER = 54;

export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

let dragging = false;
let droppedAt = 0;
function setDragging(value: boolean) {
  dragging = value;
  if (!value) droppedAt = Date.now();
}
// The release after a drag must not count as a tap.
function justDropped() {
  return Date.now() - droppedAt < 400;
}
// While a drag is active on the web, the page must not scroll under the finger.
if (Platform.OS === "web" && typeof document !== "undefined")
  document.addEventListener(
    "touchmove",
    (e) => {
      if (dragging) e.preventDefault();
    },
    { passive: false },
  );

// Long-press, then drag up or down: the start time follows in 5-minute steps.
function Draggable({
  enabled,
  style,
  minDy,
  maxDy,
  onMove,
  onDrop,
  onPress,
  label,
  children,
}: {
  enabled: boolean;
  style: ViewStyle;
  minDy: number;
  maxDy: number;
  onMove: (step: number) => void;
  onDrop: (step: number) => void;
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const step = useSharedValue(0);
  const begin = () => {
    setDragging(true);
    tap("medium");
    onMove(0);
  };
  const move = (n: number) => {
    if (n % 15 === 0) tap("select");
    onMove(n);
  };
  const end = (n: number) => {
    setDragging(false);
    onDrop(n);
  };
  const cleanup = () => {
    if (dragging) setDragging(false);
  };
  const press = () => {
    if (!justDropped()) onPress();
  };
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(350)
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 });
      scheduleOnRN(begin);
    })
    .onUpdate((e) => {
      const dy = Math.min(maxDy, Math.max(minDy, e.translationY));
      y.value = dy;
      const n = Math.round((dy / HOUR) * 12) * 5;
      if (n !== step.value) {
        step.value = n;
        scheduleOnRN(move, n);
      }
    })
    .onEnd(() => {
      scheduleOnRN(end, step.value);
    })
    .onFinalize(() => {
      lifted.value = withTiming(0, { duration: 150 });
      y.value = 0;
      step.value = 0;
      scheduleOnRN(cleanup);
    });
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.03 }],
    zIndex: lifted.value > 0 ? 20 : 1,
    shadowOpacity: lifted.value * 0.5,
  }));
  return (
    <GestureDetector gesture={pan} touchAction="pan-y" userSelect="none">
      <Animated.View style={[style, { shadowColor: "#000", shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, animated]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={enabled ? "Gedrückt halten und ziehen, um die Uhrzeit zu ändern" : undefined}
          onPress={press}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          {children}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function DayTimeline({ day, compact = false }: { day: string; compact?: boolean }) {
  const { state, update } = usePlanner();
  const edit = useEditor();
  const today = useToday();
  const now = useNow();
  const [event, setEvent] = useState<UniEvent | null>(null);
  const [calEvent, setCalEvent] = useState<CalEvent | null>(null);
  const [drag, setDrag] = useState<{ key: string; start: number } | null>(null);
  const [series, setSeries] = useState<{ task: Task; time: string } | null>(null);
  const [travel, setTravel] = useState<AgendaItem | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [late, setLate] = useState(false);
  const { timed: all, allDay } = agenda(state, day);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // In compact mode today starts one hour before now; the past stays one tap away.
  const cut =
    compact && !expanded && day === today ? Math.max(0, now.getHours() - 1) * 60 : 0;
  const hidden = all.filter((i) => i.end <= cut).length;
  const timed = all.filter((i) => i.end > cut);
  const first = cut
    ? cut / 60
    : Math.min(7, ...timed.map((i) => Math.floor(i.start / 60)));
  // The evening ends at 22:00 (or with the last item); one tap shows it until midnight.
  const natural = Math.min(
    24,
    Math.max(22, ...timed.map((i) => Math.ceil(Math.max(i.end, i.start + 30) / 60))),
  );
  const last = late ? 24 : natural;
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (mins: number) => ((mins - first * 60) / 60) * HOUR;
  function open(item: AgendaItem) {
    tap();
    if (item.kind === "task") edit(day, item.task);
    else if (item.kind === "uni" && item.event) setEvent(item.event);
    else if (item.kind === "cal" && item.cal) setCalEvent(item.cal);
    else if (item.kind === "training") router.push("/training" as "/");
    else if (item.kind === "travel") setTravel(item);
    else router.push("/study" as "/");
  }
  function moveTask(task: Task, time: string, onlyThisDay: boolean) {
    tap("success");
    update((prev) => {
      if (!onlyThisDay)
        return { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, time } : t)) };
      // One occurrence of a series: skip it there and add a single copy at the new time.
      const copy: Task = { ...task, id: newId("task"), date: day, time, repeat: "none", skipped: [] };
      const doneKey = occurrenceKey(task, day);
      return {
        ...prev,
        tasks: [...prev.tasks.map((t) => (t.id === task.id ? { ...t, skipped: [...t.skipped, day] } : t)), copy],
        done: prev.done[doneKey] ? { ...prev.done, [occurrenceKey(copy, day)]: true } : prev.done,
      };
    });
  }
  function drop(item: AgendaItem, steps: number) {
    setDrag(null);
    const workout = item.workout;
    if (item.kind === "training" && workout && steps) {
      // Only this day: the weekly plan stays as it is.
      tap("success");
      update((prev) => moveWorkout(prev, workout.id, day, day, clock(item.start + steps)));
      return;
    }
    if (!item.task || !steps) return;
    const time = clock(item.start + steps);
    if (item.task.repeat === "none") moveTask(item.task, time, false);
    else setSeries({ task: item.task, time });
  }
  function toggle(item: AgendaItem) {
    if (!item.task) return;
    const key = occurrenceKey(item.task, day);
    tap(item.done ? "light" : "success");
    update((prev) => ({ ...prev, done: { ...prev.done, [key]: !prev.done[key] } }));
  }
  return (
    <View style={{ paddingVertical: 4 }}>
      {allDay.length > 0 && (
        <View style={{ gap: 6, paddingHorizontal: 14, paddingBottom: 12 }}>
          {allDay.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              onPress={() => open(a)}
              style={[
                s.row,
                {
                  backgroundColor: a.pale,
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: a.color,
                },
              ]}
            >
              <Flag size={13} color={a.color} />
              <Text numberOfLines={1} style={{ color: a.color, fontSize: 12, fontWeight: "600", flex: 1 }}>
                {a.title}
              </Text>
              <Text style={s.micro}>ganztägig</Text>
            </Pressable>
          ))}
        </View>
      )}
      {(hidden > 0 || (compact && expanded)) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded(!expanded)}
          style={[s.row, { paddingHorizontal: 16, paddingBottom: 10 }]}
        >
          <Text style={s.link}>
            {expanded ? "Vergangenes ausblenden" : hidden + (hidden === 1 ? " früherer Termin" : " frühere Termine") + " anzeigen"}
          </Text>
        </Pressable>
      )}
      <View style={{ height: hours.length * HOUR, position: "relative" }}>
        {hours.map((h) => (
          <Pressable
            key={h}
            accessibilityRole="button"
            accessibilityLabel={"Um " + h + " Uhr etwas planen"}
            onPress={() => {
              tap();
              edit(day, undefined, { date: day, time: String(h).padStart(2, "0") + ":00" });
            }}
            style={({ pressed }) => ({
              position: "absolute",
              top: (h - first) * HOUR,
              left: 0,
              right: 0,
              height: HOUR,
              flexDirection: "row",
              backgroundColor: pressed ? "#141417" : "transparent",
            })}
          >
            <Text style={{ width: GUTTER, textAlign: "right", paddingRight: 10, color: "#5A5862", fontSize: 11, marginTop: -7, fontVariant: ["tabular-nums"] }}>
              {String(h).padStart(2, "0")}:00
            </Text>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: "#1A1A1F" }}>
              <View style={{ position: "absolute", top: HOUR / 2, left: 0, right: 0, borderTopWidth: 1, borderTopColor: "#121215" }} />
            </View>
          </Pressable>
        ))}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: GUTTER + 4, right: 10 }}>
          {layout(timed).map(({ item, col, cols }) => {
            const start = Math.max(item.start, first * 60);
            const height = Math.max(26, top(Math.max(item.end, start + 26)) - top(start) - 2);
            const compact = height < 46;
            const past = day < today || (day === today && item.end <= nowMin);
            const movable = item.kind === "task" || (item.kind === "training" && !item.done);
            const preview = drag?.key === item.key ? drag.start : null;
            return (
              <Draggable
                key={item.key}
                enabled={movable}
                minDy={top(first * 60) - top(start)}
                maxDy={top(last * 60 - Math.max(15, item.end - item.start)) - top(start)}
                onMove={(n) => setDrag({ key: item.key, start: Math.max(0, item.start + n) })}
                onDrop={(n) => drop(item, n)}
                onPress={() => open(item)}
                label={clock(item.start) + " " + item.title}
                style={{
                  position: "absolute",
                  top: top(start) + 1,
                  height,
                  left: ((col / cols) * 100 + "%") as DimensionValue,
                  width: ((100 / cols) + "%") as DimensionValue,
                  paddingRight: 3,
                }}
              >
              <View style={{ flex: 1, opacity: preview !== null ? 1 : item.done ? 0.5 : past ? 0.72 : 1 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: item.kind === "travel" ? "transparent" : item.color + "1F",
                    borderRadius: 10,
                    borderLeftWidth: 3,
                    borderLeftColor: item.color,
                    // Travel blocks are dashed so they read as "on the way", not as appointments.
                    ...(item.kind === "travel" ? { borderWidth: 1, borderStyle: "dashed" as const, borderColor: item.color + "88", borderLeftWidth: 3 } : null),
                    paddingHorizontal: 9,
                    paddingVertical: compact ? 3 : 7,
                    overflow: "hidden",
                    flexDirection: "row",
                    gap: 7,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={compact ? 1 : 2}
                      style={{
                        color: "#F1F0F3",
                        fontSize: 13,
                        fontWeight: "600",
                        textDecorationLine: item.done ? "line-through" : "none",
                      }}
                    >
                      {compact ? clock(item.start) + "  " : ""}
                      {item.title}
                    </Text>
                    {!compact && (
                      <View style={[s.row, { gap: 5, marginTop: 3 }]}>
                        {item.kind === "travel" ? (
                          item.leg?.mode === "walk" ? <Footprints size={11} color={item.color} /> : <TrainFront size={11} color={item.color} />
                        ) : item.kind === "cal" ? (
                          <CalendarDays size={11} color={item.color} />
                        ) : item.kind === "uni" ? (
                          <GraduationCap size={11} color={item.color} />
                        ) : item.kind === "training" ? (
                          <Dumbbell size={11} color={item.color} />
                        ) : item.task ? (
                          <Icon name={item.task.icon} size={11} color={item.color} />
                        ) : null}
                        <Text numberOfLines={1} style={{ color: item.color, fontSize: 11, flex: 1 }}>
                          {clock(item.start)}–{clock(item.end)} · {item.sub}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.kind === "task" && (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.done }}
                      accessibilityLabel={item.title + (item.done ? " wieder öffnen" : " abhaken")}
                      hitSlop={8}
                      onPress={() => toggle(item)}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 1.4,
                        borderColor: item.done ? item.color : "#6B6574",
                        backgroundColor: item.done ? item.color : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: compact ? 0 : 1,
                      }}
                    >
                      {item.done && <Check size={13} color="#121316" strokeWidth={3} />}
                    </Pressable>
                  )}
                  {item.kind === "training" && item.done && <Check size={15} color={item.color} />}
                </View>
                {preview !== null && (
                  <View style={{ position: "absolute", right: 6, top: -12, backgroundColor: item.color, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#121316", fontWeight: "800", fontSize: 12, fontVariant: ["tabular-nums"] }}>
                      {clock(preview)}–{clock(preview + (item.end - item.start))}
                    </Text>
                  </View>
                )}
              </View>
              </Draggable>
            );
          })}
        </View>
        {day === today && nowMin >= first * 60 && nowMin <= last * 60 && (
          <View pointerEvents="none" style={{ position: "absolute", top: top(nowMin) - 1, left: GUTTER - 6, right: 0, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
            <View style={{ flex: 1, height: 2, backgroundColor: C.green }} />
          </View>
        )}
      </View>
      {natural < 24 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            setLate(!late);
          }}
          style={[s.row, { paddingHorizontal: 16, paddingTop: 10 }]}
        >
          <Text style={s.link}>{late ? "Späte Stunden ausblenden" : "Bis 24:00 anzeigen"}</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => edit(day)}
        style={[s.addRow, { paddingBottom: 6 }]}
      >
        <Plus size={18} color={C.green} />
        <Text style={s.link}>Tippe auf eine Uhrzeit oder füge hier etwas hinzu</Text>
      </Pressable>
      {event && <EventSheet event={event} close={() => setEvent(null)} />}
      {calEvent && <CalEventSheet event={calEvent} close={() => setCalEvent(null)} />}
      {travel?.leg && (
        <Sheet
          title={travel.title}
          subtitle={"Losgehen " + clock(travel.start) + " · Ankunft " + clock(travel.end)}
          close={() => setTravel(null)}
          footer={
            <>
              <Button
                quiet
                onPress={() => {
                  setTravel(null);
                  router.push("/settings");
                }}
              >
                Orte & Wegzeiten
              </Button>
              <Button onPress={() => setTravel(null)}>OK</Button>
            </>
          }
        >
          <View style={s.row}>
            {travel.leg.mode === "walk" ? <Footprints size={16} color={travel.color} /> : <TrainFront size={16} color={travel.color} />}
            <Text style={s.body}>
              {placeName(state, travel.leg.from)} → {placeName(state, travel.leg.to)} · {travel.leg.minutes} Min. {modeLabel[travel.leg.mode]}
            </Text>
          </View>
          {travel.leg.target ? <Text style={s.muted}>Für: {travel.leg.target} (mit {state.transport.buffer} Min. Puffer)</Text> : null}
          {travel.leg.estimated && (
            <Text style={[s.micro, { lineHeight: 17 }]}>Zwischen zwei Orten ist die Wegzeit geschätzt (die längere Zeit von zu Hause).</Text>
          )}
          {travel.leg.late > 0 && (
            <View style={[s.notice, { backgroundColor: "#3E2429" }]}>
              <Text style={[s.body, { color: "#F3A4A9", lineHeight: 21 }]}>
                ⚠ {travel.leg.late} Min. zu knapp: Der vorherige Termin endet zu spät. Verschiebe einen der Termine oder plane die Lücke anders.
              </Text>
            </View>
          )}
        </Sheet>
      )}
      {series && (
        <Sheet
          title="Wiederkehrende Aufgabe verschieben"
          subtitle={series.task.title + " → " + series.time + " Uhr"}
          close={() => setSeries(null)}
          footer={<Button quiet onPress={() => setSeries(null)}>Abbrechen</Button>}
        >
          <Button
            onPress={() => {
              moveTask(series.task, series.time, true);
              setSeries(null);
            }}
          >
            Nur am {parseDate(day).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}
          </Button>
          <Button
            quiet
            onPress={() => {
              moveTask(series.task, series.time, false);
              setSeries(null);
            }}
          >
            Ganze Serie auf {series.time} Uhr
          </Button>
        </Sheet>
      )}
    </View>
  );
}

function CalEventSheet({ event, close }: { event: CalEvent; close: () => void }) {
  const { state } = usePlanner();
  const cal = state.calendars.find((c) => c.id === event.calId);
  return (
    <Sheet
      title={event.title}
      subtitle={
        parseDate(event.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) +
        (event.allDay ? " · ganztägig" : " · " + event.start + "–" + event.end)
      }
      close={close}
      footer={<Button onPress={close}>Schließen</Button>}
    >
      {event.location ? (
        <View style={s.row}>
          <MapPin size={16} color={cal?.color || C.green} />
          <Text style={[s.body, { flex: 1 }]}>{event.location}</Text>
        </View>
      ) : null}
      {event.note ? <Text style={[s.body, { color: C.muted, lineHeight: 21 }]}>{event.note}</Text> : null}
      <View style={s.row}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cal?.color || C.green }} />
        <Text style={s.micro}>Aus deinem Kalender-Abo „{cal?.name}“. Änderungen machst du im Original-Kalender.</Text>
      </View>
    </Sheet>
  );
}

function EventSheet({ event, close }: { event: UniEvent; close: () => void }) {
  const { state, update } = usePlanner();
  const exists = state.exams.some((e) => e.title === event.title && e.date === event.date);
  return (
    <Sheet
      title={event.title}
      subtitle={
        parseDate(event.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) +
        " · " + event.start + "–" + event.end
      }
      close={close}
      footer={
        <>
          {!exists && (
            <Button
              quiet
              icon={Flag}
              onPress={() => {
                update((prev) => ({
                  ...prev,
                  exams: [
                    ...prev.exams,
                    {
                      id: "exam-" + Date.now(),
                      title: event.title.replace(/^klausur(:|\s-)?\s*/i, ""),
                      kind: "exam",
                      date: event.date,
                      time: event.start,
                      hours: 20,
                      topics: [],
                      note: event.rooms.join(", "),
                    },
                  ],
                }));
                close();
                router.push("/study" as "/");
              }}
            >
              Als Prüfung vorbereiten
            </Button>
          )}
          <Button onPress={close}>Schließen</Button>
        </>
      }
    >
      {event.rooms.length > 0 && (
        <View style={s.row}>
          <MapPin size={16} color="#B9A2F2" />
          <Text style={s.body}>{event.rooms.join(", ")}</Text>
        </View>
      )}
      {event.persons.length > 0 && (
        <View style={s.row}>
          <User size={16} color="#B9A2F2" />
          <Text style={s.body}>{event.persons.join(", ")}</Text>
        </View>
      )}
      <Text style={[s.micro, { lineHeight: 18 }]}>
        Aus deinem Rapla-Stundenplan. Änderungen machst du in Rapla – Hap lädt den Plan automatisch neu.
      </Text>
    </Sheet>
  );
}
