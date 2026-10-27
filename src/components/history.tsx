import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp, Lightbulb, ThumbsUp } from "lucide-react-native";
import { categories, parseDate, shiftDay } from "@/lib/planner";
import { volume } from "@/lib/training";
import {
  exerciseTrends,
  foodDays,
  foodInsights,
  foodSummary,
  measuredNeed,
  trainingInsights,
  trainingWeeks,
  weightGoal,
  weightTrend,
  type Insight,
} from "@/lib/progress";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { BarChart, Sparkline } from "./charts";
import { Button, C, Chip, Sheet, s, useToday } from "./planner-ui";

const sport = categories.sport.color;
const food = "#98C5A9";
const num = (n: number, digits = 1) => String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");
const signed = (n: number, digits = 1) => (n > 0 ? "+" : n < 0 ? "−" : "±") + num(Math.abs(n), digits);
const short = (d: string) => parseDate(d).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
const long = (d: string) => parseDate(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });

function Range({ options, value, set, color }: { options: { days: number; label: string }[]; value: number; set: (n: number) => void; color: string }) {
  return (
    <View style={s.wrap}>
      {options.map((o) => (
        <Chip key={o.days} label={o.label} active={value === o.days} color={color} onPress={() => set(o.days)} />
      ))}
    </View>
  );
}

