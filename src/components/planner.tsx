import { useState } from "react";
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
} from "react-native";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Trophy,
} from "lucide-react-native";
import {
  categories,
  monday,
  occurrenceKey,
  parseDate,
  progress,
  shiftDay,
  streak,
  tasksFor,
  dateKey,
} from "@/lib/planner";
import { usePlanner } from "@/lib/store";
import {
  Button,
  C,
  DaySide,
  Heading,
  Pill,
  Shell,
  TaskList,
  useEditor,
  useToday,
  WeekStrip,
  s,
} from "./planner-ui";
export { MealsScreen, SettingsScreen } from "./planner-meals";

function TodayContent() {
  const { state } = usePlanner();
  const today = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected || today;
  const p = progress(state, day);
  const { width } = useWindowDimensions();
  const side = width >= 1180;
  const greeting =
    new Date().getHours() < 11
      ? "Guten Morgen"
      : new Date().getHours() < 18
        ? "Hallo"
        : "Guten Abend";
  return (
    <>
      <View style={[s.hero, width < 680 && { padding: 24 }]}>
        <View style={{ flex: 1 }}>
          <View style={s.heroBadge}>
            <Sun size={13} color={C.lime} />
            <Text style={{ color: "#EBC2CC", fontSize: 10, letterSpacing: 1 }}>
              EIN GUTER TAG BEGINNT HIER
            </Text>
          </View>
          <Text style={[s.heroTitle, width < 680 && { fontSize: 25 }]}>
            {greeting}
            {state.name ? ", " + state.name : ""}.{"\n"}Mach heute zu deinem
            Tag.
          </Text>
          <Text style={s.heroText}>
            Ein Schritt nach dem anderen. Du hast das.
          </Text>
          <View style={[s.row, { marginTop: 22, gap: 16 }]}>
            <View style={s.row}>
              <Flame size={16} color={C.lime} />
              <Text style={s.heroSmall}>
                {streak(state, today)} Tage in Folge
              </Text>
            </View>
            <View
              style={{ height: 14, width: 1, backgroundColor: "#7F4553" }}
            />
            <Text style={s.heroSmall}>
              {progress(state, today).done * 20} XP heute
            </Text>
          </View>
        </View>
      </View>
      <View style={[s.columns, !side && { flexDirection: "column" }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[s.sectionHeading, { marginBottom: 15 }]}>
            <View style={s.row}>
              <Text style={s.h2}>
                {parseDate(day).toLocaleDateString("de-DE", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Pill>
                {day === today
                  ? "Heute"
                  : parseDate(day).toLocaleDateString("de-DE", {
                      day: "numeric",
                      month: "numeric",
                    })}
              </Pill>
            </View>
            {day !== today && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelected(null)}
              >
                <Text style={s.link}>Zu heute</Text>
              </Pressable>
            )}
          </View>
          <WeekStrip day={day} select={setSelected} />
          {p.perfect && (
            <View style={s.celebration}>
              <CheckCheck size={21} color={C.green} />
              <Text style={{ color: C.green, flex: 1, fontWeight: "600" }}>
                {p.done}/{p.total} – Tagesziel erreicht! +{p.done * 20} XP
              </Text>
              <Sparkles size={20} color="#E4B19B" />
            </View>
          )}
          <TaskList day={day} />
          <View style={s.footerNote}>
            <ShieldCheck size={13} color={C.muted} />
            <Text style={s.micro}>
              Deine Änderungen bleiben auf diesem Gerät gespeichert.
            </Text>
          </View>
        </View>
        <View style={{ width: side ? 290 : "100%" }}>
          <DaySide day={day} />
        </View>
      </View>
    </>
  );
}
export function TodayScreen() {
  return (
    <Shell
      title="Dein Tag im Überblick"
      subtitle="Weniger im Kopf. Mehr Raum fürs Leben."
    >
      <TodayContent />
    </Shell>
  );
}
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
              const tasks = tasksFor(state, d),
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
                    tasks.slice(0, 2).map((t) => (
                      <View
                        key={t.id}
                        style={[
                          s.calendarTask,
                          { backgroundColor: categories[t.category].pale },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: categories[t.category].color,
                            fontSize: 10,
                          }}
                        >
                          {state.done[occurrenceKey(t, d)] ? "✓ " : ""}
                          {t.time} {t.title}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={[s.row, { gap: 3, marginTop: 5 }]}>
                      {Array.from(new Set(tasks.map((t) => t.category))).map(
                        (c) => (
                          <View
                            key={c}
                            style={[
                              s.dayDot,
                              { backgroundColor: categories[c].color },
                            ]}
                          />
                        ),
                      )}
                    </View>
                  )}
                  {width >= 680 && tasks.length > 2 && (
                    <Text style={[s.micro, { fontSize: 9 }]}>
                      +{tasks.length - 2} weitere
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
      <TaskList day={day} />
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
  const xp = completed * 20;
  const level = Math.floor(xp / 200) + 1;
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
        ].map((item) => (
          <View key={item.label} style={[s.card, s.statCard]}>
            <item.icon size={24} color={C.green} />
            <Text style={s.statValue}>{item.value}</Text>
            <Text style={s.eyebrow}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={[s.card, { padding: 27, marginTop: 24 }]}>
        <Heading detail={String(xp % 200) + "/200 XP bis Level " + (level + 1)}>
          Du wächst mit jedem Tag
        </Heading>
        <View style={s.progressTrack}>
          <View
            style={{
              width: ((xp % 200) / 2 + "%") as DimensionValue,
              height: "100%",
              backgroundColor: C.green,
              borderRadius: 9,
            }}
          />
        </View>
        <Text style={[s.muted, { marginTop: 12 }]}>
          Jede erledigte Aufgabe bringt 20 XP. Ein Häkchen zurücknehmen zieht
          die XP wieder ab.
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

