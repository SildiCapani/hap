import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Camera, Check, ImagePlus, PenLine, ScanBarcode, Sparkles, Trash2, TrendingUp, User, X } from "lucide-react-native";
import { localStamp, newId, type FoodEntry } from "@/lib/planner";
import { foodTotals, pickPhoto, scanFood, type FoodEstimate } from "@/lib/food";
import { goals, nutrition, workoutsFor } from "@/lib/training";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Bar } from "./charts";
import { Button, C, Field, Pill, Sheet, s, useToday } from "./planner-ui";
import { ProfileSheet } from "./profile-sheet";
import { TimeField } from "./pickers";
import { BarcodeSheet } from "./barcode";
import { FoodHistorySheet } from "./history";

const macros = [
  { key: "protein", label: "Protein", color: "#E5B073" },
  { key: "carbs", label: "Kohlenhydrate", color: "#92B9DB" },
  { key: "fat", label: "Fett", color: "#B9A2F2" },
] as const;

function KcalRing({ eaten, target, size = 150 }: { eaten: number; target: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const over = eaten > target;
  const fraction = Math.min(1, target ? eaten / target : 0);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#2A2B32" strokeWidth={12} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? "#FF6B78" : "#98C5A9"}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c + " " + c}
          strokeDashoffset={c * (1 - fraction)}
          transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
        />
      </Svg>
      <Text style={{ color: C.ink, fontSize: size < 140 ? 24 : 28, fontWeight: "800", letterSpacing: -1 }}>{Math.abs(target - eaten)}</Text>
      <Text style={s.micro}>{over ? "kcal drüber" : "kcal übrig"}</Text>
    </View>
  );
}

type Draft = Omit<FoodEntry, "id" | "date" | "source"> & { confidence?: string; hint?: string; image?: string };

