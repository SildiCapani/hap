import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type DimensionValue } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
  ZoomIn,
  FadeOut,
} from "react-native-reanimated";
import { Minus, Pause, Play, Plus, Square } from "lucide-react-native";
import { finishFocus } from "@/lib/planner";
import { examKinds, hoursLabel, upcomingExams } from "@/lib/study";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { C, Chip, Shell, s, useToday } from "./planner-ui";

const modes = [
  { label: "Pomodoro", focus: 25, rest: 5 },
  { label: "Deep Work", focus: 50, rest: 10 },
  { label: "Flow", focus: 90, rest: 15 },
];

function Particle({ progress, angle, distance, color, size }: { progress: SharedValue<number>; angle: number; distance: number; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: Math.sin(angle) * distance * p + 80 * p * p },
        { scale: 1 - 0.5 * p },
        { rotate: p * 540 + "deg" },
      ],
    };
  });
  return <Animated.View style={[{ position: "absolute", width: size, height: size * 0.6, borderRadius: 2, backgroundColor: color }, style]} />;
}

const confettiColors = ["#F07B83", "#FFD0D5", "#B9A2F2", "#E5B073", "#98C5A9", "#92B9DB"];

function Burst({ trigger }: { trigger: number }) {
  const progress = useSharedValue(1);
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      angle: (i / 28) * Math.PI * 2 + Math.random() * 0.3,
      distance: 110 + Math.random() * 110,
      color: confettiColors[i % confettiColors.length],
      size: 7 + Math.random() * 7,
    })),
  );
  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [trigger, progress]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      {pieces.map((p, i) => (
        <Particle key={i} progress={progress} {...p} />
      ))}
    </View>
  );
}

