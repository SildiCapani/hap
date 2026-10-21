import { useState } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  AlarmClock,
  Brain,
  CalendarCheck,
  CalendarPlus,
  Check,
  FileText,
  ImagePlus,
  Sparkles,
  Flag,
  GraduationCap,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react-native";
import {
  newId,
  parseDate,
  shiftDay,
  validDate,
  type Exam,
  type ExamKind,
} from "@/lib/planner";
import {
  clock,
  examKinds,
  examStatus,
  focusByDay,
  hoursLabel,
  studyStreak,
  suggestBlock,
  upcomingExams,
  type ExamStatus,
} from "@/lib/study";
import { usePlanner } from "@/lib/store";
import { pickPhoto } from "@/lib/food";
import { examKindFor, pickPdf, scanModules, type ModuleDraft } from "@/lib/modules";
import { WeekPlanSheet } from "./week-plan";
import { tap } from "@/lib/notify";
import { Bar, Heatmap, TimePicture } from "./charts";
import {
  Button,
  C,
  Chip,
  Field,
  Heading,
  Pill,
  Sheet,
  Shell,
  s,
  useToday,
} from "./planner-ui";

const pressureLabel = {
  relaxed: { label: "Entspannt", color: "#98C5A9" },
  steady: { label: "Dranbleiben", color: "#92B9DB" },
  tight: { label: "Wird eng", color: "#E5B073" },
  critical: { label: "Kritisch", color: "#FF6B78" },
  past: { label: "Vorbei", color: "#77737F" },
} as const;

function Countdown({ days }: { days: number }) {
  return (
    <View style={{ alignItems: "center", minWidth: 58 }}>
      <Text style={{ color: C.ink, fontSize: 30, fontWeight: "800", letterSpacing: -1 }}>{days}</Text>
      <Text style={s.micro}>{days === 1 ? "TAG" : "TAGE"}</Text>
    </View>
  );
}

