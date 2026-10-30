import { useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CalendarCheck, Minus, Plus, Sparkles, X } from "lucide-react-native";
import { defaultRemind } from "@/lib/todos";
import { localStamp, newId, parseDate, shiftDay } from "@/lib/planner";
import { hoursLabel } from "@/lib/study";
import { AUTO_NOTE, autoSchedule, planningWeek, preview, review, suggestedTargets } from "@/lib/weekplan";
import { focusFor } from "@/lib/coach";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, Pill, Sheet, s, useToday } from "./planner-ui";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={s.row}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.button, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.onAccent, fontWeight: "800", fontSize: 12 }}>{n}</Text>
        </View>
        <Text style={s.h3}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const short = (d: string) => parseDate(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });

// Five-minute weekly review: look back, see the week, plan study, set goals.
export function WeekPlanSheet({ close }: { close: () => void }) {
  const { state, update } = usePlanner();
  const today = useToday();
  const week = planningWeek(today);
  const last = review(state, week);
  const next = preview(state, week);
  const [targets, setTargets] = useState(() => Object.fromEntries(suggestedTargets(state, week, today).map((t) => [t.exam.id, t.minutes])));
  const [result, setResult] = useState("");
  // The AI weekly focus, if there is one, pre-fills the goals.
  const [goals, setGoals] = useState(() => [0, 1, 2].map((i) => focusFor(state, week)?.items[i]?.action || ""));
  const exams = state.exams.filter((e) => targets[e.id] !== undefined);
  const total = Object.values(targets).reduce((n, m) => n + m, 0);
  const autoCount = state.tasks.filter((t) => t.note === AUTO_NOTE && t.date >= week && t.date <= shiftDay(week, 6)).length;
  function plan() {
    const r = autoSchedule(state, week, targets);
    tap("success");
    update((prev) => ({ ...prev, tasks: r.tasks }));
    setResult(
      r.created.length +
        " Lernblöcke eingeplant (" +
        hoursLabel(r.created.reduce((n, t) => n + t.duration, 0)) +
        ")" +
        (r.missing >= 30 ? " · " + hoursLabel(r.missing) + " passten nicht mehr in freie Zeit" : "") +
        ". Verschieben kannst du sie im Zeitplan per Gedrückthalten.",
    );
  }
  function finish() {
    const end = shiftDay(week, 6) + "T20:00";
    const chosen = goals.map((g) => g.trim()).filter(Boolean);
    tap("success");
    update((prev) => ({
      ...prev,
      weekPlanned: week,
      todos: [
        ...prev.todos,
        ...chosen.map((title) => ({ id: newId("todo"), title: "🎯 " + title, due: end, remind: { ...defaultRemind }, createdAt: localStamp(), doneAt: null })),
      ],
    }));
    close();
  }
  return (
    <Sheet
      title={"Woche ab " + short(week)}
      subtitle="In 5 Minuten zum Plan."
      close={close}
      width={620}
      footer={
        <>
          <Button quiet onPress={close}>Später</Button>
          <Button icon={CalendarCheck} onPress={finish}>Woche ist geplant</Button>
        </>
      }
    >
      <Step n={1} title="Rückblick letzte Woche">
        <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
          <Pill>⏱ {hoursLabel(last.focus)} Fokus</Pill>
          <Pill>💪 {last.training.done}/{last.training.planned} Trainings</Pill>
          <Pill>✓ {last.todos} To-dos erledigt</Pill>
        </View>
        <Text style={s.micro}>
          {last.focus >= 600 ? "Starke Lernwoche. 🔥" : last.focus ? "Jede Fokusrunde zählt – diese Woche ein bisschen mehr?" : "Neue Woche, neuer Anfang."}
        </Text>
      </Step>
      <Step n={2} title="Was ansteht">
        <Text style={s.body}>
          {next.lectures} Vorlesungen ({hoursLabel(next.lectureMinutes)}) · {next.workouts.length} Trainings
        </Text>
        {next.deadlines.length ? (
          next.deadlines.slice(0, 6).map((d, i) => (
            <Text key={i} style={s.micro}>
              ⚑ {short(d.date)} – {d.title}
            </Text>
          ))
        ) : (
          <Text style={s.micro}>Keine Abgaben oder Prüfungen in dieser Woche.</Text>
        )}
      </Step>
      <Step n={3} title="Lernzeit planen">
        {exams.length ? (
          <>
            {exams.map((e) => (
              <View key={e.id} style={[s.row, { padding: 10, borderRadius: 10, backgroundColor: "#22232A" }]}>
                <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{e.title}</Text>
                <Pressable accessibilityLabel="30 Minuten weniger" hitSlop={8} onPress={() => setTargets({ ...targets, [e.id]: Math.max(0, targets[e.id] - 30) })} style={[s.arrow, { backgroundColor: "#2E2F37", borderRadius: 14 }]}>
                  <Minus size={14} color={C.ink} />
                </Pressable>
                <Text style={[s.h3, { width: 58, textAlign: "center" }]}>{hoursLabel(targets[e.id])}</Text>
                <Pressable accessibilityLabel="30 Minuten mehr" hitSlop={8} onPress={() => setTargets({ ...targets, [e.id]: targets[e.id] + 30 })} style={[s.arrow, { backgroundColor: "#2E2F37", borderRadius: 14 }]}>
                  <Plus size={14} color={C.ink} />
                </Pressable>
              </View>
            ))}
            <Button icon={Sparkles} disabled={!total} onPress={plan}>
              {hoursLabel(total)} als Lernblöcke verteilen
            </Button>
            {autoCount > 0 && !result && <Text style={s.micro}>Bereits {autoCount} automatische Blöcke in dieser Woche – neu verteilen ersetzt sie.</Text>}
            {result ? <Text style={[s.micro, { color: "#98C5A9", lineHeight: 17 }]}>✓ {result}</Text> : null}
          </>
        ) : (
          <Text style={s.micro}>Keine offenen Prüfungen. Lege sie unter Lernen an oder importiere deine Module.</Text>
        )}
      </Step>
      <Step n={4} title="Deine 3 Ziele für die Woche">
        {goals.map((g, i) => (
          <View key={i} style={s.row}>
            <TextInput
              value={g}
              onChangeText={(v) => setGoals(goals.map((x, j) => (j === i ? v : x)))}
              placeholder={["z. B. Übungsblatt VS fertig", "z. B. 4× Training", "z. B. Bewerbung abschicken"][i]}
              placeholderTextColor="#7E7887"
              accessibilityLabel={"Ziel " + (i + 1)}
              style={[s.input, { flex: 1 }]}
            />
            {g ? (
              <Pressable accessibilityLabel="Ziel leeren" hitSlop={8} onPress={() => setGoals(goals.map((x, j) => (j === i ? "" : x)))}>
                <X size={16} color={C.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Text style={s.micro}>
          {focusFor(state, week)?.items.length ? "Vorgeschlagen aus deinem Wochenfokus – ändern oder leeren, wie du willst. " : ""}
          Ziele landen als To-dos mit Frist Sonntag 20:00.
        </Text>
      </Step>
    </Sheet>
  );
}

// Shown on weekends (and Monday morning) until the week is planned.
export function WeekPlanCard() {
  const { state } = usePlanner();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const day = parseDate(today).getDay();
  const week = planningWeek(today);
  const due = (day === 0 || day === 6 || (day === 1 && new Date().getHours() < 12)) && state.weekPlanned !== week;
  if (!due && !open) return null;
  return (
    <>
      {due && (
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[s.card, s.row, { padding: 16, marginBottom: 16, borderColor: "#5A4A2A", backgroundColor: "#241F17", gap: 12 }]}>
          <CalendarCheck size={22} color="#E5B073" />
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>Woche planen · 5 Min.</Text>
            <Text style={[s.micro, { marginTop: 3 }]}>Rückblick, Termine, Lernblöcke verteilen, 3 Ziele.</Text>
          </View>
          <Text style={[s.link, { color: "#E5B073" }]}>Los</Text>
        </Pressable>
      )}
      {open && <WeekPlanSheet close={() => setOpen(false)} />}
    </>
  );
}
