import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, useWindowDimensions, View, type DimensionValue } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Check, Dumbbell, Flame, Minus, Pencil, Play, Plus, Scale, Timer, Trash2, TrendingUp, Trophy, X } from "lucide-react-native";
import {
  categories,
  newId,
  parseDate,
  shiftDay,
  monday,
  type Exercise,
  type PlannerState,
  type SetDraft,
  type Workout,
} from "@/lib/planner";
import {
  exerciseHistory,
  lastEntry,
  loggedOn,
  presets,
  suggestion,
  trainingStreak,
  volume,
  weekdayShort,
  weekSummary,
  workoutsFor,
} from "@/lib/training";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Sparkline } from "./charts";
import { TrainingHistorySheet } from "./history";
import { TimeField } from "./pickers";
import { Button, C, Chip, Field, Heading, Pill, Sheet, Shell, s, useToday } from "./planner-ui";

const sport = categories.sport;


function RestTimer({ endsAt, total, stop }: { endsAt: number; total: number; stop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const width = useSharedValue(1);
  useEffect(() => {
    width.value = 1;
    width.value = withTiming(0, { duration: Math.max(0, endsAt - Date.now()), easing: Easing.linear });
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [endsAt, width]);
  useEffect(() => {
    if (now >= endsAt) {
      tap("heavy");
      stop();
    }
  }, [now, endsAt, stop]);
  const style = useAnimatedStyle(() => ({ width: (width.value * 100 + "%") as DimensionValue }));
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <Animated.View entering={FadeInDown} style={{ backgroundColor: "#352A21", borderRadius: 12, padding: 14, gap: 10 }}>
      <View style={s.row}>
        <Timer size={16} color={sport.color} />
        <Text style={{ color: sport.color, fontWeight: "700", flex: 1 }}>
          Satzpause {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </Text>
        <Pressable onPress={stop} hitSlop={8}>
          <Text style={s.link}>Überspringen</Text>
        </Pressable>
      </View>
      <View style={{ height: 5, backgroundColor: "#4A3B2E", borderRadius: 5, overflow: "hidden" }}>
        <Animated.View style={[{ height: "100%", backgroundColor: sport.color }, style]} />
      </View>
      <Text style={[s.micro, { opacity: total ? 1 : 0 }]}>Atmen, trinken, nächsten Satz vorbereiten.</Text>
    </Animated.View>
  );
}

// Starts a session with the suggested weights; it is stored so it survives
// switching screens or closing the app mid-workout.
export function startWorkout(state: PlannerState, workout: Workout, day: string): PlannerState {
  return {
    ...state,
    activeWorkout: {
      workoutId: workout.id,
      day,
      startedAt: Date.now(),
      sets: Object.fromEntries(
        workout.exercises.map((e) => {
          const sug = suggestion(state, e, day);
          return [e.id, Array.from({ length: e.sets }, () => ({ reps: String(sug.reps), weight: String(sug.weight), done: false }))];
        }),
      ),
    },
  };
}

// − value + : tap to adjust, or type in the middle. Fixed widths so a set
// row always fits a phone screen.
function Stepper({
  value,
  onChange,
  step,
  width,
  label,
  decimal = false,
}: {
  value: string;
  onChange: (v: string) => void;
  step: number;
  width: number;
  label: string;
  decimal?: boolean;
}) {
  const n = Number(value.replace(",", ".")) || 0;
  const set = (v: number) => {
    tap("select");
    onChange(String(Math.max(0, Math.round(v * 100) / 100)).replace(".", ","));
  };
  const button = { width: 32, height: 46, alignItems: "center", justifyContent: "center" } as const;
  return (
    <View style={[s.row, { gap: 0, backgroundColor: "#1C1C21", borderRadius: 14 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label + " verringern"} onPress={() => set(n - step)} style={button}>
        <Minus size={16} color={C.muted} />
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        selectTextOnFocus
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        style={{ width, minWidth: 0, padding: 0, textAlign: "center", color: C.ink, fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] }}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={label + " erhöhen"} onPress={() => set(n + step)} style={button}>
        <Plus size={16} color={C.muted} />
      </Pressable>
    </View>
  );
}

function Session({ workout, day }: { workout: Workout; day: string }) {
  const { state, update } = usePlanner();
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [restSec, setRestSec] = useState(90);
  const started = state.activeWorkout?.startedAt || 0;
  const sets = state.activeWorkout?.sets || {};
  const setSets = (fn: (prev: Record<string, SetDraft[]>) => Record<string, SetDraft[]>) =>
    update((prev) => (prev.activeWorkout ? { ...prev, activeWorkout: { ...prev.activeWorkout, sets: fn(prev.activeWorkout.sets) } } : prev));
  const doneSets = Object.values(sets).flat().filter((x) => x.done).length;
  const totalSets = Object.values(sets).flat().length;
  function change(id: string, i: number, patch: Partial<SetDraft>) {
    setSets((prev) => ({ ...prev, [id]: prev[id].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
  function check(id: string, i: number) {
    const was = sets[id]?.[i]?.done;
    change(id, i, { done: !was });
    if (!was) {
      tap("success");
      setRest({ endsAt: Date.now() + restSec * 1000, total: restSec * 1000 });
    }
  }
  function finish() {
    tap("success");
    const entries = workout.exercises.map((e) => ({
      exerciseId: e.id,
      name: e.name,
      sets: (sets[e.id] || [])
        .filter((x) => x.done)
        .map((x) => ({ reps: Number(x.reps) || 0, weight: Number(x.weight.replace(",", ".")) || 0 })),
    }));
    update((prev) => ({
      ...prev,
      activeWorkout: null,
      workoutLogs: [
        ...prev.workoutLogs.filter((l) => !(l.workoutId === workout.id && l.date === day)),
        {
          id: newId("log"),
          workoutId: workout.id,
          name: workout.name,
          date: day,
          minutes: Math.max(1, Math.round((Date.now() - started) / 60000)),
          entries,
        },
      ],
    }));
  }
  return (
    <View style={[s.card, { padding: 20, gap: 16, borderColor: sport.color }]}>
      <View style={s.sectionHeading}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>{workout.name} läuft 💪</Text>
          <Text style={[s.micro, { marginTop: 4 }]}>
            {doneSets}/{totalSets} Sätze · Vorschläge basieren auf deinem letzten Training
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Training abbrechen"
          onPress={() => update((prev) => ({ ...prev, activeWorkout: null }))}
          style={s.arrow}
        >
          <X size={20} color={C.muted} />
        </Pressable>
      </View>
      <View style={[s.row, { gap: 6 }]}>
        <Text style={[s.micro, { marginRight: 2 }]}>Pause</Text>
        {[60, 90, 120, 180].map((sec) => (
          <Pressable
            key={sec}
            accessibilityRole="button"
            accessibilityState={{ selected: restSec === sec }}
            onPress={() => {
              tap();
              setRestSec(sec);
            }}
            style={{ flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: restSec === sec ? sport.color : "#1C1C21" }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: restSec === sec ? "#121316" : C.muted }}>{sec < 120 ? sec + " s" : sec / 60 + " min"}</Text>
          </Pressable>
        ))}
      </View>
      {rest && <RestTimer endsAt={rest.endsAt} total={rest.total} stop={() => setRest(null)} />}
      {workout.exercises.map((e) => {
        const sug = suggestion(state, e, day);
        const last = lastEntry(state, e.name, day);
        return (
          <View key={e.id} style={{ gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={{ gap: 3 }}>
              <Text style={[s.h3, { fontSize: 17 }]}>{e.name}</Text>
              <Text style={{ color: sport.color, fontSize: 12 }}>
                {sug.note}
                {last
                  ? " · zuletzt " + last.sets.map((x) => x.reps + "×" + String(x.weight).replace(".", ",")).join(", ")
                  : ""}
              </Text>
            </View>
            <View style={[s.row, { gap: 6, marginTop: 2 }]}>
              <Text style={[s.micro, { width: 16 }]}>#</Text>
              <Text style={[s.micro, { width: 114, textAlign: "center" }]}>Gewicht (kg)</Text>
              <Text style={[s.micro, { width: 94, textAlign: "center" }]}>Wdh.</Text>
            </View>
            {(sets[e.id] || []).map((x, i) => (
              <View key={i} style={[s.row, { gap: 6, opacity: x.done ? 0.65 : 1 }]}>
                <Text style={[s.muted, { width: 16, fontWeight: "700" }]}>{i + 1}</Text>
                <Stepper
                  label={e.name + " Satz " + (i + 1) + " Gewicht"}
                  value={x.weight}
                  step={2.5}
                  width={50}
                  decimal
                  onChange={(v) => change(e.id, i, { weight: v })}
                />
                <Stepper
                  label={e.name + " Satz " + (i + 1) + " Wiederholungen"}
                  value={x.reps}
                  step={1}
                  width={30}
                  onChange={(v) => change(e.id, i, { reps: v })}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: x.done }}
                  accessibilityLabel={"Satz " + (i + 1) + " erledigt"}
                  onPress={() => check(e.id, i)}
                  style={{
                    marginLeft: "auto",
                    width: 44,
                    height: 46,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: x.done ? sport.color : "#1C1C21",
                  }}
                >
                  <Check size={20} color={x.done ? "#121316" : C.muted} strokeWidth={3} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() =>
                setSets((prev) => ({
                  ...prev,
                  [e.id]: [...(prev[e.id] || []), { ...(prev[e.id]?.at(-1) || { reps: "8", weight: "0" }), done: false }],
                }))
              }
            >
              <Text style={s.link}>+ Satz</Text>
            </Pressable>
          </View>
        );
      })}
      <Button icon={Trophy} onPress={finish} disabled={!doneSets}>
        Training abschließen (+60 XP)
      </Button>
    </View>
  );
}

function WorkoutEditor({ workout, close }: { workout?: Workout; close: () => void }) {
  const { update } = usePlanner();
  const [name, setName] = useState(workout?.name || "");
  const [days, setDays] = useState<number[]>(workout?.weekdays || [1]);
  const [time, setTime] = useState(workout?.time || "18:00");
  const [duration, setDuration] = useState(String(workout?.duration || 60));
  const [exercises, setExercises] = useState<(Exercise & { raw?: Record<string, string> })[]>(
    workout?.exercises || [{ id: newId("ex"), name: "", sets: 3, reps: 10, weight: 0 }],
  );
  const [error, setError] = useState("");
  function save() {
    if (!name.trim()) return setError("Gib dem Training einen Namen.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError("Uhrzeit als HH:MM.");
    const list = exercises.filter((e) => e.name.trim());
    if (!list.length) return setError("Mindestens eine Übung.");
    const next: Workout = {
      id: workout?.id || newId("wo"),
      name: name.trim(),
      weekdays: [...days].sort(),
      time,
      duration: Math.min(300, Math.max(10, Number(duration) || 60)),
      exercises: list.map(({ raw: _raw, ...e }) => ({ ...e, name: e.name.trim() })),
    };
    tap("success");
    update((prev) => ({
      ...prev,
      workouts: workout ? prev.workouts.map((w) => (w.id === workout.id ? next : w)) : [...prev.workouts, next],
    }));
    close();
  }
  const setField = (id: string, key: "name" | "sets" | "reps" | "weight", value: string) =>
    setExercises((prev) =>
      prev.map((e) =>
        e.id !== id ? e : key === "name" ? { ...e, name: value } : { ...e, [key]: Number(value.replace(",", ".")) || 0 },
      ),
    );
  return (
    <Sheet
      title={workout ? "Training bearbeiten" : "Neues Training"}
      close={close}
      width={640}
      footer={
        <>
          {workout && (
            <Button
              quiet
              danger
              icon={Trash2}
              onPress={() => {
                update((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== workout.id) }));
                close();
              }}
            >
              Löschen
            </Button>
          )}
          <Button icon={Check} onPress={save}>Speichern</Button>
        </>
      }
    >
      <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Push" maxLength={40} />
      <View>
        <Text style={s.label}>Tage</Text>
        <View style={s.wrap}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Chip
              key={d}
              label={weekdayShort[d]}
              active={days.includes(d)}
              color={sport.color}
              onPress={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
            />
          ))}
        </View>
      </View>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <TimeField label="Uhrzeit" value={time} onChange={setTime} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Dauer (Min.)" value={duration} onChangeText={setDuration} keyboardType="numeric" maxLength={3} />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={s.label}>Übungen (Sätze × Wdh. @ kg)</Text>
        {exercises.map((e) => (
          <View key={e.id} style={[s.row, { gap: 6 }]}>
            <TextInput value={e.name} onChangeText={(v) => setField(e.id, "name", v)} placeholder="Übung" placeholderTextColor="#777" accessibilityLabel="Übung" style={[s.input, { flex: 3, minHeight: 40, padding: 9 }]} />
            {(["sets", "reps", "weight"] as const).map((k) => (
              <TextInput
                key={k}
                defaultValue={String(e[k])}
                onChangeText={(v) => setField(e.id, k, v)}
                keyboardType="decimal-pad"
                accessibilityLabel={k === "sets" ? "Sätze" : k === "reps" ? "Wiederholungen" : "Gewicht"}
                style={[s.input, { flex: 1, minHeight: 40, padding: 9, textAlign: "center" }]}
              />
            ))}
            <Pressable accessibilityLabel="Übung entfernen" onPress={() => setExercises(exercises.filter((x) => x.id !== e.id))} style={s.arrow}>
              <X size={16} color={C.muted} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setExercises([...exercises, { id: newId("ex"), name: "", sets: 3, reps: 10, weight: 0 }])}>
          <Text style={s.link}>+ Übung hinzufügen</Text>
        </Pressable>
      </View>
      {error ? <Text style={s.formError}>{error}</Text> : null}
    </Sheet>
  );
}

function TrainingContent() {
  const { state, update } = usePlanner();
  const today = useToday();
  const { width } = useWindowDimensions();
  const [day, setDay] = useState(today);
  const active = state.activeWorkout;
  const session = active ? state.workouts.find((w) => w.id === active.workoutId) || null : null;
  const sessionDay = active?.day || day;
  const setSession = (w: Workout | null) => {
    tap("heavy");
    update((prev) => (w ? startWorkout(prev, w, day) : { ...prev, activeWorkout: null }));
  };
  const [editing, setEditing] = useState<Workout | "new" | null>(null);
  const [history, setHistory] = useState(false);
  const names = [...new Set(state.workouts.flatMap((w) => w.exercises.map((e) => e.name)))];
  const [exercise, setExercise] = useState("");
  const chosen = exercise || names[0] || "";
  const strength = exerciseHistory(state, chosen);
  const [weight, setWeight] = useState("");
  const week = weekSummary(state, today);
  const start = monday(today);
  const planned = workoutsFor(state, day);
  const logs = [...state.workoutLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return (
    <>
      <View style={[s.hero, { backgroundColor: "#33261C", flexWrap: "wrap", padding: width < 680 ? 22 : 30 }]}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <View style={s.heroBadge}>
            <Dumbbell size={14} color="#F5D2A8" />
            <Text style={{ color: "#F5D2A8", fontSize: 10, letterSpacing: 1 }}>STÄRKER ALS LETZTE WOCHE</Text>
          </View>
          <Text style={[s.heroTitle, { color: "#FFF1E2" }, width < 680 && { fontSize: 24, lineHeight: 31 }]}>
            {week.planned ? week.done + " von " + week.planned + " Trainings diese Woche" : "Dein Trainingsplan"}
          </Text>
          <Text style={[s.heroText, { color: "#E2C5A6" }]}>
            Progressive Überlastung: Schaffst du alle Sätze, schlägt Hap beim nächsten Mal mehr Gewicht vor.
          </Text>
          <View style={[s.row, { marginTop: 16, gap: 16 }]}>
            <View style={s.row}>
              <Flame size={15} color="#F5D2A8" />
              <Text style={[s.heroSmall, { color: "#F5D2A8" }]}>{trainingStreak(state, today)} Wochen am Stück</Text>
            </View>
            <Text style={[s.heroSmall, { color: "#F5D2A8" }]}>{state.workoutLogs.length} Trainings gesamt</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setHistory(true)}
            style={({ pressed }) => [s.row, { alignSelf: "flex-start", marginTop: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#4A3524", opacity: pressed ? 0.8 : 1 }]}
          >
            <TrendingUp size={16} color="#FFF1E2" />
            <Text style={{ color: "#FFF1E2", fontWeight: "700", fontSize: 14 }}>Entwicklung & Verlauf</Text>
          </Pressable>
        </View>
      </View>

      {!state.workouts.length && (
        <View style={{ gap: 14, marginBottom: 24 }}>
          <Heading>Wähle deinen Start-Plan</Heading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {presets.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(i * 80)} style={{ flexGrow: 1, flexBasis: 220 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    tap("success");
                    update((prev) => ({ ...prev, workouts: p.build() }));
                  }}
                  style={({ pressed }) => [s.card, { padding: 22, gap: 8, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Dumbbell size={22} color={sport.color} />
                  <Text style={s.h3}>{p.label}</Text>
                  <Text style={s.micro}>{p.detail}</Text>
                  <Text style={[s.link, { marginTop: 6 }]}>Übernehmen →</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
          <Button quiet icon={Plus} onPress={() => setEditing("new")}>Eigenes Training erstellen</Button>
          <Text style={s.micro}>Gewichte sind Startwerte – passe sie beim ersten Training einfach an.</Text>
        </View>
      )}

      {state.workouts.length > 0 && (
        <View style={{ gap: 22 }}>
          <View style={[s.weekStrip, { paddingVertical: 10 }]}>
            {Array.from({ length: 7 }, (_, i) => shiftDay(start, i)).map((d) => {
              const list = workoutsFor(state, d);
              const done = list.length > 0 && list.every((w) => loggedOn(state, w.id, d));
              return (
                <Pressable key={d} onPress={() => setDay(d)} style={[s.weekDay, { gap: 5 }, d === day && { backgroundColor: "#4A3524" }]}>
                  <Text style={[s.micro, d === today && { color: sport.color, fontWeight: "700" }]}>{weekdayShort[parseDate(d).getDay()]}</Text>
                  <Text style={[s.dayNumber, { fontSize: 15 }]}>{parseDate(d).getDate()}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 9, color: done ? "#98C5A9" : list.length ? sport.color : "#5D5A64" }}>
                    {done ? "✓" : list.length ? list[0].name.slice(0, 6) : "Ruhe"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {session ? (
            <Session workout={session} day={sessionDay} />
          ) : (
            <View style={{ gap: 14 }}>
              <Heading detail={parseDate(day).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}>
                {day === today ? "Heute" : "Geplant"}
              </Heading>
              {planned.length ? (
                planned.map((w) => {
                  const log = loggedOn(state, w.id, day);
                  return (
                    <View key={w.id} style={[s.card, { padding: 20, gap: 12 }]}>
                      <View style={s.sectionHeading}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.h2}>{w.name}</Text>
                          <Text style={[s.micro, { marginTop: 4 }]}>
                            {w.time} Uhr · {w.duration} Min. · {w.exercises.length} Übungen
                          </Text>
                        </View>
                        <Pressable accessibilityLabel="Training bearbeiten" onPress={() => setEditing(w)} style={s.arrow}>
                          <Pencil size={16} color={C.muted} />
                        </Pressable>
                      </View>
                      {w.exercises.map((e) => {
                        const sug = suggestion(state, e, day);
                        return (
                          <View key={e.id} style={[s.row, { paddingVertical: 3 }]}>
                            <Text style={[s.body, { flex: 1 }]}>{e.name}</Text>
                            <Text style={s.muted}>
                              {e.sets}×{sug.reps}
                              {sug.weight ? " @ " + String(sug.weight).replace(".", ",") + " kg" : ""}
                            </Text>
                          </View>
                        );
                      })}
                      {log ? (
                        <Pill color="#98C5A9" bg="#23342B">
                          ✓ Erledigt · {log.minutes} Min. · {Math.round(volume(log))} kg Volumen
                        </Pill>
                      ) : (
                        <Button icon={Play} onPress={() => setSession(w)}>Training starten</Button>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={[s.card, s.empty]}>
                  <Text style={s.h3}>Ruhetag 😴</Text>
                  <Text style={[s.muted, { textAlign: "center" }]}>Muskeln wachsen in der Pause. Schlaf gut, iss genug Protein.</Text>
                  <View style={s.wrap}>
                    {state.workouts.map((w) => (
                      <Chip key={w.id} label={w.name + " trotzdem starten"} active={false} color={sport.color} onPress={() => setSession(w)} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={[s.card, { padding: 22, gap: 12 }]}>
            <Heading>Dein Plan</Heading>
            {state.workouts.map((w) => (
              <Pressable key={w.id} onPress={() => setEditing(w)} style={[s.row, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }]}>
                <Dumbbell size={16} color={sport.color} />
                <Text style={[s.body, { flex: 1, fontWeight: "600" }]}>{w.name}</Text>
                <Text style={s.micro}>{w.weekdays.map((d) => weekdayShort[d]).join(" · ") || "ohne Tag"} · {w.time}</Text>
                <Pencil size={14} color={C.muted} />
              </Pressable>
            ))}
            <View style={[s.row, { flexWrap: "wrap" }]}>
              <Button quiet icon={Plus} onPress={() => setEditing("new")}>Training hinzufügen</Button>
              <Button quiet danger onPress={() => update((prev) => ({ ...prev, workouts: [] }))}>Plan zurücksetzen</Button>
            </View>
          </View>

          <View style={[s.card, { padding: 22, gap: 14 }]}>
            <View style={s.sectionHeading}>
              <View style={s.row}>
                <TrendingUp size={17} color={sport.color} />
                <Text style={s.h3}>Kraftverlauf (geschätztes 1RM)</Text>
              </View>
              {strength.length > 0 && (
                <Text style={[s.h3, { color: sport.color }]}>{String(strength[strength.length - 1].best).replace(".", ",")} kg</Text>
              )}
            </View>
            <View style={s.wrap}>
              {names.map((n) => (
                <Chip key={n} label={n} active={n === chosen} color={sport.color} onPress={() => setExercise(n)} />
              ))}
            </View>
            <Sparkline values={strength.map((h) => h.best)} color={sport.color} />
          </View>

          <View style={[s.card, { padding: 22, gap: 14 }]}>
            <View style={s.sectionHeading}>
              <View style={s.row}>
                <Scale size={17} color={sport.color} />
                <Text style={s.h3}>Körpergewicht</Text>
              </View>
              <Text style={s.h3}>{state.profile.weight} kg</Text>
            </View>
            <Sparkline values={state.bodyWeight.map((b) => b.kg)} color="#92B9DB" />
            <View style={s.row}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="Gewicht heute (kg)"
                placeholderTextColor="#777"
                keyboardType="decimal-pad"
                accessibilityLabel="Gewicht heute"
                style={[s.input, { flex: 1 }]}
              />
              <Button
                quiet
                onPress={() => {
                  const kg = Number(weight.replace(",", "."));
                  if (!(kg > 30 && kg < 300)) return;
                  tap("success");
                  update((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, weight: kg },
                    bodyWeight: [...prev.bodyWeight.filter((b) => b.date !== today), { date: today, kg }].sort((a, b) => a.date.localeCompare(b.date)),
                  }));
                  setWeight("");
                }}
              >
                Eintragen
              </Button>
            </View>
          </View>

          {logs.length > 0 && (
            <View style={[s.card, { padding: 22, gap: 10 }]}>
              <Heading>Letzte Trainings</Heading>
              {logs.map((l) => (
                <View key={l.id} style={[s.row, { paddingVertical: 5 }]}>
                  <Check size={14} color="#98C5A9" />
                  <Text style={[s.body, { flex: 1 }]}>{l.name}</Text>
                  <Text style={s.micro}>
                    {parseDate(l.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })} · {l.minutes} Min. · {Math.round(volume(l))} kg
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      {editing && <WorkoutEditor workout={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
      {history && <TrainingHistorySheet close={() => setHistory(false)} />}
    </>
  );
}

export function TrainingScreen() {
  return (
    <Shell title="Training" subtitle="Plan, Sätze, Fortschritt – ohne Zettel im Gym.">
      <TrainingContent />
    </Shell>
  );
}
