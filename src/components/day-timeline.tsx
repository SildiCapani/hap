import { useEffect, useState } from "react";
import { Pressable, Text, View, type DimensionValue } from "react-native";
import { router } from "expo-router";
import {
  CalendarDays,
  Check,
  Dumbbell,
  Flag,
  GraduationCap,
  MapPin,
  Plus,
  User,
} from "lucide-react-native";
import { occurrenceKey, parseDate } from "@/lib/planner";
import { agenda, layout, type AgendaItem } from "@/lib/agenda";
import { clock } from "@/lib/study";
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

export function DayTimeline({ day, compact = false }: { day: string; compact?: boolean }) {
  const { state, update } = usePlanner();
  const edit = useEditor();
  const today = useToday();
  const now = useNow();
  const [event, setEvent] = useState<UniEvent | null>(null);
  const [calEvent, setCalEvent] = useState<CalEvent | null>(null);
  const [expanded, setExpanded] = useState(false);
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
  const last = Math.max(
    22,
    ...timed.map((i) => Math.ceil(Math.max(i.end, i.start + 30) / 60)),
  );
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (mins: number) => ((mins - first * 60) / 60) * HOUR;
  function open(item: AgendaItem) {
    tap();
    if (item.kind === "task") edit(day, item.task);
    else if (item.kind === "uni" && item.event) setEvent(item.event);
    else if (item.kind === "cal" && item.cal) setCalEvent(item.cal);
    else if (item.kind === "training") router.push("/training" as "/");
    else router.push("/study" as "/");
  }
  function toggle(item: AgendaItem) {
    if (!item.task) return;
    const key = occurrenceKey(item.task, day);
    tap(item.done ? "light" : "success");
    update((prev) => ({ ...prev, done: { ...prev.done, [key]: !prev.done[key] } }));
  }
  return (
    <View style={[s.card, { paddingVertical: 14 }]}>
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
              backgroundColor: pressed ? "#22232A" : "transparent",
            })}
          >
            <Text style={{ width: GUTTER, textAlign: "right", paddingRight: 10, color: "#77737F", fontSize: 10, marginTop: -6 }}>
              {String(h).padStart(2, "0")}:00
            </Text>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: "#2A2B32" }}>
              <View style={{ position: "absolute", top: HOUR / 2, left: 0, right: 0, borderTopWidth: 1, borderTopColor: "#1F2026" }} />
            </View>
          </Pressable>
        ))}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: GUTTER + 4, right: 10 }}>
          {layout(timed).map(({ item, col, cols }) => {
            const start = Math.max(item.start, first * 60);
            const height = Math.max(26, top(Math.max(item.end, start + 26)) - top(start) - 2);
            const compact = height < 46;
            const past = day < today || (day === today && item.end <= nowMin);
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={clock(item.start) + " " + item.title}
                onPress={() => open(item)}
                style={({ pressed }) => ({
                  position: "absolute",
                  top: top(start) + 1,
                  height,
                  left: ((col / cols) * 100 + "%") as DimensionValue,
                  width: ((100 / cols) + "%") as DimensionValue,
                  paddingRight: 3,
                  opacity: item.done ? 0.5 : past ? 0.72 : pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: item.pale,
                    borderRadius: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: item.color,
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
                        fontSize: 12,
                        fontWeight: "600",
                        textDecorationLine: item.done ? "line-through" : "none",
                      }}
                    >
                      {compact ? clock(item.start) + "  " : ""}
                      {item.title}
                    </Text>
                    {!compact && (
                      <View style={[s.row, { gap: 5, marginTop: 3 }]}>
                        {item.kind === "cal" ? (
                          <CalendarDays size={11} color={item.color} />
                        ) : item.kind === "uni" ? (
                          <GraduationCap size={11} color={item.color} />
                        ) : item.kind === "training" ? (
                          <Dumbbell size={11} color={item.color} />
                        ) : item.task ? (
                          <Icon name={item.task.icon} size={11} color={item.color} />
                        ) : null}
                        <Text numberOfLines={1} style={{ color: item.color, fontSize: 10, flex: 1 }}>
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
              </Pressable>
            );
          })}
        </View>
        {day === today && nowMin >= first * 60 && nowMin <= last * 60 && (
          <View pointerEvents="none" style={{ position: "absolute", top: top(nowMin) - 1, left: GUTTER - 6, right: 0, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#FF5A6A" }} />
            <View style={{ flex: 1, height: 2, backgroundColor: "#FF5A6A" }} />
          </View>
        )}
      </View>
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
