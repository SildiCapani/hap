import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import {
  ArrowRight,
  Brain,
  CalendarClock,
  CheckCheck,
  Dumbbell,
  Flag,
  LayoutList,
  Play,
  Rows3,
  Send,
  Sparkles,
} from "lucide-react-native";
import {
  categories,
  dayXp,
  levelFor,
  newId,
  occurrenceKey,
  parseDate,
  progress,
  repeats,
  streak,
  totalXp,
} from "@/lib/planner";
import { nextUp } from "@/lib/agenda";
import { parseQuick } from "@/lib/quickadd";
import { clock, examKinds, focusPick, hoursLabel, studyStreak, suggestBlock, upcomingExams } from "@/lib/study";
import { loggedOn, workoutsFor } from "@/lib/training";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Bar } from "./charts";
import { DayTimeline, useNow } from "./day-timeline";
import { Button, C, Pill, Shell, TaskList, useToday, WeekStrip, s } from "./planner-ui";

function Pulse({ color }: { color: string }) {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(1.8, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
  }, [v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: v.value }], opacity: 2 - v.value }));
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: color }, style]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

function until(mins: number) {
  if (mins < 60) return "in " + mins + " Min.";
  const h = Math.floor(mins / 60), m = mins % 60;
  return "in " + h + " h" + (m ? " " + m + " Min." : "");
}