function FoodSheet({ draft, entry, close, saved }: { draft: Draft; entry?: FoodEntry; close: () => void; saved?: () => void }) {
  const { update } = usePlanner();
  const today = useToday();
  const [name, setName] = useState(draft.name);
  const [items, setItems] = useState(draft.items);
  const [values, setValues] = useState({
    kcal: String(draft.kcal),
    protein: String(draft.protein),
    carbs: String(draft.carbs),
    fat: String(draft.fat),
  });
  const [time, setTime] = useState(draft.time);
  const [confirm, setConfirm] = useState(false);
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(",", ".")) || 0));
  function removeItem(i: number) {
    const item = items[i] as FoodEstimate["items"][number];
    setItems(items.filter((_, j) => j !== i));
    // Keep the totals in step with the remaining components.
    setValues((v) => ({
      kcal: String(Math.max(0, num(v.kcal) - item.kcal)),
      protein: String(Math.max(0, num(v.protein) - (item.protein || 0))),
      carbs: String(Math.max(0, num(v.carbs) - (item.carbs || 0))),
      fat: String(Math.max(0, num(v.fat) - (item.fat || 0))),
    }));
  }
  function save() {
    const next: FoodEntry = {
      id: entry?.id || newId("food"),
      date: entry?.date || today,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : localStamp().slice(11),
      name: name.trim() || "Mahlzeit",
      kcal: num(values.kcal),
      protein: num(values.protein),
      carbs: num(values.carbs),
      fat: num(values.fat),
      items: items.map((i) => ({ name: i.name, amount: i.amount, kcal: i.kcal })),
      source: entry?.source || (draft.image ? "photo" : "manual"),
    };
    tap("success");
    update((prev) => ({
      ...prev,
      foodLog: entry ? prev.foodLog.map((f) => (f.id === entry.id ? next : f)) : [...prev.foodLog, next],
    }));
    saved?.();
    close();
  }
  return (
    <Sheet
      title={entry ? "Mahlzeit bearbeiten" : "Mahlzeit speichern"}
      subtitle={draft.confidence ? "KI-Schätzung · Sicherheit: " + draft.confidence : undefined}
      close={close}
      footer={
        <>
          <Button quiet onPress={close}>Abbrechen</Button>
          <Button icon={Check} onPress={save}>Speichern</Button>
        </>
      }
    >
      {draft.image ? (
        <Image source={{ uri: draft.image }} accessibilityLabel="Foto der Mahlzeit" style={{ width: "100%", height: 180, borderRadius: 12 }} resizeMode="cover" />
      ) : null}
      {draft.hint ? (
        <View style={s.notice}>
          <Text style={[s.micro, { lineHeight: 17 }]}>💡 {draft.hint}</Text>
        </View>
      ) : null}
      <View style={s.row}>
        <View style={{ flex: 2 }}>
          <Field label="Gericht" value={name} onChangeText={setName} maxLength={80} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="Uhrzeit" value={time} onChange={setTime} />
        </View>
      </View>
      {items.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={s.label}>Erkannt</Text>
          {items.map((item, i) => (
            <View key={item.name + i} style={[s.row, { paddingVertical: 4 }]}>
              <Text style={[s.body, { flex: 1 }]}>
                {item.name} <Text style={s.micro}>{item.amount}</Text>
              </Text>
              <Text style={s.muted}>{item.kcal} kcal</Text>
              <Pressable accessibilityLabel={item.name + " entfernen"} hitSlop={8} onPress={() => removeItem(i)}>
                <X size={15} color={C.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {(
          [
            ["kcal", "Kalorien (kcal)"],
            ["protein", "Protein (g)"],
            ["carbs", "Kohlenhydrate (g)"],
            ["fat", "Fett (g)"],
          ] as const
        ).map(([k, label]) => (
          <View key={k} style={{ flexBasis: "46%", flexGrow: 1 }}>
            <Field label={label} value={values[k]} onChangeText={(v) => setValues({ ...values, [k]: v })} keyboardType="numeric" maxLength={5} />
          </View>
        ))}
      </View>
      {entry &&
        (!confirm ? (
          <Pressable onPress={() => setConfirm(true)} style={s.row}>
            <Trash2 size={15} color="#EC939B" />
            <Text style={{ color: "#EC939B", fontSize: 12 }}>Löschen</Text>
          </Pressable>
        ) : (
          <Button
            danger
            onPress={() => {
              update((prev) => ({ ...prev, foodLog: prev.foodLog.filter((f) => f.id !== entry.id) }));
              close();
            }}
          >
            Endgültig löschen
          </Button>
        ))}
    </Sheet>
  );
}

export function FoodTracker() {
  const { state } = usePlanner();
  const today = useToday();
  const [busy, setBusy] = useState<{ image?: string; label: string } | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ draft: Draft; entry?: FoodEntry } | null>(null);
  const [describe, setDescribe] = useState("");
  const [writing, setWriting] = useState(false);
  const [profile, setProfile] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState(false);
  const training = workoutsFor(state, today).length > 0;
  const target = nutrition(state.profile, training);
  const totals = foodTotals(state, today);
  const planned = state.mealPlan?.days.find((d) => d.date === today);

  async function analyse(input: { image?: string; note?: string }, label: string) {
    setError("");
    setBusy({ image: input.image, label });
    const result = await scanFood(state, input);
    setBusy(null);
    if (typeof result === "string") return setError(result);
    tap("success");
    setDraft({ draft: { ...result, time: localStamp().slice(11), image: input.image } });
  }
  async function photo(source: "camera" | "library") {
    try {
      const image = await pickPhoto(source);
      if (image) await analyse({ image, note: describe.trim() }, "KI schaut sich dein Essen an …");
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Das Foto konnte nicht geladen werden.");
    }
  }
  return (
    <View style={{ gap: 18 }}>
      <View style={[s.card, { padding: 20, gap: 16 }]}>
        <View style={[s.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
          <Pill>{training ? "Trainingstag" : "Ruhetag"}</Pill>
          <Pressable accessibilityRole="button" onPress={() => setHistory(true)} style={s.row}>
            <TrendingUp size={14} color={C.green} />
            <Text style={s.link}>Verlauf</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setProfile(true)} style={s.row}>
            <User size={14} color={C.green} />
            <Text style={s.link}>
              {goals[state.profile.goal].label} · {state.profile.weight} kg
            </Text>
          </Pressable>
        </View>
        <View style={[s.row, { gap: 16, flexWrap: "wrap", justifyContent: "center" }]}>
          <KcalRing eaten={totals.kcal} target={target.kcal} size={124} />
          <View style={{ flex: 1, minWidth: 140, gap: 10 }}>
            <Text style={s.body}>
              <Text style={{ fontWeight: "800", fontSize: 18 }}>{totals.kcal}</Text>
              <Text style={s.muted}> / {target.kcal} kcal</Text>
            </Text>
            {macros.map((m) => (
              <View key={m.key} style={{ gap: 5 }}>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Text style={s.micro}>{m.label}</Text>
                  <Text style={[s.micro, { color: C.ink }]}>
                    {totals[m.key]} / {target[m.key]} g
                  </Text>
                </View>
                <Bar value={totals[m.key] / Math.max(1, target[m.key])} color={m.color} height={7} />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[s.row, { gap: 8 }]}>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void photo("camera")} style={({ pressed }) => [st.action, { backgroundColor: C.button, opacity: pressed || busy ? 0.75 : 1 }]}>
          <Camera size={20} color={C.onAccent} />
          <Text style={st.actionText}>Foto</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void photo("library")} style={({ pressed }) => [st.action, { opacity: pressed || busy ? 0.75 : 1 }]}>
          <ImagePlus size={19} color={C.ink} />
          <Text style={[st.actionText, { color: C.ink }]}>Galerie</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setScanning(true)} style={({ pressed }) => [st.action, { opacity: pressed || busy ? 0.75 : 1 }]}>
          <ScanBarcode size={19} color={C.ink} />
          <Text style={[st.actionText, { color: C.ink }]}>Barcode</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setWriting(!writing)} style={({ pressed }) => [st.action, { opacity: pressed || busy ? 0.75 : 1 }, writing && { borderColor: C.green }]}>
          <PenLine size={19} color={C.ink} />
          <Text style={[st.actionText, { color: C.ink }]}>Text</Text>
        </Pressable>
      </View>
      {writing && (
        <Animated.View entering={FadeInDown} style={[s.card, { padding: 12, gap: 10 }]}>
          <TextInput
            value={describe}
            onChangeText={setDescribe}
            placeholder="z. B. „Mensa: Schnitzel mit Pommes und Salat“ – hilft auch beim Foto"
            placeholderTextColor="#7E7887"
            accessibilityLabel="Mahlzeit beschreiben"
            multiline
            style={[s.input, { minHeight: 64, textAlignVertical: "top" }]}
          />
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <Button icon={Sparkles} disabled={!describe.trim() || !!busy} onPress={() => void analyse({ note: describe.trim() }, "KI schätzt die Nährwerte …")}>
              Schätzen lassen
            </Button>
            <Button
              quiet
              onPress={() => setDraft({ draft: { name: describe.trim(), kcal: 0, protein: 0, carbs: 0, fat: 0, items: [], time: localStamp().slice(11) } })}
            >
              Selbst eintragen
            </Button>
          </View>
        </Animated.View>
      )}
      {busy && (
        <Animated.View entering={FadeIn} style={[s.card, s.row, { padding: 14, gap: 14 }]}>
          {busy.image ? <Image source={{ uri: busy.image }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : null}
          <ActivityIndicator color={C.green} />
          <Text style={[s.body, { flex: 1 }]}>{busy.label}</Text>
        </Animated.View>
      )}
      {error ? (
        <View style={s.notice}>
          <Text style={[s.body, { lineHeight: 21 }]}>{error}</Text>
        </View>
      ) : null}
      {planned && (
        <View style={{ gap: 8 }}>
          <Text style={s.micro}>Aus deinem Wochenplan – tippen zum Eintragen:</Text>
          <View style={s.wrap}>
            {[planned.breakfast, planned.lunch, planned.dinner].filter(Boolean).map((meal) => (
              <Pressable key={meal} disabled={!!busy} onPress={() => void analyse({ note: meal }, "KI schätzt „" + meal.slice(0, 30) + "“ …")} style={[s.filter, { maxWidth: "100%" }]}>
                <Text numberOfLines={1} style={s.filterText}>+ {meal}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <View>
        <Text style={[s.h3, { marginBottom: 10 }]}>Heute gegessen</Text>
        {totals.entries.length ? (
          <View style={s.card}>
            {[...totals.entries]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((f) => (
                <Animated.View key={f.id} layout={LinearTransition}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDraft({ draft: { ...f }, entry: f })}
                    style={[s.row, { padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: "#2A2B32" }]}
                  >
                    <Text style={[s.micro, { width: 40 }]}>{f.time}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.body, { fontSize: 15 }]} numberOfLines={1}>
                        {f.source === "photo" ? "📷 " : ""}
                        {f.name}
                      </Text>
                      <Text style={[s.micro, { marginTop: 3 }]}>
                        P {f.protein} g · K {f.carbs} g · F {f.fat} g
                      </Text>
                    </View>
                    <Text style={[s.h3, { color: "#98C5A9" }]}>{f.kcal}</Text>
                  </Pressable>
                </Animated.View>
              ))}
          </View>
        ) : (
          <View style={[s.card, s.empty]}>
            <Camera size={28} color={C.green} />
            <Text style={[s.muted, { textAlign: "center", lineHeight: 19 }]}>
              Mach ein Foto von deinem Essen – die KI schätzt Kalorien und Makros. Du kannst alles korrigieren.
            </Text>
          </View>
        )}
        <Text style={[s.micro, { marginTop: 10, lineHeight: 17 }]}>
          Schätzungen aus Fotos sind ±20–30 % genau (Öl und Soßen sieht man schlecht). Ziele nach Mifflin-St-Jeor – keine medizinische Beratung.
        </Text>
      </View>
      {draft && (
        <FoodSheet
          draft={draft.draft}
          entry={draft.entry}
          close={() => setDraft(null)}
          saved={() => {
            setDescribe("");
            setWriting(false);
          }}
        />
      )}
      {profile && <ProfileSheet close={() => setProfile(false)} />}
      {scanning && <BarcodeSheet close={() => setScanning(false)} />}
      {history && <FoodHistorySheet close={() => setHistory(false)} />}
    </View>
  );
}

const st = StyleSheet.create({
  action: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#22232A",
    borderWidth: 1,
    borderColor: C.line,
  },
  actionText: { color: C.onAccent, fontWeight: "700", fontSize: 13 },
});
