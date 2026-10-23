import { useState } from "react";
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
} from "react-native";
import {
  Brain,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FileUp,
  Flame,
  Plus,
  Sparkles,
  Sprout,
  Trophy,
} from "lucide-react-native";
import {
  dateKey,
  dayXp,
  levelFor,
  monday,
  occurrenceKey,
  parseDate,
  progress,
  shiftDay,
  streak,
  tasksFor,
  totalXp,
} from "@/lib/planner";
import { router } from "expo-router";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { agenda } from "@/lib/agenda";
import { hoursLabel, studyStreak } from "@/lib/study";
import { trainingStreak, weekSummary } from "@/lib/training";
import { DayTimeline } from "./day-timeline";
import { IcsImportSheet } from "./ics-import";
import { TimePicture, weekTime } from "./charts";
import { Button, C, Heading, Shell, useEditor, useToday, s } from "./planner-ui";
export { MealsScreen, SettingsScreen } from "./planner-meals";

function CalendarContent() {
  const { state } = usePlanner();
  const today = useToday();
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [importing, setImporting] = useState(false);
  const edit = useEditor();
  const { width } = useWindowDimensions();
  const first = month + "-01",
    start = monday(first);
  const last = new Date(
    parseDate(first).getFullYear(),
    parseDate(first).getMonth() + 1,
    0,
  ).getDate();
  const count =
    Math.ceil((((parseDate(first).getDay() + 6) % 7) + last) / 7) * 7;
  function move(n: number) {
    const d = parseDate(first);
    d.setMonth(d.getMonth() + n);
    setMonth(dateKey(d).slice(0, 7));
  }
  const square = { width: 40, height: 40, borderRadius: 12, backgroundColor: "#17171B", alignItems: "center", justifyContent: "center" } as const;
  const wideCells = width >= 680;
  return (
    <>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Pressable accessibilityRole="link" accessibilityLabel="Zurück zu Heute" onPress={() => router.push("/")} style={square}>
          <ChevronLeft size={18} color={C.ink} />
        </Pressable>
        <View style={[s.row, { gap: 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel=".ics-Datei importieren" onPress={() => setImporting(true)} style={square}>
            <FileUp size={17} color={C.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMonth(today.slice(0, 7));
              setDay(today);
            }}
            style={[square, { width: "auto", paddingHorizontal: 14 }]}
          >
            <Text style={{ color: C.ink, fontWeight: "600", fontSize: 14 }}>Heute</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Vorheriger Monat" onPress={() => move(-1)} style={square}>
            <ChevronLeft size={16} color={C.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Nächster Monat" onPress={() => move(1)} style={square}>
            <ChevronRight size={16} color={C.ink} />
          </Pressable>
        </View>
      </View>
      <Text style={[s.h1, { marginTop: 16, marginBottom: 18 }]}>
        {parseDate(first).toLocaleDateString("de-DE", { month: "long" })}
        <Text style={{ color: "#5A5862" }}> {first.slice(0, 4)}</Text>
      </Text>
      <View style={{ flexDirection: "row" }}>
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <Text key={d} style={{ width: "14.2857%", textAlign: "center", color: "#6F6D76", fontSize: 12, paddingBottom: 8 }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 4 }}>
        {Array.from({ length: count }, (_, i) => shiftDay(start, i)).map((d) => {
          const items = agenda(state, d),
            // Travel blocks only belong in the day view.
            tasks = [...items.allDay, ...items.timed.filter((i) => i.kind !== "travel")],
            p = progress(state, d);
          const selected = d === day;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={parseDate(d).toLocaleDateString("de-DE") + ", " + tasks.length + " Termine"}
              onPress={() => {
                tap();
                setDay(d);
                setMonth(d.slice(0, 7));
              }}
              style={{ width: "14.2857%", paddingHorizontal: 2, opacity: d.slice(0, 7) !== month ? 0.3 : 1 }}
            >
              <View
                style={{
                  minHeight: wideCells ? 96 : 52,
                  borderRadius: 14,
                  backgroundColor: selected ? C.green : "transparent",
                  borderWidth: d === today && !selected ? 1.5 : 0,
                  borderColor: C.green,
                  alignItems: wideCells ? "stretch" : "center",
                  justifyContent: wideCells ? "flex-start" : "center",
                  padding: wideCells ? 8 : 0,
                  gap: 5,
                }}
              >
                <Text style={{ color: selected ? C.onAccent : C.ink, fontWeight: selected || d === today ? "800" : "500", fontSize: 16, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                  {parseDate(d).getDate()}
                </Text>
                {wideCells ? (
                  tasks.slice(0, 3).map((t) => (
                    <Text key={t.key} numberOfLines={1} style={{ color: selected ? C.onAccent : t.color, fontSize: 11 }}>
                      {t.done ? "✓ " : ""}
                      {t.title}
                    </Text>
                  ))
                ) : (
                  <View style={[s.row, { gap: 3, height: 5 }]}>
                    {Array.from(new Set(tasks.map((t) => t.color)))
                      .slice(0, 3)
                      .map((c) => (
                        <View key={c} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected ? C.onAccent : c }} />
                      ))}
                  </View>
                )}
                {p.perfect && !wideCells && !tasks.length ? <Check size={10} color={C.green} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.sectionHeading, { marginTop: 24 }]}>
        <Text style={[s.eyebrow, { flex: 1 }]}>
          {parseDate(day).toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).toUpperCase()}
        </Text>
        <Button quiet icon={Plus} onPress={() => edit(day)}>
          Planen
        </Button>
      </View>
      <View style={{ marginTop: 16 }}>
        <DayTimeline day={day} />
      </View>
      {importing && <IcsImportSheet close={() => setImporting(false)} />}
    </>
  );
}
export function CalendarScreen() {
  return (
    <Shell
      title="Dein Kalender"
      subtitle="Deine Woche bekommt einen klaren Rhythmus."
      header={false}
    >
      <CalendarContent />
    </Shell>
  );
}
export function ProgressScreen() {
  const { state } = usePlanner();
  const today = useToday();
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday(today), i));
  const completed = Object.entries(state.done).filter(
    ([key, value]) =>
      value &&
      key.slice(-10) <= today &&
      tasksFor(state, key.slice(-10)).some(
        (t) => occurrenceKey(t, key.slice(-10)) === key,
      ),
  ).length;
  const xp = totalXp(state, today);
  const lvl = levelFor(xp);
  const level = lvl.level;
  const week = weekTime(state, today);
  const weekFocus = week.reduce((n, d) => n + d.focus, 0);
  const weekUni = week.reduce((n, d) => n + d.uni, 0);
  const training = weekSummary(state, today);
  return (
    <Shell
      title="Kleine Schritte zählen"
      subtitle="Schau, was du dir schon aufgebaut hast."
    >
      <View style={s.statsGrid}>
        {[
          { label: "DEIN LEVEL", value: String(level), icon: Sprout },
          { label: "GESAMMELTE XP", value: String(xp), icon: Sparkles },
          {
            label: "TAGE IN FOLGE",
            value: String(streak(state, today)),
            icon: Flame,
          },
          {
            label: "ERLEDIGTE AUFGABEN",
            value: String(completed),
            icon: CheckCheck,
          },
          {
            label: "LERNSERIE (TAGE)",
            value: String(studyStreak(state, today)),
            icon: Brain,
          },
          {
            label: "TRAININGS-WOCHEN",
            value: String(trainingStreak(state, today)),
            icon: Dumbbell,
          },
        ].map((item) => (
          <View key={item.label} style={[s.card, s.statCard]}>
            <item.icon size={24} color={C.green} />
            <Text style={s.statValue}>{item.value}</Text>
            <Text style={s.eyebrow}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={[s.card, { padding: 27, marginTop: 24 }]}>
        <Heading
          detail={lvl.into + "/" + lvl.need + " XP bis Level " + (level + 1)}
        >
          Du wächst mit jedem Tag
        </Heading>
        <View style={s.progressTrack}>
          <View
            style={{
              width: ((lvl.into / lvl.need) * 100 + "%") as DimensionValue,
              height: "100%",
              backgroundColor: C.green,
              borderRadius: 9,
            }}
          />
        </View>
        <Text style={[s.muted, { marginTop: 12 }]}>
          Aufgaben bringen 10–60 XP je nach Dauer, jede Fokusminute 1 XP, jedes
          Training 60 XP. Heute: +{dayXp(state, today)} XP.
        </Text>
      </View>
      <View style={[s.card, { padding: 27, marginTop: 24 }]}>
        <Heading>Deine Woche</Heading>
        <View
          style={[s.row, { alignItems: "flex-end", gap: 12, marginTop: 30 }]}
        >
          {days.map((d) => {
            const p = progress(state, d);
            return (
              <View key={d} style={{ flex: 1, alignItems: "center", gap: 12 }}>
                <Text style={s.micro}>
                  {p.done}/{p.total}
                </Text>
                <View
                  style={{
                    width: "100%",
                    height: 130,
                    justifyContent: "flex-end",
                    backgroundColor: C.pale,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: ((p.total ? (p.done / p.total) * 100 : 0) +
                        "%") as DimensionValue,
                      backgroundColor: p.perfect ? "#C77484" : C.green,
                    }}
                  />
                </View>
                <Text
                  style={[
                    s.micro,
                    d === today && { color: C.green, fontWeight: "700" },
                  ]}
                >
                  {parseDate(d).toLocaleDateString("de-DE", {
                    weekday: "short",
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={[s.card, { padding: 27, marginTop: 24, gap: 14 }]}>
        <Heading detail="Montag bis Sonntag">Wochenrückblick</Heading>
        <Text style={[s.body, { color: C.muted, lineHeight: 22 }]}>
          {hoursLabel(weekUni)} Vorlesung · {hoursLabel(weekFocus)} Fokuszeit ·{" "}
          {training.done}/{training.planned} Trainings
          {weekFocus < 300
            ? ". Tipp: Plane zwei feste Fokusblöcke pro Tag zwischen den Vorlesungen."
            : ". Starke Woche – weiter so!"}
        </Text>
        <TimePicture state={state} today={today} />
      </View>
      <View style={[s.gentleCard, { marginTop: 24 }]}>
        <Trophy size={28} color="#D5AD83" />
        <Text style={[s.h3, { marginTop: 14 }]}>
          Beständigkeit schlägt Perfektion.
        </Text>
        <Text style={[s.body, { color: C.muted, marginTop: 9 }]}>
          Ein voller Tag zählt zur Serie. Ein freier Tag ist trotzdem ein guter
          Tag.
        </Text>
      </View>
    </Shell>
  );
}

