import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import type { Goal } from "@/lib/planner";
import { goals } from "@/lib/training";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, Chip, Field, Sheet, s } from "./planner-ui";

export function ProfileSheet({ close }: { close: () => void }) {
  const { state, update, pushProfile } = usePlanner();
  const p = state.profile;
  const [age, setAge] = useState(String(p.age));
  const [height, setHeight] = useState(String(p.height));
  const [weight, setWeight] = useState(String(p.weight));
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [male, setMale] = useState(p.male);
  const [diet, setDiet] = useState(p.diet);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function save() {
    const a = Number(age), h = Number(height), w = Number(weight.replace(",", "."));
    if (!(a >= 14 && a <= 99) || !(h >= 120 && h <= 230) || !(w >= 35 && w <= 250))
      return setMessage("Bitte realistische Werte für Alter, Größe und Gewicht eingeben.");
    // The store sends the profile to the meal planning on its own.
    update((prev) => ({ ...prev, profile: { age: a, height: h, weight: w, goal, male, diet: diet.trim() } }));
    tap("success");
    close();
  }
  return (
    <Sheet
      title="Dein Profil"
      subtitle="Für Kalorien- und Proteinziele und deinen Essensplan."
      close={close}
      footer={
        <>
          <Button quiet onPress={close}>Abbrechen</Button>
          <Button icon={Check} disabled={busy} onPress={save}>Speichern</Button>
        </>
      }
    >
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field label="Alter" value={age} onChangeText={setAge} keyboardType="numeric" maxLength={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Größe (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" maxLength={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Gewicht (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />
        </View>
      </View>
      <View>
        <Text style={s.label}>Geschlecht (für den Grundumsatz)</Text>
        <View style={s.wrap}>
          <Chip label="Männlich" active={male} onPress={() => setMale(true)} />
          <Chip label="Weiblich" active={!male} onPress={() => setMale(false)} />
        </View>
      </View>
      <View>
        <Text style={s.label}>Ziel</Text>
        <View style={s.wrap}>
          {(Object.keys(goals) as Goal[]).map((g) => (
            <Chip key={g} label={goals[g].label} active={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>
      </View>
      <Field
        label="Vorlieben & No-Gos fürs Essen"
        value={diet}
        onChangeText={setDiet}
        multiline
        placeholder="z. B. kein Fisch, wenig Zeit unter der Woche, Budget 60 €"
        maxLength={400}
      />
      {message ? <Text style={s.formError}>{message}</Text> : null}
      <Pressable
        onPress={() => {
          setBusy(true);
          void pushProfile().then((m) => {
            setMessage(m);
            setBusy(false);
          });
        }}
      >
        <Text style={s.link}>{busy ? "Wird gesendet …" : "Gespeichertes Profil jetzt an die Essensplanung senden"}</Text>
      </Pressable>
    </Sheet>
  );
}