function ExamCard({ status, edit }: { status: ExamStatus; edit: (e: Exam) => void }) {
  const { update } = usePlanner();
  const { exam } = status;
  const kind = examKinds[exam.kind];
  const pressure = pressureLabel[status.pressure];
  const total = exam.hours * 60;
  return (
    <View style={[s.card, { padding: 20, gap: 14, borderLeftWidth: 4, borderLeftColor: kind.color }]}>
      <View style={[s.row, { alignItems: "flex-start", gap: 14 }]}>
        <Countdown days={Math.max(0, status.days)} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={[s.row, { flexWrap: "wrap", gap: 6 }]}>
            <Pill color={kind.color} bg="#2A2B32">{kind.label}</Pill>
            <Pill color={pressure.color} bg="#2A2B32">{pressure.label}</Pill>
          </View>
          <Text style={[s.h2, { fontSize: 16 }]}>{exam.title}</Text>
          <Text style={s.micro}>
            {parseDate(exam.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
            {exam.time ? " · " + exam.time + " Uhr" : ""}
          </Text>
        </View>
        <Pressable accessibilityLabel="Bearbeiten" onPress={() => edit(exam)} style={s.arrow}>
          <Pencil size={16} color={C.muted} />
        </Pressable>
      </View>
      <View style={{ gap: 7 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={s.micro}>
            {hoursLabel(status.done)} von {hoursLabel(total)} gelernt
          </Text>
          <Text style={[s.micro, { color: C.ink }]}>{total ? Math.round((status.done / total) * 100) : 0}%</Text>
        </View>
        <Bar value={total ? status.done / total : 0} color={kind.color} />
        {status.left > 0 && status.days > 0 && (
          <Text style={[s.micro, { color: pressure.color }]}>
            ≈ {hoursLabel(status.perDay)} pro Tag · heute schon {hoursLabel(status.today)}
          </Text>
        )}
      </View>
      {exam.topics.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={s.eyebrow}>
            THEMEN {status.topicsDone}/{exam.topics.length}
          </Text>
          {exam.topics.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.done }}
              onPress={() => {
                tap(t.done ? "light" : "success");
                update((prev) => ({
                  ...prev,
                  exams: prev.exams.map((e) =>
                    e.id === exam.id
                      ? { ...e, topics: e.topics.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }
                      : e,
                  ),
                }));
              }}
              style={[s.row, { paddingVertical: 5 }]}
            >
              <View style={[s.checkbox, { width: 18, height: 18 }, t.done && { backgroundColor: kind.color, borderColor: kind.color }]}>
                {t.done && <Check size={12} color="#121316" strokeWidth={3} />}
              </View>
              <Text style={[s.body, t.done && { color: C.muted, textDecorationLine: "line-through" }]}>{t.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {status.days >= 0 && (
        <Button icon={Play} onPress={() => router.push(("/focus?exam=" + exam.id) as "/")}>
          Fokus für {exam.title.length > 22 ? exam.title.slice(0, 20) + "…" : exam.title}
        </Button>
      )}
    </View>
  );
}

function ExamEditor({ exam, close }: { exam?: Exam; close: () => void }) {
  const { state, update } = usePlanner();
  const today = useToday();
  const [title, setTitle] = useState(exam?.title || "");
  const [kind, setKind] = useState<ExamKind>(exam?.kind || "exam");
  const [date, setDate] = useState(exam?.date || shiftDay(today, 14));
  const [time, setTime] = useState(exam?.time || "");
  const [hours, setHours] = useState(String(exam?.hours ?? 20));
  const [topics, setTopics] = useState(exam?.topics.map((t) => t.title).join("\n") || "");
  const [note, setNote] = useState(exam?.note || "");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  // A prefilled draft (from a timetable subject) has no id yet.
  const existing = !!exam?.id;
  const subjects = [...new Set(state.uniEvents.filter((e) => e.kind === "lecture").map((e) => e.title))]
    .filter((t) => t.length < 40)
    .slice(0, 12);
  const examWeek = state.uniEvents.find((e) => e.kind === "exam" && e.date >= today);
  function save() {
    if (!title.trim()) return setError("Wie heißt das Fach?");
    if (!validDate(date)) return setError("Bitte ein Datum als JJJJ-MM-TT eingeben.");
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError("Uhrzeit als HH:MM oder leer lassen.");
    const h = Number(hours.replace(",", "."));
    if (!Number.isFinite(h) || h < 0 || h > 500) return setError("Lernaufwand zwischen 0 und 500 Stunden.");
    const old = exam?.topics || [];
    const next: Exam = {
      id: exam?.id || newId("exam"),
      title: title.trim(),
      kind,
      date,
      time,
      hours: h,
      note: note.trim(),
      topics: topics
        .split(/\n|,/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => old.find((o) => o.title === t) || { id: newId("topic"), title: t, done: false }),
    };
    tap("success");
    update((prev) => ({
      ...prev,
      exams: existing ? prev.exams.map((e) => (e.id === exam?.id ? next : e)) : [...prev.exams, next],
    }));
    close();
  }
  return (
    <Sheet
      title={existing ? "Prüfung bearbeiten" : "Neue Prüfung oder Abgabe"}
      subtitle="Hap verteilt den Lernaufwand auf die Tage bis dahin."
      close={close}
      footer={
        <>
          <Button quiet onPress={close}>Abbrechen</Button>
          <Button icon={Check} onPress={save}>Speichern</Button>
        </>
      }
    >
      <View>
        <Text style={s.label}>Art</Text>
        <View style={s.wrap}>
          {(Object.keys(examKinds) as ExamKind[]).map((k) => (
            <Chip key={k} label={examKinds[k].label} active={kind === k} color={examKinds[k].color} onPress={() => setKind(k)} />
          ))}
        </View>
      </View>
      <Field label="Fach / Thema" value={title} onChangeText={setTitle} placeholder="z. B. Verteilte Systeme" maxLength={80} />
      {subjects.length > 0 && !existing && (
        <View>
          <Text style={s.label}>Aus deinem Stundenplan</Text>
          <View style={s.wrap}>
            {subjects.map((t) => (
              <Chip key={t} label={t} active={title === t} onPress={() => setTitle(t)} />
            ))}
          </View>
        </View>
      )}
      <View style={s.row}>
        <View style={{ flex: 1.3 }}>
          <Field label={kind === "assignment" ? "Abgabe am (JJJJ-MM-TT)" : "Datum (JJJJ-MM-TT)"} value={date} onChangeText={setDate} maxLength={10} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Uhrzeit (optional)" value={time} onChangeText={setTime} placeholder="09:00" maxLength={5} />
        </View>
      </View>
      {examWeek && (
        <Pressable onPress={() => setDate(examWeek.date)}>
          <Text style={s.link}>
            Klausurwoche laut Rapla ab {parseDate(examWeek.date).toLocaleDateString("de-DE")} – übernehmen
          </Text>
        </Pressable>
      )}
      <View>
        <Field label="Wie viele Stunden willst du insgesamt lernen?" value={hours} onChangeText={setHours} keyboardType="numeric" maxLength={5} />
        <View style={[s.wrap, { marginTop: 8 }]}>
          {[5, 10, 20, 30, 45, 60].map((h) => (
            <Chip key={h} label={h + " h"} active={hours === String(h)} onPress={() => setHours(String(h))} />
          ))}
        </View>
      </View>
      <Field
        label="Themen (eine pro Zeile) – zum Abhaken"
        value={topics}
        onChangeText={setTopics}
        multiline
        placeholder={"Konsensalgorithmen\nRPC & REST\nReplikation"}
      />
      <Field label="Notizen" value={note} onChangeText={setNote} placeholder="Raum, erlaubte Hilfsmittel …" multiline maxLength={1000} />
      {error ? <Text style={s.formError}>{error}</Text> : null}
      {exam && existing &&
        (!confirm ? (
          <Pressable onPress={() => setConfirm(true)} style={s.row}>
            <Trash2 size={15} color="#EC939B" />
            <Text style={{ color: "#EC939B", fontSize: 12 }}>Löschen</Text>
          </Pressable>
        ) : (
          <Button
            danger
            onPress={() => {
              update((prev) => ({ ...prev, exams: prev.exams.filter((e) => e.id !== exam.id) }));
              close();
            }}
          >
            Endgültig löschen (Fokus-Zeiten bleiben)
          </Button>
        ))}
    </Sheet>
  );
}

function ModuleImport({ close }: { close: () => void }) {
  const { state, update } = usePlanner();
  const today = useToday();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<(ModuleDraft & { on: boolean; hoursText: string; dateText: string; exists: boolean })[] | null>(null);
  const examWeek = state.uniEvents.find((e) => e.kind === "exam" && e.date >= today)?.date;
  async function run(input: { text?: string; image?: string; pdf?: string }) {
    setError("");
    setBusy("KI liest deine Module …");
    const result = await scanModules(state, input);
    setBusy("");
    if (typeof result === "string") return setError(result);
    if (!result.length) return setError("Hap hat keine Module gefunden. Versuch einen anderen Ausschnitt.");
    tap("success");
    setRows(
      result.map((m) => {
        const exists = state.exams.some((e) => e.title.toLowerCase() === m.name.toLowerCase());
        return { ...m, on: !exists, exists, hoursText: String(m.hours), dateText: m.date || examWeek || shiftDay(today, 30) };
      }),
    );
  }
  async function from(kind: "image" | "pdf") {
    try {
      const data = kind === "image" ? await pickPhoto("library") : await pickPdf();
      if (data) await run(kind === "image" ? { image: data, text } : { pdf: data, text });
    } catch (e) {
      setBusy("");
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht geladen werden.");
    }
  }
  const chosen = rows?.filter((r) => r.on) || [];
  function create() {
    const bad = chosen.find((r) => !validDate(r.dateText) || !(Number(r.hoursText) > 0));
    if (bad) return setError("Bitte bei „" + bad.name + "“ ein Datum (JJJJ-MM-TT) und Stunden eintragen.");
    tap("success");
    update((prev) => ({
      ...prev,
      exams: [
        ...prev.exams,
        ...chosen.map((r) => ({
          id: newId("exam"),
          title: r.name,
          kind: examKindFor(r.exam),
          date: r.dateText,
          time: "",
          hours: Number(r.hoursText),
          topics: r.topics.map((t) => ({ id: newId("topic"), title: t, done: false })),
          note: (r.ects ? r.ects + " ECTS · " : "") + r.exam + (r.date ? "" : " · Datum vorläufig"),
        })),
      ],
    }));
    close();
  }
  return (
    <Sheet
      title="Module importieren"
      subtitle="Screenshot der Moodle-Kursliste, Modulhandbuch (PDF) oder Text – die KI plant die Lernstunden."
      close={close}
      width={640}
      footer={
        rows ? (
          <>
            <Button quiet onPress={() => setRows(null)}>Zurück</Button>
            <Button icon={Check} disabled={!chosen.length} onPress={create}>
              {chosen.length} {chosen.length === 1 ? "Prüfung" : "Prüfungen"} anlegen
            </Button>
          </>
        ) : undefined
      }
    >
      {!rows ? (
        <>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <Button icon={ImagePlus} disabled={!!busy} onPress={() => void from("image")}>Screenshot / Foto</Button>
            <Button quiet icon={FileText} disabled={!!busy} onPress={() => void from("pdf")}>PDF</Button>
          </View>
          <Field
            label="Oder Text einfügen (z. B. aus Moodle „Meine Kurse“ kopiert)"
            value={text}
            onChangeText={setText}
            multiline
            placeholder={"Verteilte Systeme (5 ECTS, Klausur)\nKünstliche Intelligenz …"}
          />
          <Button quiet icon={Sparkles} disabled={!!busy || !text.trim()} onPress={() => void run({ text })}>
            Text auswerten
          </Button>
          {busy ? (
            <View style={s.row}>
              <ActivityIndicator color={C.green} />
              <Text style={s.body}>{busy}</Text>
            </View>
          ) : null}
          <Text style={[s.micro, { lineHeight: 17 }]}>
            Kostet unter 1 Cent. Termine für Abgaben bekommst du automatisch, wenn du den Moodle-Kalender unter Einstellungen → Kalender-Abos einträgst.
          </Text>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((r, i) => {
            const set = (patch: Partial<typeof r>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <View key={r.name + i} style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: r.on ? "#22232A" : "#1A1B20" }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.on }} onPress={() => set({ on: !r.on })} style={s.row}>
                  <View style={[s.checkbox, r.on && { backgroundColor: C.button, borderColor: C.button }]}>
                    {r.on && <Check size={14} color={C.onAccent} strokeWidth={3} />}
                  </View>
                  <Text style={[s.h3, { flex: 1 }]}>{r.name}</Text>
                  <Pill>{r.exam}</Pill>
                </Pressable>
                {r.exists && <Text style={s.micro}>Schon in deinen Prüfungen</Text>}
                {r.on && (
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Field label={"Lernstunden" + (r.ects ? " (" + r.ects + " ECTS)" : "")} value={r.hoursText} onChangeText={(v) => set({ hoursText: v })} keyboardType="numeric" maxLength={3} />
                    </View>
                    <View style={{ flex: 1.3 }}>
                      <Field label={r.date ? "Prüfung am" : "Datum (vorläufig)"} value={r.dateText} onChangeText={(v) => set({ dateText: v })} maxLength={10} />
                    </View>
                  </View>
                )}
                {r.on && r.topics.length > 0 && <Text style={s.micro} numberOfLines={2}>Themen: {r.topics.join(", ")}</Text>}
              </View>
            );
          })}
        </View>
      )}
      {error ? <Text style={s.formError}>{error}</Text> : null}
    </Sheet>
  );
}

function TodayPlan() {
  const { state, update } = usePlanner();
  const today = useToday();
  const list = upcomingExams(state, today).filter((x) => x.left > 0 && x.days > 0);
  const now = new Date();
  const after = now.getHours() * 60 + now.getMinutes();
  if (!list.length) return null;
  const total = list.reduce((n, x) => n + Math.max(0, x.perDay - x.today), 0);
  return (
    <View style={[s.card, { padding: 22, gap: 14 }]}>
      <Heading detail={total ? "noch " + hoursLabel(total) + " heute" : "Alles geschafft 🔥"}>Dein Lernplan für heute</Heading>
      {list.map((x, i) => {
        const need = Math.max(0, x.perDay - x.today);
        const block = need ? suggestBlock(state, today, need, after) : null;
        return (
          <Animated.View key={x.exam.id} entering={FadeInDown.delay(i * 60)} style={[s.row, { flexWrap: "wrap", gap: 12, paddingVertical: 6 }]}>
            <View style={{ width: 4, alignSelf: "stretch", borderRadius: 4, backgroundColor: examKinds[x.exam.kind].color }} />
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={s.h3}>{x.exam.title}</Text>
              <Text style={[s.micro, { marginTop: 3 }]}>
                {need ? hoursLabel(need) + " offen" : "Tagesziel erreicht ✓"} · {examKinds[x.exam.kind].label} in {x.days} T.
              </Text>
            </View>
            {block && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  tap("success");
                  update((prev) => ({
                    ...prev,
                    tasks: [
                      ...prev.tasks,
                      {
                        id: newId("task"),
                        title: "Lernen: " + x.exam.title,
                        note: "Automatisch eingeplanter Lernblock.",
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
                }}
                style={s.filter}
              >
                <CalendarPlus size={14} color={C.green} />
                <Text style={s.link}>
                  {clock(block.start)} · {hoursLabel(block.length)}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Fokus für " + x.exam.title}
              onPress={() => router.push(("/focus?exam=" + x.exam.id) as "/")}
              style={[s.filter, { backgroundColor: C.button, borderColor: C.button }]}
            >
              <Play size={14} color={C.onAccent} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

function StudyContent() {
  const { state, syncUni, uniSyncing, uniStatus } = usePlanner();
  const today = useToday();
  const { width } = useWindowDimensions();
  const [editing, setEditing] = useState<Exam | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [weekPlan, setWeekPlan] = useState(false);
  const statuses = state.exams
    .map((e) => examStatus(state, e, today))
    .sort((a, b) => (a.days < 0 ? 1 : 0) - (b.days < 0 ? 1 : 0) || a.days - b.days);
  const upcoming = statuses.filter((x) => x.days >= 0);
  const next = upcoming[0];
  const examWeek = state.uniEvents.find((e) => e.kind === "exam" && e.date >= today);
  const heat = focusByDay(state, today, 7 * 16);
  const weekFocus = focusByDay(state, today, 7).reduce((n, d) => n + d.minutes, 0);
  const lectureTitles = [...new Set(state.uniEvents.filter((e) => e.kind === "lecture").map((e) => e.title))];
  const untracked = lectureTitles.filter((t) => !state.exams.some((e) => e.title === t) && t.length < 40);
  return (
    <>
      <View style={[s.hero, { backgroundColor: "#2A2140", flexWrap: "wrap", padding: width < 680 ? 22 : 30 }]}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <View style={s.heroBadge}>
            <GraduationCap size={14} color="#D9C8FF" />
            <Text style={{ color: "#D9C8FF", fontSize: 10, letterSpacing: 1 }}>PRÜFUNGSPHASE IM GRIFF</Text>
          </View>
          <Text style={[s.heroTitle, { color: "#F3EEFF" }, width < 680 && { fontSize: 24, lineHeight: 31 }]}>
            {next ? next.exam.title + " in " + next.days + (next.days === 1 ? " Tag" : " Tagen") : "Bereit für die Klausuren?"}
          </Text>
          <Text style={[s.heroText, { color: "#C9BDE6" }]}>
            {examWeek
              ? "Klausurwoche laut Rapla ab " + parseDate(examWeek.date).toLocaleDateString("de-DE", { day: "numeric", month: "long" }) + "."
              : "Leg Klausuren & Abgaben an. Hap plant, wie viel du jeden Tag lernen musst."}
          </Text>
          <View style={[s.row, { marginTop: 18, gap: 16, flexWrap: "wrap" }]}>
            <Text style={[s.heroSmall, { color: "#E4DAFF" }]}>🔥 {studyStreak(state, today)} Tage Lernserie</Text>
            <Text style={[s.heroSmall, { color: "#E4DAFF" }]}>⏱ {hoursLabel(weekFocus)} diese Woche</Text>
          </View>
        </View>
        <View style={{ gap: 10, justifyContent: "center" }}>
          <Button icon={Play} onPress={() => router.push("/focus" as "/")}>Fokus-Timer</Button>
          <Button quiet icon={Plus} onPress={() => setEditing("new")}>Prüfung / Abgabe</Button>
          <Button quiet icon={Sparkles} onPress={() => setImporting(true)}>Module importieren</Button>
          <Button quiet icon={CalendarCheck} onPress={() => setWeekPlan(true)}>Woche planen</Button>
        </View>
      </View>

      <View style={{ gap: 22 }}>
        <TodayPlan />
        <View>
          <View style={[s.sectionHeading, { marginBottom: 14 }]}>
            <View style={s.row}>
              <Text style={s.h2}>Klausuren & Abgaben</Text>
              <Pill>{upcoming.length}</Pill>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setEditing("new")} style={s.row}>
              <Plus size={15} color={C.green} />
              <Text style={s.link}>Hinzufügen</Text>
            </Pressable>
          </View>
          {statuses.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {statuses.map((x) => (
                <View key={x.exam.id} style={{ flexBasis: width >= 1000 ? "48%" : "100%", flexGrow: 1, opacity: x.days < 0 ? 0.5 : 1 }}>
                  <ExamCard status={x} edit={(e) => setEditing(e)} />
                </View>
              ))}
            </View>
          ) : (
            <View style={[s.card, s.empty]}>
              <Flag size={30} color="#B9A2F2" />
              <Text style={s.h3}>Noch keine Prüfungen eingetragen</Text>
              <Text style={[s.muted, { textAlign: "center", maxWidth: 420, lineHeight: 19 }]}>
                Trag Datum und geschätzten Lernaufwand ein. Hap rechnet dein Tagespensum aus, schlägt freie Lernblöcke zwischen den Vorlesungen vor und erinnert dich rechtzeitig.
              </Text>
              <Button icon={Plus} onPress={() => setEditing("new")}>Erste Prüfung anlegen</Button>
            </View>
          )}
          {untracked.length > 0 && (
            <View style={[s.notice, { marginTop: 16, gap: 10 }]}>
              <Text style={s.h3}>Fächer aus deinem Stundenplan</Text>
              <Text style={s.micro}>Tippe ein Fach an, um seine Prüfung vorzubereiten.</Text>
              <View style={s.wrap}>
                {untracked.slice(0, 10).map((t) => (
                  <Chip
                    key={t}
                    label={"+ " + t}
                    active={false}
                    onPress={() =>
                      setEditing({
                        id: "",
                        title: t,
                        kind: "exam",
                        date: examWeek?.date || shiftDay(today, 30),
                        time: "",
                        hours: 25,
                        topics: [],
                        note: "",
                      })
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={[s.card, { padding: 24 }]}>
          <Heading detail="diese Woche">Zeitbild</Heading>
          <Text style={[s.micro, { marginTop: 6, marginBottom: 18 }]}>Wohin deine Stunden gehen: Vorlesungen, Fokuszeit, Training und erledigte Aufgaben.</Text>
          <TimePicture state={state} today={today} />
        </View>

        <View style={[s.card, { padding: 24, gap: 16 }]}>
          <Heading detail={hoursLabel(heat.reduce((n, d) => n + d.minutes, 0)) + " in 16 Wochen"}>Fokus-Heatmap</Heading>
          <View style={{ overflow: "hidden" }}>
            <Heatmap data={heat} />
          </View>
          <Text style={s.micro}>Jedes Kästchen ist ein Tag. Je kräftiger, desto mehr Fokuszeit. Ab 25 Minuten zählt der Tag zur Lernserie.</Text>
        </View>

        <View style={[s.card, { padding: 22, gap: 12 }]}>
          <View style={s.sectionHeading}>
            <View style={s.row}>
              <Brain size={17} color="#B9A2F2" />
              <Text style={s.h3}>Stundenplan (Rapla)</Text>
            </View>
            <Button quiet icon={RefreshCw} disabled={uniSyncing} onPress={() => void (state.raplaUrl ? syncUni() : router.push("/settings"))}>
              {state.raplaUrl ? (uniSyncing ? "Lädt …" : "Neu laden") : "Verbinden"}
            </Button>
          </View>
          <Text style={[s.micro, { lineHeight: 18 }]}>
            {uniStatus ||
              (state.uniSynced
                ? state.uniEvents.length + " Termine · zuletzt " + new Date(state.uniSynced).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
                : "Verbinde deinen DHBW-Rapla-Link in den Einstellungen, damit Vorlesungen automatisch im Kalender erscheinen.")}
          </Text>
          <View style={s.row}>
            <AlarmClock size={14} color={C.muted} />
            <Text style={s.micro}>Erinnerungen 15 Min. vor jeder Vorlesung – in den Einstellungen anpassbar.</Text>
          </View>
        </View>
      </View>
      {importing && <ModuleImport close={() => setImporting(false)} />}
      {weekPlan && <WeekPlanSheet close={() => setWeekPlan(false)} />}
      {editing && <ExamEditor exam={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
    </>
  );
}

export function StudyScreen() {
  return (
    <Shell title="Lernen" subtitle="Klausuren, Abgaben, Fokuszeit – mit Plan statt Panik.">
      <StudyContent />
    </Shell>
  );
}