function FocusContent() {
  const { state, update } = usePlanner();
  const today = useToday();
  const params = useLocalSearchParams<{ exam?: string }>();
  const { width } = useWindowDimensions();
  const exams = upcomingExams(state, today);
  const active = state.activeFocus;
  const [examId, setExamId] = useState(active?.examId || params.exam || exams[0]?.exam.id || "");
  const [mode, setMode] = useState(1);
  const [minutes, setMinutes] = useState(modes[1].focus);
  const [burst, setBurst] = useState(0);
  const [reward, setReward] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const previous = useRef(active);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const [restState, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  // A break ends by itself once its time is up.
  const rest = restState && now < restState.endsAt ? restState : null;
  const running = !!active && active.pausedLeft === null;
  const leftMs = active ? (active.pausedLeft ?? Math.max(0, active.endsAt - now)) : rest ? Math.max(0, rest.endsAt - now) : minutes * 60000;
  const totalMs = active ? active.minutes * 60000 : rest ? rest.total : minutes * 60000;
  const fraction = active || rest ? 1 - leftMs / totalMs : 0;
  const exam = state.exams.find((e) => e.id === (active?.examId ?? examId));
  const label = exam?.title || "Freies Lernen";

  // The store finishes the round; a full round recorded here means "celebrate".
  useEffect(() => {
    const before = previous.current;
    previous.current = active;
    if (!before || active) return;
    const done = state.focus.find((f) => f.id === "focus-" + before.startedAt);
    if (!done || done.minutes !== before.minutes) return;
    const ended = before;
    tap("success");
    setBurst((b) => b + 1);
    setReward("+" + ended.minutes + " XP · " + ended.label);
    setTimeout(() => setReward(""), 4000);
    const m = modes.find((x) => x.focus === ended.minutes);
    const r = (m ? m.rest : Math.max(5, Math.round(ended.minutes / 5))) * 60000;
    setRest({ endsAt: Date.now() + r, total: r });
  }, [active, state.focus]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const mm = Math.floor(leftMs / 60000), ss = Math.floor((leftMs % 60000) / 1000);
    const t = String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
    document.title = running ? t + " · Fokus – Hap" : rest ? t + " · Pause – Hap" : "Hap";
    return () => {
      document.title = "Hap";
    };
  }, [leftMs, running, rest]);

  function start() {
    tap("heavy");
    setRest(null);
    const t = Date.now();
    update((prev) => ({
      ...prev,
      activeFocus: { examId: exam?.id || "", label, startedAt: t, endsAt: t + minutes * 60000, minutes, pausedLeft: null },
    }));
  }
  function pause() {
    tap("medium");
    update((prev) =>
      !prev.activeFocus
        ? prev
        : prev.activeFocus.pausedLeft === null
          ? { ...prev, activeFocus: { ...prev.activeFocus, pausedLeft: Math.max(0, prev.activeFocus.endsAt - Date.now()) } }
          : { ...prev, activeFocus: { ...prev.activeFocus, endsAt: Date.now() + prev.activeFocus.pausedLeft, pausedLeft: null } },
    );
  }
  function stop() {
    if (!active) return setRest(null);
    tap("medium");
    const elapsed = Math.floor((active.minutes * 60000 - leftMs) / 60000);
    update((prev) => finishFocus(prev, elapsed >= 5 ? elapsed : 0));
  }

  const mm = Math.floor(leftMs / 60000), ss = Math.floor((leftMs % 60000) / 1000);
  const color = rest ? "#7FD1A4" : C.green;
  const sessions = state.focus.filter((f) => f.date === today);
  const todayMin = sessions.reduce((n, f) => n + f.minutes, 0);
  const digits = Math.min(112, (width - 40) * 0.3);
  const currentMode = modes.find((m) => m.focus === (active?.minutes ?? minutes));
  return (
    <>
      <View style={{ alignItems: "center", paddingTop: 10 }}>
        <Text style={{ color, fontSize: 12, letterSpacing: 2, fontWeight: "700" }}>
          {rest ? "PAUSE" : active ? (running ? "FOKUS" : "PAUSIERT") : "BEREIT"}
          {currentMode && !rest ? " · " + currentMode.label.toUpperCase() + " " + currentMode.focus + "/" + currentMode.rest : ""}
        </Text>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.ink, fontSize: digits, lineHeight: digits * 1.05, fontWeight: "800", letterSpacing: -digits * 0.045, fontVariant: ["tabular-nums"], marginTop: 14 }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </Text>
          <Burst trigger={burst} />
          {reward ? (
            <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={{ position: "absolute", top: -8, backgroundColor: "#2A2418", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 }}>
              <Text style={{ color: "#F3D79B", fontWeight: "700" }}>🎉 {reward}</Text>
            </Animated.View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: C.ink, fontSize: 18, fontWeight: "600", marginTop: 8 }}>
          {rest ? "Kurz bewegen & trinken" : label}
        </Text>
        {!active && !rest && (
          <View style={[s.row, { marginTop: 14 }]}>
            <Pressable accessibilityLabel="5 Minuten weniger" onPress={() => setMinutes(Math.max(5, minutes - 5))} style={st.small}>
              <Minus size={16} color={C.ink} />
            </Pressable>
            <Text style={[s.muted, { width: 64, textAlign: "center" }]}>{minutes} Min.</Text>
            <Pressable accessibilityLabel="5 Minuten mehr" onPress={() => setMinutes(Math.min(180, minutes + 5))} style={st.small}>
              <Plus size={16} color={C.ink} />
            </Pressable>
          </View>
        )}
        <View style={{ width: "100%", maxWidth: 320, marginTop: 30 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: "#1E1E23", overflow: "hidden" }}>
            <View style={{ width: (Math.min(1, Math.max(0, fraction)) * 100 + "%") as DimensionValue, height: 4, backgroundColor: color }} />
          </View>
        </View>
        <View style={[s.row, { gap: 16, marginTop: 36 }]}>
          {active || rest ? (
            <>
              {active && (
                <Pressable accessibilityRole="button" accessibilityLabel={running ? "Pausieren" : "Fortsetzen"} onPress={pause} style={[st.big, { backgroundColor: C.button }]}>
                  {running ? <Pause size={26} color={C.onAccent} /> : <Play size={26} color={C.onAccent} />}
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={rest ? "Pause überspringen" : "Beenden"} onPress={stop} style={[st.big, { backgroundColor: "#17171B" }]}>
                {rest ? <Play size={22} color={C.ink} /> : <Square size={22} color={C.ink} />}
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={start} style={[st.start, { backgroundColor: C.button }]}>
              <Play size={22} color={C.onAccent} />
              <Text style={{ color: C.onAccent, fontSize: 16, fontWeight: "700" }}>Fokus starten</Text>
            </Pressable>
          )}
        </View>
        <Text style={[s.micro, { textAlign: "center", maxWidth: 300, lineHeight: 18, marginTop: 22 }]}>
          {active
            ? "Handy umdrehen. Hap meldet sich, wenn die Runde vorbei ist."
            : rest
              ? "Gönn dir die Pause – danach geht’s mit frischem Kopf weiter."
              : "Jede Minute Fokus zählt für dein Lernziel."}
        </Text>
      </View>
      {!active && !rest && (
        <View style={{ gap: 10, marginTop: 30 }}>
          <Text style={s.eyebrow}>MODUS</Text>
          <View style={s.wrap}>
            {modes.map((m, i) => (
              <Chip
                key={m.label}
                label={m.label + " " + m.focus + "/" + m.rest}
                active={mode === i && minutes === m.focus}
                onPress={() => {
                  setMode(i);
                  setMinutes(m.focus);
                }}
              />
            ))}
          </View>
          <Text style={[s.eyebrow, { marginTop: 10 }]}>FACH</Text>
          <View style={s.wrap}>
            <Chip label="Freies Lernen" active={!examId} onPress={() => setExamId("")} />
            {exams.map((x) => (
              <Chip key={x.exam.id} label={x.exam.title} active={examId === x.exam.id} color={examKinds[x.exam.kind].color} onPress={() => setExamId(x.exam.id)} />
            ))}
          </View>
        </View>
      )}
      <View style={{ marginTop: 30 }}>
        <View style={s.sectionHeading}>
          <Text style={s.eyebrow}>HEUTE · {hoursLabel(todayMin).toUpperCase()}</Text>
        </View>
        {sessions.length ? (
          sessions
            .slice()
            .reverse()
            .map((f) => (
              <View key={f.id} style={[s.row, { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1A1A1F" }]}>
                <Text style={[s.muted, { width: 46, fontVariant: ["tabular-nums"] }]}>{f.start}</Text>
                <Text style={[s.body, { flex: 1 }]}>{f.label}</Text>
                <Text style={s.muted}>{f.minutes} Min.</Text>
              </View>
            ))
        ) : (
          <Text style={[s.muted, { marginTop: 8 }]}>Noch keine Runde heute. Die erste ist die wichtigste.</Text>
        )}
      </View>
    </>
  );
}

const st = StyleSheet.create({
  small: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#17171B", alignItems: "center", justifyContent: "center" },
  big: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  start: { flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 30, height: 58, borderRadius: 29 },
});

export function FocusScreen() {
  return (
    <Shell title="Fokus" subtitle="Eine Sache. Volle Konzentration.">
      <FocusContent />
    </Shell>
  );
}
