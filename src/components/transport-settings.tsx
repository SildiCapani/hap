import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Check, Footprints, Plus, TrainFront, Trash2 } from "lucide-react-native";
import { newId, type Place } from "@/lib/planner";
import { modeLabel, placePresets } from "@/lib/transport";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, Chip, Field, Heading, s } from "./planner-ui";

function PlaceEditor({ place, close }: { place?: Place; close: () => void }) {
  const { update } = usePlanner();
  const [name, setName] = useState(place?.name || "");
  const [mins, setMins] = useState(String(place?.minutes ?? 20));
  const [mode, setMode] = useState<Place["mode"]>(place?.mode || "transit");
  const [keywords, setKeywords] = useState(place?.keywords.join(", ") || "");
  const [lectures, setLectures] = useState(place?.lectures || false);
  const [training, setTraining] = useState(place?.training || false);
  const [error, setError] = useState("");
  function save() {
    const minutes = Number(mins);
    if (!name.trim()) return setError("Wie heißt der Ort?");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) return setError("Wegzeit zwischen 1 und 300 Minuten.");
    const next: Place = {
      id: place?.id || newId("place"),
      name: name.trim(),
      minutes,
      mode,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      lectures,
      training,
    };
    tap("success");
    update((prev) => ({
      ...prev,
      // Only one place can host the lectures or the workouts.
      places: [...prev.places.filter((p) => p.id !== next.id), next].map((p) =>
        p.id === next.id ? p : { ...p, lectures: next.lectures ? false : p.lectures, training: next.training ? false : p.training },
      ),
    }));
    close();
  }
  return (
    <View style={{ gap: 14, padding: 14, borderRadius: 12, backgroundColor: "#202127" }}>
      <View style={s.row}>
        <View style={{ flex: 2 }}>
          <Field label="Ort" value={name} onChangeText={setName} placeholder="z. B. DHBW" maxLength={40} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Min. von zu Hause" value={mins} onChangeText={setMins} keyboardType="numeric" maxLength={3} />
        </View>
      </View>
      <View style={s.wrap}>
        {(Object.keys(modeLabel) as Place["mode"][]).map((m) => (
          <Chip key={m} label={modeLabel[m]} active={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>
      <Field
        label="Erkennen an (Stichwörter im Ort oder Titel, mit Komma)"
        value={keywords}
        onChangeText={setKeywords}
        placeholder="z. B. LE1, DHBW, Lerchenstraße"
        autoCapitalize="none"
      />
      <View style={s.sectionHeading}>
        <Text style={[s.body, { flex: 1 }]}>Hier finden meine Vorlesungen statt</Text>
        <Switch value={lectures} onValueChange={setLectures} trackColor={{ false: "#49434F", true: "#BC5568" }} thumbColor="white" />
      </View>
      <View style={s.sectionHeading}>
        <Text style={[s.body, { flex: 1 }]}>Hier trainiere ich</Text>
        <Switch value={training} onValueChange={setTraining} trackColor={{ false: "#49434F", true: "#BC5568" }} thumbColor="white" />
      </View>
      {error ? <Text style={s.formError}>{error}</Text> : null}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Button icon={Check} onPress={save}>
          Speichern
        </Button>
        <Button quiet onPress={close}>
          Abbrechen
        </Button>
        {place && (
          <Button
            quiet
            danger
            icon={Trash2}
            onPress={() => {
              update((prev) => ({
                ...prev,
                places: prev.places.filter((p) => p.id !== place.id),
                tasks: prev.tasks.map((t) => (t.placeId === place.id ? { ...t, placeId: undefined } : t)),
              }));
              close();
            }}
          >
            Löschen
          </Button>
        )}
      </View>
    </View>
  );
}

export function TransportSettings() {
  const { state, update } = usePlanner();
  const t = state.transport;
  const [editing, setEditing] = useState<Place | "new" | null>(null);
  const set = (patch: Partial<typeof t>) => update((prev) => ({ ...prev, transport: { ...prev.transport, ...patch } }));
  return (
    <View style={[s.card, { padding: 26, gap: 16 }]}>
      <View style={s.row}>
        <TrainFront size={20} color="#8FA3C8" />
        <Heading>Wege & Orte</Heading>
      </View>
      <View style={s.sectionHeading}>
        <View style={{ flex: 1, marginRight: 18 }}>
          <Text style={s.h3}>Wege automatisch planen</Text>
          <Text style={[s.muted, { lineHeight: 20, marginTop: 6 }]}>
            Hap setzt vor jeden Termin einen Weg-Block mit „Losgehen um …“, plant in langen Pausen den Heimweg ein und warnt bei zu knappen Wechseln.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Wege automatisch planen"
          value={t.enabled}
          onValueChange={(enabled) => {
            update((prev) => ({
              ...prev,
              transport: { ...prev.transport, enabled },
              // First start: suggest typical places that can be adjusted.
              places: enabled && !prev.places.length ? placePresets.map((p) => ({ ...p, id: newId("place") })) : prev.places,
            }));
          }}
          trackColor={{ false: "#49434F", true: "#BC5568" }}
          thumbColor="white"
        />
      </View>
      {t.enabled && (
        <>
          <View>
            <Text style={s.label}>Puffer (ankommen vor Beginn)</Text>
            <View style={s.wrap}>
              {[0, 5, 10, 15].map((m) => (
                <Chip key={m} label={m ? m + " Min." : "Kein"} active={t.buffer === m} onPress={() => set({ buffer: m })} />
              ))}
            </View>
          </View>
          <View>
            <Text style={s.label}>Erinnerung vor dem Losgehen</Text>
            <View style={s.wrap}>
              {[-1, 0, 5, 10, 15].map((m) => (
                <Chip key={m} label={m < 0 ? "Aus" : m ? m + " Min. vorher" : "Pünktlich"} active={t.remind === m} onPress={() => set({ remind: m })} />
              ))}
            </View>
          </View>
          <Text style={s.label}>Deine Orte (Wegzeit von zu Hause)</Text>
          {state.places.map((p) =>
            editing !== "new" && editing?.id === p.id ? (
              <PlaceEditor key={p.id} place={p} close={() => setEditing(null)} />
            ) : (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => setEditing(p)} style={[s.row, { padding: 12, borderRadius: 10, backgroundColor: "#202127" }]}>
                {p.mode === "walk" ? <Footprints size={16} color="#8FA3C8" /> : <TrainFront size={16} color="#8FA3C8" />}
                <View style={{ flex: 1 }}>
                  <Text style={s.h3}>{p.name}</Text>
                  <Text style={[s.micro, { marginTop: 2 }]} numberOfLines={1}>
                    {[p.lectures && "Vorlesungen", p.training && "Training", p.keywords.join(", ")].filter(Boolean).join(" · ") || "Für Aufgaben wählbar"}
                  </Text>
                </View>
                <Text style={[s.h3, { color: "#8FA3C8" }]}>{p.minutes} Min.</Text>
              </Pressable>
            ),
          )}
          {editing === "new" ? (
            <PlaceEditor close={() => setEditing(null)} />
          ) : (
            <Button quiet icon={Plus} onPress={() => setEditing("new")}>
              Ort hinzufügen
            </Button>
          )}
          <Text style={[s.micro, { lineHeight: 18 }]}>
            Vorlesungen landen am Ort mit „Vorlesungen“, Training am Ort mit „Training“, Kalender-Termine über die Stichwörter. Bei Aufgaben wählst du den Ort im Bearbeiten-Dialog. Zwischen zwei Orten schätzt Hap die längere der beiden Wegzeiten.
          </Text>
        </>
      )}
    </View>
  );
}
