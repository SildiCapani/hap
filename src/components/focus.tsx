import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
  ZoomIn,
  FadeOut,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Coffee, Minus, Pause, Play, Plus, Square } from "lucide-react-native";
import { finishFocus } from "@/lib/planner";
import { examKinds, hoursLabel, upcomingExams } from "@/lib/study";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { C, Chip, Heading, Pill, Shell, s, useToday } from "./planner-ui";

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

function FocusRing({ fraction, size, running, color, children }: { fraction: number; size: number; running: boolean; color: string; children: React.ReactNode }) {
  const glow = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (running) {
      glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
      spin.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(glow);
      cancelAnimation(spin);
      glow.value = withTiming(0, { duration: 500 });
    }
  }, [running, glow, spin]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + glow.value * 0.32,
    transform: [{ scale: 0.9 + glow.value * 0.12 }],
  }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: spin.value + "deg" }] }));
  const counterSpin = useAnimatedStyle(() => ({ transform: [{ rotate: -spin.value * 1.6 + "deg" }] }));
  const stroke = 14;
  const r = (size - stroke * 2 - 26) / 2;
  const circumference = 2 * Math.PI * r;
  const angle = -Math.PI / 2 + fraction * Math.PI * 2;
  const c = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          { position: "absolute", width: size * 0.82, height: size * 0.82, borderRadius: size, backgroundColor: color },
          Platform.OS === "web" ? ({ filter: "blur(38px)" } as object) : { shadowColor: color, shadowRadius: 40, shadowOpacity: 1 },
          glowStyle,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={size / 2 - 4} stroke="#ffffff22" strokeWidth={1.5} strokeDasharray="2 10" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, counterSpin]}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={size / 2 - 13} stroke={color + "44"} strokeWidth={1} strokeDasharray="28 18 4 18" fill="none" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFD0D5" />
            <Stop offset="1" stopColor={color} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={r} stroke="#2A2531" strokeWidth={stroke} fill="#15131B" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference + " " + circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={"rotate(-90 " + c + " " + c + ")"}
        />
        {fraction > 0.002 && (
          <>
            <Circle cx={c + Math.cos(angle) * r} cy={c + Math.sin(angle) * r} r={stroke * 0.95} fill={color} opacity={0.35} />
            <Circle cx={c + Math.cos(angle) * r} cy={c + Math.sin(angle) * r} r={stroke * 0.42} fill="white" />
          </>
        )}
      </Svg>
      {children}
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

  const size = Math.min(340, width - 70);
  const mm = Math.floor(leftMs / 60000), ss = Math.floor((leftMs % 60000) / 1000);
  const color = rest ? "#7FD1A4" : exam ? examKinds[exam.kind].color : "#B9A2F2";
  const sessions = state.focus.filter((f) => f.date === today);
  const todayMin = sessions.reduce((n, f) => n + f.minutes, 0);
  return (
    <>
      <View style={[s.card, { backgroundColor: "#15131B", padding: width < 680 ? 18 : 32, alignItems: "center", gap: 22, overflow: "hidden" }]}>
        {!active && !rest && (
          <View style={{ gap: 12, width: "100%", alignItems: "center" }}>
            <View style={[s.wrap, { justifyContent: "center" }]}>
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
            <View style={[s.wrap, { justifyContent: "center" }]}>
              <Chip label="Freies Lernen" active={!examId} onPress={() => setExamId("")} />
              {exams.map((x) => (
                <Chip key={x.exam.id} label={x.exam.title} active={examId === x.exam.id} color={examKinds[x.exam.kind].color} onPress={() => setExamId(x.exam.id)} />
              ))}
            </View>
          </View>
        )}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <FocusRing fraction={fraction} size={size} running={running || !!rest} color={color}>
            <Text style={{ color: "#A79FB4", fontSize: 11, letterSpacing: 3, fontWeight: "700" }}>
              {rest ? "PAUSE" : active ? (running ? "FOKUS" : "PAUSIERT") : "BEREIT"}
            </Text>
            <Text style={{ color: "white", fontSize: size * 0.2, fontWeight: "800", letterSpacing: -2, fontVariant: ["tabular-nums"] }}>
              {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
            </Text>
            <Text numberOfLines={1} style={{ color: color, fontSize: 13, fontWeight: "600", maxWidth: size * 0.6 }}>
              {rest ? "Kurz bewegen & trinken" : label}
            </Text>
            {!active && !rest && (
              <View style={[s.row, { marginTop: 12 }]}>
                <Pressable accessibilityLabel="5 Minuten weniger" onPress={() => setMinutes(Math.max(5, minutes - 5))} style={[s.arrow, { backgroundColor: "#2A2531", borderRadius: 20 }]}>
                  <Minus size={16} color={C.ink} />
                </Pressable>
                <Text style={[s.micro, { width: 54, textAlign: "center" }]}>{minutes} Min.</Text>
                <Pressable accessibilityLabel="5 Minuten mehr" onPress={() => setMinutes(Math.min(180, minutes + 5))} style={[s.arrow, { backgroundColor: "#2A2531", borderRadius: 20 }]}>
                  <Plus size={16} color={C.ink} />
                </Pressable>
              </View>
            )}
          </FocusRing>
          <Burst trigger={burst} />
          {reward ? (
            <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={{ position: "absolute", top: -6, backgroundColor: "#342D24", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 }}>
              <Text style={{ color: "#F3D79B", fontWeight: "700" }}>🎉 {reward}</Text>
            </Animated.View>
          ) : null}
        </View>
        <View style={[s.row, { gap: 14 }]}>
          {active || rest ? (
            <>
              {active && (
                <Pressable accessibilityRole="button" accessibilityLabel={running ? "Pausieren" : "Fortsetzen"} onPress={pause} style={[st.big, { backgroundColor: C.button }]}>
                  {running ? <Pause size={26} color="white" /> : <Play size={26} color="white" />}
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={rest ? "Pause überspringen" : "Beenden"} onPress={stop} style={[st.big, { backgroundColor: "#2A2531" }]}>
                {rest ? <Play size={22} color={C.ink} /> : <Square size={22} color={C.ink} />}
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={start} style={[st.start, { backgroundColor: C.button }]}>
              <Play size={22} color="white" />
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Fokus starten</Text>
            </Pressable>
          )}
        </View>
        <Text style={[s.micro, { textAlign: "center", maxWidth: 420, lineHeight: 18 }]}>
          {active
            ? "Handy umdrehen, Tabs zu. Unter 5 Minuten wird beim Beenden nichts gezählt. Du bekommst eine Benachrichtigung, wenn die Runde vorbei ist."
            : rest
              ? "Gönn dir die Pause – danach geht’s mit frischem Kopf weiter."
              : "Jede Minute Fokus zählt für dein Lernziel und bringt 1 XP."}
        </Text>
      </View>
      <View style={[s.card, { padding: 24, marginTop: 22, gap: 12 }]}>
        <Heading detail={hoursLabel(todayMin) + " heute"}>Deine Fokusrunden</Heading>
        {sessions.length ? (
          sessions
            .slice()
            .reverse()
            .map((f) => (
              <View key={f.id} style={[s.row, { paddingVertical: 6 }]}>
                <Coffee size={15} color={C.muted} />
                <Text style={[s.body, { flex: 1 }]}>{f.label}</Text>
                <Pill>{f.start}</Pill>
                <Text style={s.muted}>{f.minutes} Min.</Text>
              </View>
            ))
        ) : (
          <Text style={s.muted}>Noch keine Runde heute. Die erste ist die wichtigste.</Text>
        )}
      </View>
    </>
  );
}

const st = StyleSheet.create({
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