function NowCard() {
  const { state, update } = usePlanner();
  const today = useToday();
  const now = useNow(15000);
  const mins = now.getHours() * 60 + now.getMinutes();
  const { current, next } = nextUp(state, today, mins);
  const level = levelFor(totalXp(state, today));
  const greeting = now.getHours() < 11 ? "Guten Morgen" : now.getHours() < 18 ? "Hey" : "Guten Abend";
  const { width } = useWindowDimensions();
  const mobile = width < 680;
  const main = current || next;
  const after = current ? next : nextUp(state, today, (next?.start ?? 0) + 1).next;
  const deadlines = upcomingExams(state, today).slice(0, 2);
  const p = progress(state, today);
  function act(item: NonNullable<typeof main>) {
    tap();
    if (item.kind === "training") router.push("/training" as "/");
    else if (item.kind === "exam") router.push("/study" as "/");
    else if (item.kind === "task" && item.task?.category === "uni" && item.task.icon === "brain") router.push("/focus" as "/");
  }
  return (
    <View style={{ gap: 14, marginBottom: 18 }}>
      <View style={[s.row, { justifyContent: "space-between", flexWrap: "wrap", gap: 10 }]}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={{ color: C.ink, fontSize: mobile ? 22 : 26, fontWeight: "700", letterSpacing: -0.6 }}>
            {greeting}
            {state.name ? ", " + state.name : ""}
          </Text>
          <Text style={[s.muted, { marginTop: 3 }]}>
            {parseDate(today).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </View>
        <View style={[s.row, { gap: 6 }]}>
          <Pill bg="#2A2B32" color="#FFD0D5">
            ✓ {p.done}/{p.total}
          </Pill>
          <Pill bg="#2A2B32" color="#FFD0D5">
            🔥 {Math.max(streak(state, today), studyStreak(state, today))}
          </Pill>
          <Pill bg="#2A2B32" color="#FFD0D5">
            Lv {level.level} · +{dayXp(state, today)}
          </Pill>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!main}
        onPress={() => main && act(main)}
        style={[s.hero, { marginBottom: 0, padding: mobile ? 20 : 26, flexDirection: "column", alignItems: "stretch", gap: 0 }]}
      >
        <View style={s.row}>
          {current ? <Pulse color="#FF5A6A" /> : <CalendarClock size={14} color="#FFB3BC" />}
          <Text style={{ color: "#FFB3BC", fontSize: 11, letterSpacing: 1.4, fontWeight: "800" }}>
            {current ? "JETZT" : main ? "ALS NÄCHSTES" : "HEUTE"}
          </Text>
          {main && (
            <Text style={{ marginLeft: "auto", color: "#FFE4E8", fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {current ? "noch " + (current.end - mins) + " Min." : until(main.start - mins)}
            </Text>
          )}
        </View>
        {main ? (
          <>
            <Text style={{ color: "white", fontSize: mobile ? 22 : 26, fontWeight: "800", marginTop: 10, letterSpacing: -0.5 }} numberOfLines={2}>
              {main.title}
            </Text>
            <Text style={{ color: "#E9C3CC", fontSize: 13, marginTop: 6 }} numberOfLines={1}>
              {clock(main.start)}–{clock(main.end)} · {main.sub}
            </Text>
            {current && (
              <View style={{ marginTop: 14 }}>
                <Bar value={(mins - current.start) / Math.max(1, current.end - current.start)} color="#FF8A96" height={6} />
              </View>
            )}
            {current?.kind === "task" && current.task && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const key = occurrenceKey(current.task!, today);
                  tap("success");
                  update((prev) => ({ ...prev, done: { ...prev.done, [key]: true } }));
                }}
                style={[s.row, { marginTop: 14, alignSelf: "flex-start", backgroundColor: "#00000033", paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10 }]}
              >
                <CheckCheck size={15} color="#FFE4E8" />
                <Text style={{ color: "#FFE4E8", fontWeight: "700", fontSize: 12 }}>Erledigt</Text>
              </Pressable>
            )}
            {after && (
              <Text style={[s.micro, { color: "#D9A9B5", marginTop: 14 }]} numberOfLines={1}>
                Danach: {clock(after.start)} {after.title}
              </Text>
            )}
          </>
        ) : (
          <Text style={{ color: "white", fontSize: 20, fontWeight: "700", marginTop: 10 }}>
            Nichts mehr geplant. Freizeit 🎮
          </Text>
        )}
      </Pressable>
      {deadlines.length > 0 && (
        <View style={[s.wrap, { gap: 6 }]}>
          {deadlines.map((d) => (
            <Pressable key={d.exam.id} onPress={() => router.push("/study" as "/")} style={[s.row, { backgroundColor: "#22232A", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, gap: 6 }]}>
              <Flag size={12} color={examKinds[d.exam.kind].color} />
              <Text style={{ color: C.ink, fontSize: 11, fontWeight: "600" }}>{d.exam.title}</Text>
              <Text style={{ color: examKinds[d.exam.kind].color, fontSize: 11 }}>in {d.days} T.</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// The two or three things worth doing right now, one tap each.
function QuickActions() {
  const { state, update } = usePlanner();
  const today = useToday();
  const now = useNow();
  const mins = now.getHours() * 60 + now.getMinutes();
  const pick = focusPick(state, today);
  const need = pick ? Math.max(0, pick.perDay - pick.today) : 0;
  const block = pick && need ? suggestBlock(state, today, need, mins) : null;
  const workout = workoutsFor(state, today).find((w) => !loggedOn(state, w.id, today));
  const actions: { key: string; icon: typeof Play; label: string; sub: string; color: string; onPress: () => void }[] = [];
  if (!state.activeFocus)
    actions.push({
      key: "focus",
      icon: Play,
      label: pick ? "Fokus: " + pick.exam.title : "Fokusrunde",
      sub: pick ? hoursLabel(need) + " offen heute" : "25–90 Min. konzentriert",
      color: "#F07B83",
      onPress: () => router.push((pick ? "/focus?exam=" + pick.exam.id : "/focus") as "/"),
    });
  if (workout && !state.activeWorkout)
    actions.push({
      key: "workout",
      icon: Dumbbell,
      label: workout.name + " starten",
      sub: "geplant " + workout.time + " · " + workout.exercises.length + " Übungen",
      color: categories.sport.color,
      onPress: () => router.push("/training" as "/"),
    });
  if (pick && block)
    actions.push({
      key: "block",
      icon: CalendarClock,
      label: "Lernblock " + clock(block.start),
      sub: hoursLabel(block.length) + " " + pick.exam.title + " einplanen",
      color: "#B9A2F2",
      onPress: () => {
        tap("success");
        update((prev) => ({
          ...prev,
          tasks: [
            ...prev.tasks,
            {
              id: newId("task"),
              title: "Lernen: " + pick.exam.title,
              note: "Lernblock für " + examKinds[pick.exam.kind].label + " am " + parseDate(pick.exam.date).toLocaleDateString("de-DE"),
              date: today,
              time: clock(block.start),
              duration: block.length,
              category: "uni",
              icon: "brain",
              repeat: "none",
              skipped: [],
            },
          ],
        }));
      },
    });
  if (!state.exams.length)
    actions.push({
      key: "exam",
      icon: Brain,
      label: "Klausuren eintragen",
      sub: "Hap plant dein Lernpensum",
      color: "#B9A2F2",
      onPress: () => router.push("/study" as "/"),
    });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} style={{ marginBottom: 16, flexGrow: 0 }}>
      {actions.map((a, i) => (
        <Animated.View key={a.key} entering={FadeInDown.delay(i * 60)}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              a.onPress();
            }}
            style={({ pressed }) => [s.card, { padding: 14, width: 210, gap: 6, opacity: pressed ? 0.8 : 1, borderColor: a.color + "55" }]}
          >
            <View style={[s.row, { gap: 8 }]}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: a.color + "26", alignItems: "center", justifyContent: "center" }}>
                <a.icon size={15} color={a.color} />
              </View>
              <Text numberOfLines={1} style={[s.h3, { flex: 1 }]}>
                {a.label}
              </Text>
            </View>
            <Text numberOfLines={1} style={s.micro}>
              {a.sub}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

export function QuickAdd({ day }: { day: string }) {
  const { update } = usePlanner();
  const today = useToday();
  const [text, setText] = useState("");
  const [flash, setFlash] = useState("");
  const draft = text.trim() ? parseQuick(text, day === today ? today : day) : null;
  function add() {
    if (!draft) return;
    tap("success");
    update((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { ...draft, id: newId("task"), note: "", skipped: [] }],
    }));
    setFlash("„" + draft.title + "“ eingeplant für " + parseDate(draft.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }) + " um " + draft.time);
    setText("");
    setTimeout(() => setFlash(""), 3500);
  }
  const cat = draft ? categories[draft.category] : null;
  return (
    <View style={[s.card, { padding: 14, marginBottom: 18 }]}>
      <View style={[s.row, { gap: 10 }]}>
        <Sparkles size={18} color={C.green} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder="Was steht an? z. B. „morgen 10 uhr DB lernen 2h“"
          placeholderTextColor="#7E7887"
          accessibilityLabel="Schnelleingabe"
          style={{ flex: 1, color: C.ink, fontSize: 14, paddingVertical: 8, minHeight: 38 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eintragen"
          disabled={!draft}
          onPress={add}
          style={{ backgroundColor: draft ? C.button : "#2A2B31", width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
        >
          <Send size={16} color="white" />
        </Pressable>
      </View>
      {draft && cat && (
        <Animated.View entering={FadeInDown.duration(200)} style={[s.wrap, { marginTop: 10, gap: 6 }]}>
          <Pill color={cat.color} bg={cat.pale}>{cat.label}</Pill>
          <Pill>{parseDate(draft.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}</Pill>
          <Pill>{draft.time}</Pill>
          <Pill>{hoursLabel(draft.duration)}</Pill>
          {draft.repeat !== "none" && <Pill>{repeats[draft.repeat]}</Pill>}
          <Text style={[s.micro, { alignSelf: "center" }]}>→ {draft.title}</Text>
        </Animated.View>
      )}
      {flash ? <Text style={[s.micro, { color: "#98C5A9", marginTop: 8 }]}>✓ {flash}</Text> : null}
    </View>
  );
}

export function StudyCard({ day }: { day: string }) {
  const { state, update } = usePlanner();
  const pick = focusPick(state, day);
  const now = useNow();
  const today = useToday();
  if (!pick)
    return (
      <View style={[s.card, { padding: 22, gap: 10 }]}>
        <View style={s.row}>
          <Brain size={18} color={C.green} />
          <Text style={s.h3}>Lernziel</Text>
        </View>
        <Text style={[s.muted, { lineHeight: 19 }]}>
          {state.exams.length ? "Für heute ist dein Lernpensum geschafft. 🔥" : "Leg deine Klausuren und Abgaben an – Hap rechnet dir aus, wie viel du täglich lernen solltest."}
        </Text>
        <Pressable onPress={() => router.push("/study" as "/")} style={s.row}>
          <Text style={s.link}>Zum Lernbereich</Text>
          <ArrowRight size={14} color={C.green} />
        </Pressable>
      </View>
    );
  const need = Math.max(0, pick.perDay - pick.today);
  const after = day === today ? now.getHours() * 60 + now.getMinutes() : 0;
  const block = suggestBlock(state, day, need, after);
  return (
    <View style={[s.card, { padding: 22, gap: 12 }]}>
      <View style={s.sectionHeading}>
        <View style={s.row}>
          <Brain size={18} color={C.green} />
          <Text style={s.h3}>Lernziel heute</Text>
        </View>
        <Pill>{examKinds[pick.exam.kind].label} in {pick.days} T.</Pill>
      </View>
      <Text style={{ color: C.ink, fontSize: 20, fontWeight: "700" }}>{hoursLabel(need)}</Text>
      <Text style={s.muted}>{pick.exam.title}</Text>
      <Bar value={pick.today / Math.max(1, pick.perDay)} />
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Button icon={Play} onPress={() => router.push(("/focus?exam=" + pick.exam.id) as "/")}>
          Fokus starten
        </Button>
        {block && (
          <Button
            quiet
            onPress={() => {
              tap("success");
              update((prev) => ({
                ...prev,
                tasks: [
                  ...prev.tasks,
                  {
                    id: newId("task"),
                    title: "Lernen: " + pick.exam.title,
                    note: "Lernblock für " + examKinds[pick.exam.kind].label + " am " + parseDate(pick.exam.date).toLocaleDateString("de-DE"),
                    date: day,
                    time: clock(block.start),
                    duration: block.length,
                    category: "uni",
                    icon: "brain",
                    repeat: "none",
                    skipped: [],
                  },
                ],
              }));
            }}
          >
            {clock(block.start)} einplanen
          </Button>
        )}
      </View>
    </View>
  );
}

function TrainingCard({ day }: { day: string }) {
  const { state } = usePlanner();
  const workouts = workoutsFor(state, day);
  return (
    <Pressable onPress={() => router.push("/training" as "/")} style={[s.card, { padding: 22, gap: 10 }]}>
      <View style={s.sectionHeading}>
        <View style={s.row}>
          <Dumbbell size={18} color={categories.sport.color} />
          <Text style={s.h3}>Training</Text>
        </View>
        <ArrowRight size={15} color={C.muted} />
      </View>
      {workouts.length ? (
        workouts.map((w) => (
          <View key={w.id} style={s.row}>
            <Text style={[s.body, { flex: 1, fontWeight: "600" }]}>
              {w.name} · {w.time}
            </Text>
            <Pill color={categories.sport.color} bg={categories.sport.pale}>
              {loggedOn(state, w.id, day) ? "Erledigt ✓" : w.exercises.length + " Übungen"}
            </Pill>
          </View>
        ))
      ) : (
        <Text style={[s.muted, { lineHeight: 19 }]}>
          {state.workouts.length ? "Heute ist Ruhetag. Regeneration ist Teil des Fortschritts." : "Wähle einen Trainingsplan – Hap trackt Sätze, Gewichte und sagt dir, wann du steigern kannst."}
        </Text>
      )}
    </Pressable>
  );
}

function TodayContent() {
  const today = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"timeline" | "list">("timeline");
  const day = selected || today;
  const { width } = useWindowDimensions();
  const side = width >= 1180;
  return (
    <View style={[s.columns, !side && { flexDirection: "column", gap: 0 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <NowCard />
        <QuickActions />
        <QuickAdd day={day} />
        <View style={[s.sectionHeading, { marginBottom: 12 }]}>
          <View style={s.row}>
            <Text style={s.h2}>
              {day === today ? "Dein Zeitplan" : parseDate(day).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          </View>
          <View style={s.row}>
            {day !== today && (
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)}>
                <Text style={s.link}>Zu heute</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === "timeline" ? "Als Liste anzeigen" : "Als Zeitplan anzeigen"}
              onPress={() => setMode(mode === "timeline" ? "list" : "timeline")}
              style={s.filter}
            >
              {mode === "timeline" ? <LayoutList size={14} color={C.green} /> : <Rows3 size={14} color={C.green} />}
              <Text style={s.link}>{mode === "timeline" ? "Liste" : "Zeitplan"}</Text>
            </Pressable>
          </View>
        </View>
        <WeekStrip day={day} select={setSelected} />
        <View style={{ marginTop: 14 }}>{mode === "timeline" ? <DayTimeline day={day} compact /> : <TaskList day={day} />}</View>
      </View>
      {side && (
        <View style={{ width: 300, gap: 20 }}>
          <StudyCard day={day} />
          <TrainingCard day={day} />
        </View>
      )}
    </View>
  );
}

export function TodayScreen() {
  return (
    <Shell title="Dein Tag" subtitle="Uni, Training, Lernen – alles an einem Ort." header={false}>
      <TodayContent />
    </Shell>
  );
}