export function Tiles({ items }: { items: { label: string; value: string; detail?: string; color?: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map((t) => (
        <View key={t.label} style={{ flexGrow: 1, flexBasis: "45%", padding: 14, borderRadius: 14, backgroundColor: "#17171B", gap: 3 }}>
          <Text style={s.micro}>{t.label}</Text>
          <Text style={[s.h2, { fontSize: 22 }, t.color ? { color: t.color } : null]}>{t.value}</Text>
          {t.detail ? <Text style={s.micro}>{t.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Section({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={[s.row, { justifyContent: "space-between", alignItems: "baseline" }]}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#6F6D76", letterSpacing: 1.4 }}>{title.toUpperCase()}</Text>
        {detail ? <Text style={s.micro}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Tips({ list, title = "Was du verbessern kannst" }: { list: Insight[]; title?: string }) {
  if (!list.length) return null;
  return (
    <Section title={title}>
      {list.map((i) => (
        <View key={i.text} style={[s.row, { alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 14, backgroundColor: i.tone === "good" ? "#1B2620" : "#2B1F1C" }]}>
          {i.tone === "good" ? <ThumbsUp size={16} color={food} /> : <Lightbulb size={16} color={C.green} />}
          <Text style={[s.body, { flex: 1, fontSize: 14, lineHeight: 20 }]}>{i.text}</Text>
        </View>
      ))}
    </Section>
  );
}

function Expandable({ open, toggle, head, children }: { open: boolean; toggle: () => void; head: ReactNode; children: ReactNode }) {
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={toggle} style={[s.row, { paddingVertical: 12, gap: 10 }]}>
        <View style={{ flex: 1 }}>{head}</View>
        <Icon size={16} color={C.muted} />
      </Pressable>
      {open ? <View style={{ paddingBottom: 12, gap: 6 }}>{children}</View> : null}
    </View>
  );
}

const edgeLabels = (dates: string[]) => (dates.length ? [short(dates[0]), short(dates[Math.floor(dates.length / 2)]), short(dates[dates.length - 1])] : []);

export function TrainingHistorySheet({ close }: { close: () => void }) {
  const { state } = usePlanner();
  const today = useToday();
  const [range, setRange] = useState(91);
  const [picked, setPicked] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const from = shiftDay(today, -range + 1);
  const logs = state.workoutLogs.filter((l) => l.date >= from && l.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const before = state.workoutLogs.filter((l) => l.date >= shiftDay(from, -range) && l.date < from);
  const weeks = trainingWeeks(state, today, Math.max(4, Math.round(range / 7)));
  const total = logs.reduce((n, l) => n + volume(l), 0);
  const trends = exerciseTrends(state, today, range);
  const chosen = trends.find((t) => t.name === picked) || trends[0];
  const weight = weightTrend(state, today, range);
  const [low, high] = weightGoal[state.profile.goal];
  const done = weeks.reduce((n, w) => n + w.done, 0);
  return (
    <Sheet title="Training: Entwicklung" subtitle="Dein Verlauf, Bestwerte und was du verbessern kannst." close={close}>
      <Range options={[{ days: 28, label: "4 Wochen" }, { days: 91, label: "3 Monate" }, { days: 365, label: "1 Jahr" }]} value={range} set={setRange} color={sport} />
      <Tiles
        items={[
          { label: "Trainings", value: String(logs.length), detail: before.length ? signed(logs.length - before.length, 0) + " zum Zeitraum davor" : undefined },
          { label: "Bewegtes Gewicht", value: total >= 1000 ? num(total / 1000) + " t" : Math.round(total) + " kg" },
          { label: "Ø Dauer", value: logs.length ? Math.round(logs.reduce((n, l) => n + l.minutes, 0) / logs.length) + " Min." : "–" },
          {
            label: "Körpergewicht",
            value: weight.points.length ? num(weight.points[weight.points.length - 1].kg) + " kg" : state.profile.weight + " kg",
            detail: weight.perWeek !== null ? signed(weight.perWeek, 2) + " kg/Woche" : undefined,
            color: weight.perWeek === null ? undefined : weight.perWeek >= low && weight.perWeek <= high ? food : C.green,
          },
        ]}
      />
      <Tips list={trainingInsights(state, today)} />
      <Section title="Volumen pro Woche" detail={"Ø " + num(done / weeks.length) + " Trainings/Woche"}>
        <BarChart
          color={sport}
          data={weeks.map((w) => ({ value: w.volume, dim: w.planned > 0 && w.done < w.planned, label: "Woche ab " + short(w.start) + ": " + w.done + " von " + w.planned + " Trainings, " + w.volume + " kg" }))}
          labels={edgeLabels(weeks.map((w) => w.start))}
        />
        <Text style={s.micro}>Blasse Balken: nicht alle geplanten Trainings geschafft.</Text>
      </Section>
      {chosen ? (
        <Section title="Kraft (geschätztes 1RM)" detail={chosen.name + " · Bestwert " + num(chosen.best) + " kg"}>
          <Sparkline values={chosen.points.map((p) => p.best)} color={sport} />
          {trends.map((t) => (
            <Pressable
              key={t.name}
              accessibilityRole="button"
              accessibilityState={{ selected: t.name === chosen.name }}
              onPress={() => setPicked(t.name)}
              style={[s.row, { paddingVertical: 9, gap: 10, borderBottomWidth: 1, borderBottomColor: C.line }]}
            >
              <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: t.name === chosen.name ? sport : "transparent" }} />
              <View style={{ flex: 1 }}>
                <Text style={[s.body, { fontWeight: "600" }]} numberOfLines={1}>{t.name}</Text>
                <Text style={s.micro}>
                  {t.sessions}× trainiert{t.stalled ? " · stagniert" : ""}{t.bestDate >= from ? " · Bestwert am " + short(t.bestDate) : ""}
                </Text>
              </View>
              <Text style={[s.h3, { color: t.change > 0 ? food : t.change < 0 ? "#FF6B78" : C.muted }]}>{t.sessions > 1 ? signed(t.change) + " kg" : "–"}</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}
      <Section title="Körpergewicht" detail={"Ziel: " + signed(low, 2) + " bis " + signed(high, 2) + " kg/Woche"}>
        <Sparkline values={weight.points.map((p) => p.kg)} color="#92B9DB" />
      </Section>
      <Section title="Vergangene Trainings" detail={logs.length + " im Zeitraum"}>
        {logs.length ? (
          <View>
            {logs.map((l) => (
              <Expandable
                key={l.id}
                open={open === l.id}
                toggle={() => setOpen(open === l.id ? null : l.id)}
                head={
                  <>
                    <Text style={[s.body, { fontWeight: "600" }]}>{l.name}</Text>
                    <Text style={s.micro}>{long(l.date)} · {l.minutes} Min. · {Math.round(volume(l))} kg</Text>
                  </>
                }
              >
                {l.entries.filter((e) => e.sets.length).map((e) => (
                  <View key={e.exerciseId + e.name} style={[s.row, { alignItems: "flex-start", gap: 10 }]}>
                    <Text style={[s.micro, { flex: 1, color: C.ink }]}>{e.name}</Text>
                    <Text style={[s.micro, { flex: 1.4, textAlign: "right" }]}>
                      {e.sets.map((x) => (x.weight ? num(x.weight) + "×" + x.reps : x.reps + " Wdh.")).join("  ")}
                    </Text>
                  </View>
                ))}
              </Expandable>
            ))}
          </View>
        ) : (
          <Text style={s.micro}>In diesem Zeitraum hast du noch kein Training abgeschlossen.</Text>
        )}
      </Section>
    </Sheet>
  );
}

export function FoodHistorySheet({ close }: { close: () => void }) {
  const { state, update } = usePlanner();
  const today = useToday();
  const [range, setRange] = useState(30);
  const [open, setOpen] = useState<string | null>(null);
  const list = foodDays(state, today, range);
  const sum = foodSummary(list.slice(0, -1).length ? list.slice(0, -1) : list); // today is not over yet
  const need = measuredNeed(state, today);
  const offset = state.profile.kcalOffset || 0;
  const labels = edgeLabels(list.map((d) => d.date));
  const past = [...list].reverse().filter((d) => d.logged || d.protein);
  const setOffset = (value: number) => {
    tap("success");
    update((prev) => ({ ...prev, profile: { ...prev.profile, kcalOffset: value || undefined } }));
  };
  return (
    <Sheet title="Essen: Entwicklung" subtitle="Kalorien und Protein im Verlauf – und dein echter Bedarf." close={close}>
      <Range options={[{ days: 7, label: "7 Tage" }, { days: 30, label: "30 Tage" }, { days: 90, label: "90 Tage" }]} value={range} set={setRange} color={food} />
      <Tiles
        items={[
          { label: "Ø Kalorien", value: sum.logged ? String(sum.kcal) : "–", detail: "Ziel " + sum.target + " kcal" },
          { label: "Ø Protein", value: sum.logged ? sum.protein + " g" : "–", detail: "Ziel " + sum.proteinTarget + " g", color: sum.logged && sum.protein >= sum.proteinTarget * 0.9 ? food : undefined },
          { label: "Eingetragen", value: sum.logged + " / " + sum.days, detail: "Tage (ohne heute)" },
          { label: "Protein erreicht", value: sum.proteinHit + " Tage", detail: sum.onTarget + " Tage Kalorien im Ziel" },
        ]}
      />
      <Tips list={foodInsights(state, today)} />
      <Section title="Kalorien pro Tag" detail="Strich = Tagesziel">
        <BarChart color={food} data={list.map((d) => ({ value: d.logged ? d.kcal : 0, target: d.target.kcal, label: long(d.date) + ": " + (d.logged ? d.kcal + " von " + d.target.kcal + " kcal" : "nichts eingetragen") }))} labels={labels} />
      </Section>
      <Section title="Protein pro Tag" detail="Strich = Tagesziel">
        <BarChart color="#E5B073" height={90} data={list.map((d) => ({ value: d.protein, target: d.target.protein, label: long(d.date) + ": " + d.protein + " von " + d.target.protein + " g Protein" }))} labels={labels} />
      </Section>
      <Section title="Dein echter Bedarf">
        {need ? (
          <View style={{ gap: 10 }}>
            <Text style={[s.body, { fontSize: 14, lineHeight: 21 }]}>
              Die letzten 4 Wochen hast du im Schnitt <Text style={{ fontWeight: "700" }}>{need.eaten} kcal</Text> gegessen und dein Gewicht hat sich um {signed(need.perWeek, 2)} kg/Woche verändert. Damit liegt dein Erhaltungsbedarf bei etwa{" "}
              <Text style={{ fontWeight: "700", color: food }}>{need.need} kcal</Text> – die Formel schätzt {need.formula} kcal.
            </Text>
            {Math.abs(need.offset - offset) >= 50 ? (
              <Button onPress={() => setOffset(need.offset)}>Ziele anpassen ({signed(need.offset, 0)} kcal)</Button>
            ) : null}
          </View>
        ) : (
          <Text style={[s.micro, { lineHeight: 18 }]}>
            Trag mindestens 14 Tage dein Essen und über 2 Wochen 3× dein Gewicht ein (Training → Körpergewicht). Dann berechnet Hap aus deinen echten Daten, wie viel du wirklich brauchst – genauer als jede Formel.
          </Text>
        )}
        {offset ? (
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.micro}>Korrektur aktiv: {signed(offset, 0)} kcal pro Tag</Text>
            <Button quiet onPress={() => setOffset(0)}>Zurücksetzen</Button>
          </View>
        ) : null}
      </Section>
      <Section title="Vergangene Tage" detail={past.length + " mit Einträgen"}>
        {past.length ? (
          <View>
            {past.map((d) => {
              const entries = state.foodLog.filter((f) => f.date === d.date).sort((a, b) => a.time.localeCompare(b.time));
              return (
                <Expandable
                  key={d.date}
                  open={open === d.date}
                  toggle={() => setOpen(open === d.date ? null : d.date)}
                  head={
                    <>
                      <Text style={[s.body, { fontWeight: "600" }]}>{d.date === today ? "Heute" : long(d.date)}</Text>
                      <Text style={s.micro}>
                        {d.kcal} / {d.target.kcal} kcal · {d.protein} / {d.target.protein} g Protein{d.training ? " · Trainingstag" : ""}
                      </Text>
                    </>
                  }
                >
                  {entries.map((f) => (
                    <View key={f.id} style={[s.row, { gap: 10 }]}>
                      <Text style={[s.micro, { width: 40 }]}>{f.time}</Text>
                      <Text style={[s.micro, { flex: 1, color: C.ink }]} numberOfLines={1}>{f.name}</Text>
                      <Text style={s.micro}>{f.kcal} kcal · P {f.protein} g</Text>
                    </View>
                  ))}
                  {state.protein[d.date] ? <Text style={s.micro}>+ {state.protein[d.date]} g Protein (Schnell-Buttons)</Text> : null}
                </Expandable>
              );
            })}
          </View>
        ) : (
          <Text style={s.micro}>In diesem Zeitraum ist noch nichts eingetragen.</Text>
        )}
      </Section>
    </Sheet>
  );
}
