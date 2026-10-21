import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
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
  CalendarDays,
  Check,
  CheckCheck,
  Dumbbell,
  Flag,
  LayoutList,
  Mic,
  Play,
  Plus,
  Rows3,
  Send,
  Settings2,
  Wand,
  X,
} from "lucide-react-native";
import {
  categories,
  dayXp,
  levelFor,
  newId,
  occurrenceKey,
  parseDate,
  repeats,
  streak,
  totalXp,
} from "@/lib/planner";
import { nextUp } from "@/lib/agenda";
import { parseQuick } from "@/lib/quickadd";
import { listen, smartParse, speechAvailable, type SmartTask } from "@/lib/smartadd";
import { clock, examKinds, focusPick, hoursLabel, studyStreak, suggestBlock, upcomingExams } from "@/lib/study";
import { loggedOn, workoutsFor } from "@/lib/training";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Bar } from "./charts";
import { DayTimeline, useNow } from "./day-timeline";
import { InstallCard } from "./install-card";
import { DueTodos } from "./todos";
import { WeekPlanCard } from "./week-plan";
import { Button, C, Pill, Sheet, Shell, TaskList, useToday, WeekStrip, s } from "./planner-ui";

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
  const main = current || next;
  const after = current ? next : nextUp(state, today, (next?.start ?? 0) + 1).next;
  const deadline = upcomingExams(state, today)[0];
  function act(item: NonNullable<typeof main>) {
    tap();
    if (item.kind === "training") router.push("/training" as "/");
    else if (item.kind === "exam") router.push("/study" as "/");
    else if (item.kind === "task" && item.task?.category === "uni" && item.task.icon === "brain") router.push("/focus" as "/");
  }
  const square = { width: 40, height: 40, borderRadius: 12, backgroundColor: "#17171B", alignItems: "center", justifyContent: "center" } as const;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Pressable accessibilityRole="link" accessibilityLabel="Fortschritt öffnen" onPress={() => router.push("/progress" as "/")} style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 14, fontWeight: "500" }}>
            {parseDate(today).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Text style={{ color: "#6F6D76", fontSize: 12, marginTop: 2 }}>
            Serie {Math.max(streak(state, today), studyStreak(state, today))} · Level {level.level} · +{dayXp(state, today)} XP
          </Text>
        </Pressable>
        <View style={[s.row, { gap: 8 }]}>
          <Pressable accessibilityRole="link" accessibilityLabel="Monatskalender öffnen" onPress={() => router.push("/calendar" as "/")} style={square}>
            <CalendarDays size={18} color={C.ink} />
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="Einstellungen öffnen" onPress={() => router.push("/settings")} style={square}>
            <Settings2 size={18} color={C.ink} />
          </Pressable>
        </View>
      </View>
      <Pressable accessibilityRole="button" disabled={!main} onPress={() => main && act(main)} style={{ marginTop: 22 }}>
        <View style={s.row}>
          {current ? <Pulse color={C.green} /> : <CalendarClock size={13} color={C.green} />}
          <Text style={{ color: C.green, fontSize: 12, letterSpacing: 1.6, fontWeight: "800" }}>
            {current ? "JETZT · NOCH " + (current.end - mins) + " MIN." : main ? "ALS NÄCHSTES · " + until(main.start - mins).toUpperCase() : "HEUTE"}
          </Text>
        </View>
        {main ? (
          <>
            <Text style={{ color: C.ink, fontSize: 36, lineHeight: 39, fontWeight: "800", letterSpacing: -1.2, marginTop: 8 }} numberOfLines={2}>
              {main.title}
            </Text>
            <Text style={{ color: "#B8B6BE", fontSize: 15, marginTop: 6 }} numberOfLines={1}>
              {clock(main.start)}–{clock(main.end)} · {main.sub}
              {after ? " · danach " + after.title : ""}
            </Text>
            {current && (
              <View style={{ marginTop: 14 }}>
                <Bar value={(mins - current.start) / Math.max(1, current.end - current.start)} color={C.green} height={3} />
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
                style={[s.row, { marginTop: 14, alignSelf: "flex-start", backgroundColor: "#17171B", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 }]}
              >
                <CheckCheck size={15} color={C.ink} />
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 13 }}>Erledigt</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={{ color: C.ink, fontSize: 30, fontWeight: "800", letterSpacing: -1, marginTop: 8 }}>Nichts mehr geplant.</Text>
        )}
      </Pressable>
      {deadline && (
        <Pressable onPress={() => router.push("/study" as "/")} style={[s.row, { marginTop: 14, gap: 6 }]}>
          <Flag size={13} color={examKinds[deadline.exam.kind].color} />
          <Text style={{ color: C.muted, fontSize: 13 }}>
            {examKinds[deadline.exam.kind].label} {deadline.exam.title} in {deadline.days} {deadline.days === 1 ? "Tag" : "Tagen"}
          </Text>
        </Pressable>
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
            style={({ pressed }) => [{ padding: 12, width: 200, gap: 4, borderRadius: 14, backgroundColor: "#17171B", opacity: pressed ? 0.8 : 1 }]}
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
  const { state, update } = usePlanner();
  const today = useToday();
  const [text, setText] = useState("");
  const [flash, setFlash] = useState("");
  const [problem, setProblem] = useState("");
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState<(SmartTask & { on: boolean })[] | null>(null);
  const [listening, setListening] = useState<null | (() => void)>(null);
  const { width } = useWindowDimensions();
  // On phones the entry hides behind a + button until it is needed.
  const collapsible = width < 680;
  const [open, setOpen] = useState(false);
  const draft = text.trim() ? parseQuick(text, day === today ? today : day) : null;
  // Longer sentences with several steps go to the AI; short ones stay local.
  const complex = /\b(danach|dann|nach der|nach dem|vor der|vor dem|und dann|anschließend)\b|,/i.test(text) || text.trim().split(/\s+/).length > 9;
  function done(message: string) {
    setFlash(message);
    setText("");
    setTimeout(() => setFlash(""), 3500);
    if (collapsible) setOpen(false);
  }
  function add() {
    if (complex && state.accessToken) return void ask();
    if (!draft) return;
    tap("success");
    update((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { ...draft, id: newId("task"), note: "", skipped: [] }],
    }));
    done("„" + draft.title + "“ eingeplant für " + parseDate(draft.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }) + " um " + draft.time);
  }
  async function ask() {
    if (!text.trim() || thinking) return;
    setThinking(true);
    setProblem("");
    const result = await smartParse(state, text.trim());
    setThinking(false);
    if (typeof result === "string") return setProblem(result);
    tap("success");
    setProposal(result.map((t) => ({ ...t, on: true })));
  }
  function accept() {
    const chosen = (proposal || []).filter((t) => t.on);
    tap("success");
    update((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        ...chosen.map(({ on: _on, ...t }) => ({
          ...t,
          id: newId("task"),
          note: "",
          skipped: [],
          icon: categories[t.category].icon,
        })),
      ],
    }));
    setProposal(null);
    done(chosen.length + (chosen.length === 1 ? " Aufgabe" : " Aufgaben") + " eingeplant");
  }
  function mic() {
    if (listening) {
      listening();
      setListening(null);
      return;
    }
    tap("medium");
    const stop = listen(
      (t) => setText(t),
      () => setListening(null),
    );
    setListening(() => stop);
  }
  const cat = draft ? categories[draft.category] : null;
  const ready = !!draft || (complex && !!state.accessToken);
  if (collapsible && !open)
    return (
      <View pointerEvents="box-none" style={{ alignItems: "flex-end" }}>
        {flash ? (
          <View style={{ alignSelf: "stretch", backgroundColor: "#17171B", borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <Text style={[s.micro, { color: "#98C5A9" }]}>✓ {flash}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Etwas eintragen"
          onPress={() => {
            tap("medium");
            setOpen(true);
          }}
          style={({ pressed }) => ({
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: C.button,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: "#000",
            shadowOpacity: 0.5,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          })}
        >
          <Plus size={26} color={C.onAccent} strokeWidth={2.6} />
        </Pressable>
      </View>
    );
  return (
    <Animated.View entering={collapsible ? FadeInDown.duration(180) : undefined} style={collapsible ? { backgroundColor: C.bg, borderRadius: 18, padding: 6, borderWidth: 1, borderColor: C.line } : undefined}>
      <View style={[s.row, { gap: 8, backgroundColor: "#17171B", borderRadius: 16, paddingLeft: 14, paddingRight: 6, minHeight: 52 }]}>
        <TextInput
          autoFocus={collapsible}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder="Was steht an?"
          placeholderTextColor="#7E7887"
          accessibilityLabel="Schnelleingabe"
          style={{ flex: 1, color: C.ink, fontSize: 16, paddingVertical: 8, minHeight: 40 }}
        />
        {collapsible && !text.trim() && (
          <Pressable accessibilityRole="button" accessibilityLabel="Eingabe schließen" onPress={() => setOpen(false)} hitSlop={8} style={{ width: 32, height: 38, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={C.muted} />
          </Pressable>
        )}
        {speechAvailable() && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? "Diktat beenden" : "Per Sprache eingeben"}
            onPress={mic}
            style={{ backgroundColor: listening ? "#FF5A6A" : "#2A2B31", width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
          >
            <Mic size={16} color="white" />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={complex ? "Mit KI planen" : "Eintragen"}
          disabled={!ready || thinking}
          onPress={add}
          style={{ backgroundColor: ready ? C.button : "#2A2B31", width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
        >
          {thinking ? <ActivityIndicator color={C.onAccent} size="small" /> : complex ? <Wand size={16} color={ready ? C.onAccent : C.muted} /> : <Send size={16} color={ready ? C.onAccent : C.muted} />}
        </Pressable>
      </View>
      {complex && text.trim() ? (
        <Text style={[s.micro, { marginTop: 8 }]}>
          {state.accessToken ? "✨ Die KI plant das passend zu deinem Kalender – tippe auf den Zauberstab." : "Für längere Sätze braucht die KI deinen App-Zugang (Einstellungen)."}
        </Text>
      ) : draft && cat ? (
        <Animated.View entering={FadeInDown.duration(200)} style={[s.wrap, { marginTop: 10, gap: 6 }]}>
          <Pill color={cat.color} bg={cat.pale}>{cat.label}</Pill>
          <Pill>{parseDate(draft.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}</Pill>
          <Pill>{draft.time}</Pill>
          <Pill>{hoursLabel(draft.duration)}</Pill>
          {draft.repeat !== "none" && <Pill>{repeats[draft.repeat]}</Pill>}
          <Text style={[s.micro, { alignSelf: "center" }]}>→ {draft.title}</Text>
        </Animated.View>
      ) : null}
      {flash ? <Text style={[s.micro, { color: "#98C5A9", marginTop: 8 }]}>✓ {flash}</Text> : null}
      {problem ? <Text style={[s.micro, { color: "#F2A0A5", marginTop: 8 }]}>{problem}</Text> : null}
      {proposal && (
        <Sheet
          title="So würde Hap das planen"
          subtitle="Hak ab, was du übernehmen willst."
          close={() => setProposal(null)}
          footer={
            <>
              <Button quiet onPress={() => setProposal(null)}>Abbrechen</Button>
              <Button icon={Check} disabled={!proposal.some((t) => t.on)} onPress={accept}>Einplanen</Button>
            </>
          }
        >
          {proposal.map((t, i) => (
            <Pressable
              key={i}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.on }}
              onPress={() => setProposal(proposal.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
              style={[s.row, { padding: 12, borderRadius: 12, backgroundColor: "#22232A", gap: 12 }]}
            >
              <View style={[s.checkbox, t.on && { backgroundColor: C.button, borderColor: C.button }]}>
                {t.on && <Check size={14} color={C.onAccent} strokeWidth={3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.h3}>{t.title}</Text>
                <Text style={[s.micro, { marginTop: 3 }]}>
                  {parseDate(t.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })} · {t.time} · {hoursLabel(t.duration)} · {categories[t.category].label}
                  {t.repeat !== "none" ? " · " + repeats[t.repeat] : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </Sheet>
      )}
    </Animated.View>
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

function TodayContent({ day, setSelected }: { day: string; setSelected: (d: string | null) => void }) {
  const today = useToday();
  const [mode, setMode] = useState<"timeline" | "list">("timeline");
  const { width } = useWindowDimensions();
  const side = width >= 1180;
  return (
    <View style={[s.columns, !side && { flexDirection: "column", gap: 0 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <NowCard />
        <QuickActions />
        <WeekPlanCard />
        <DueTodos />
        <InstallCard />
        <View style={[s.sectionHeading, { marginTop: 8, marginBottom: 10 }]}>
          <Text style={s.eyebrow}>
            {day === today ? "ZEITPLAN" : parseDate(day).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
          </Text>
          <View style={[s.row, { gap: 14 }]}>
            {day !== today && (
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)} hitSlop={8}>
                <Text style={s.link}>Zu heute</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === "timeline" ? "Als Liste anzeigen" : "Als Zeitplan anzeigen"}
              onPress={() => setMode(mode === "timeline" ? "list" : "timeline")}
              hitSlop={8}
              style={s.row}
            >
              {mode === "timeline" ? <LayoutList size={14} color={C.muted} /> : <Rows3 size={14} color={C.muted} />}
              <Text style={[s.link, { color: C.muted }]}>{mode === "timeline" ? "Liste" : "Zeitplan"}</Text>
            </Pressable>
          </View>
        </View>
        <WeekStrip day={day} select={setSelected} />
        <View style={{ marginTop: 10 }}>{mode === "timeline" ? <DayTimeline day={day} compact /> : <TaskList day={day} />}</View>
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
  const today = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected || today;
  return (
    <Shell title="Dein Tag" subtitle="Uni, Training, Lernen – alles an einem Ort." header={false} bottom={<QuickAdd day={day} />}>
      <TodayContent day={day} setSelected={setSelected} />
    </Shell>
  );
}
