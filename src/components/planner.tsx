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
import { usePlanner } from "@/lib/store";
import { agenda } from "@/lib/agenda";
import { hoursLabel, studyStreak } from "@/lib/study";
import { trainingStreak, weekSummary } from "@/lib/training";
import { DayTimeline } from "./day-timeline";
import { TimePicture, weekTime } from "./charts";
import { Button, C, Heading, Shell, useEditor, useToday, s } from "./planner-ui";
export { MealsScreen, SettingsScreen } from "./planner-meals";

function CalendarContent() {
  const { state } = usePlanner();
  const today = useToday();
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
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
  return (
    <>
      <View style={[s.card, { padding: width < 680 ? 12 : 26 }]}>
        <View style={[s.sectionHeading, { marginBottom: 25 }]}>
          <Text style={s.h2}>
            {parseDate(first).toLocaleDateString("de-DE", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMonth(today.slice(0, 7));
                setDay(today);
              }}
              style={s.filter}
            >
              <Text style={s.link}>Heute</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vorheriger Monat"
              onPress={() => move(-1)}
              style={s.arrow}
            >
              <ChevronLeft size={20} color={C.green} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nächster Monat"
              onPress={() => move(1)}
              style={s.arrow}
            >
              <ChevronRight size={20} color={C.green} />
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: "row" }}>
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <Text key={d} style={[s.calendarWeekLabel, { width: "14.2857%" }]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={s.calendarGrid}>
          {Array.from({ length: count }, (_, i) => shiftDay(start, i)).map(
            (d) => {
              const items = agenda(state, d),
                // Travel blocks only belong in the day view.
                tasks = [...items.allDay, ...items.timed.filter((i) => i.kind !== "travel")],
                p = progress(state, d);
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={
                    parseDate(d).toLocaleDateString("de-DE") +
                    ", " +
                    tasks.length +
                    " Aufgaben"
                  }
                  onPress={() => {
                    setDay(d);
                    setMonth(d.slice(0, 7));
                  }}
                  style={[
                    s.calendarCell,
                    width < 680 && { minHeight: 66, padding: 6 },
                    d === day && { backgroundColor: C.pale },
                    d.slice(0, 7) !== month && { opacity: 0.38 },
                  ]}
                >
                  <View
                    style={[
                      s.calendarNumber,
                      d === today && { backgroundColor: C.button },
                    ]}
                  >
                    <Text
                      style={{
                        color: d === today ? "white" : C.ink,
                        fontWeight: d === day || d === today ? "700" : "400",
                      }}
                    >
                      {parseDate(d).getDate()}
                    </Text>
                  </View>
                  {width >= 680 ? (
                    tasks.slice(0, 3).map((t) => (
                      <View
                        key={t.key}
                        style={[s.calendarTask, { backgroundColor: t.pale }]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ color: t.color, fontSize: 10 }}
                        >
                          {t.done ? "✓ " : ""}
                          {t.start || t.end
                            ? String(Math.floor(t.start / 60)).padStart(2, "0") +
                              ":" +
                              String(t.start % 60).padStart(2, "0") +
                              " "
                            : ""}
                          {t.title}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={[s.row, { gap: 3, marginTop: 5 }]}>
                      {Array.from(new Set(tasks.map((t) => t.color)))
                        .slice(0, 4)
                        .map((c) => (
                          <View
                            key={c}
                            style={[s.dayDot, { backgroundColor: c }]}
                          />
                        ))}
                    </View>
                  )}
                  {width >= 680 && tasks.length > 3 && (
                    <Text style={[s.micro, { fontSize: 9 }]}>
                      +{tasks.length - 3} weitere
                    </Text>
                  )}
                  {p.perfect && (
                    <Check
                      size={12}
                      color={C.green}
                      style={{ position: "absolute", right: 6, top: 8 }}
                    />
                  )}
                </Pressable>
              );
            },
          )}
        </View>
      </View>
      <View style={[s.sectionHeading, { marginTop: 28 }]}>
        <Text style={[s.h2, { flex: 1 }]}>
          {parseDate(day).toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
        <Button quiet icon={Plus} onPress={() => edit(day)}>
          Planen
        </Button>
      </View>
      <View style={{ marginTop: 16 }}>
        <DayTimeline day={day} />
      </View>
    </>
  );
}
export function CalendarScreen() {
  return (
    <Shell
      title="Dein Kalender"
      subtitle="Deine Woche bekommt einen klaren Rhythmus."
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

