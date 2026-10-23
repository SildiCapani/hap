import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Check, FileUp, Video } from "lucide-react-native";
import { parseDate, repeats } from "@/lib/planner";
import { applyImport, icsToItems, type ImportItem } from "@/lib/icsImport";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, Sheet, s } from "./planner-ui";

async function readIcsFile(): Promise<string | null> {
  // iOS often reports invitations without a calendar type, so accept any file.
  const result = await DocumentPicker.getDocumentAsync({ type: ["text/calendar", "application/ics", "text/plain", "*/*"], copyToCacheDirectory: true, base64: false });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if ((asset.size || 0) > 2 * 1024 * 1024) throw new Error("Die Datei ist zu groß für eine Einladung.");
  const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Das ist keine Kalender-Datei (.ics).");
  return text;
}

// Pick an .ics file (Teams/Outlook invitation, ticket, …), preview its events
// and add them as normal tasks. Re-importing the same file updates them.
export function IcsImportSheet({ close }: { close: () => void }) {
  const { state, update } = usePlanner();
  const [items, setItems] = useState<(ImportItem & { on: boolean; exists: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick() {
    setError("");
    setBusy(true);
    try {
      const text = await readIcsFile();
      if (!text) return;
      const found = icsToItems(text, undefined, state.places);
      if (!found.length) return setError("In der Datei sind keine kommenden Termine.");
      setItems(
        found.map((i) => {
          const exists = state.tasks.some((t) => t.id === i.id || t.source === i.source);
          // A cancellation only matters for a meeting that is in the plan.
          return { ...i, exists, on: i.cancelled ? exists : true };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setBusy(false);
    }
  }
  const chosen = (items || []).filter((i) => i.on);
  function save() {
    tap("success");
    update((prev) => ({ ...prev, tasks: applyImport(prev.tasks, chosen) }));
    close();
  }
  return (
    <Sheet
      title="Termine importieren"
      subtitle="Eine .ics-Datei, z. B. eine Teams- oder Outlook-Einladung."
      close={close}
      footer={
        items ? (
          <>
            <Button quiet onPress={() => setItems(null)}>Andere Datei</Button>
            <Button icon={Check} disabled={!chosen.length} onPress={save}>
              {chosen.every((i) => i.cancelled) ? "Absage übernehmen" : chosen.length + (chosen.length === 1 ? " Termin" : " Termine") + " übernehmen"}
            </Button>
          </>
        ) : undefined
      }
    >
      {!items ? (
        <>
          <Button icon={FileUp} disabled={busy} onPress={() => void pick()}>
            .ics-Datei auswählen
          </Button>
          {busy ? <ActivityIndicator color={C.green} /> : null}
          <Text style={[s.micro, { lineHeight: 18 }]}>
            Auf dem iPhone: In Teams oder Mail den Anhang antippen → Teilen → „In Dateien sichern“. Danach hier die Datei auswählen. Die Termine werden zu normalen Aufgaben: verschiebbar, mit Erinnerung und auf allen Geräten.
          </Text>
        </>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((i, n) => (
            <Pressable
              key={i.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: i.on }}
              onPress={() => setItems(items.map((x, k) => (k === n ? { ...x, on: !x.on } : x)))}
              style={[s.row, { gap: 12, padding: 12, borderRadius: 14, backgroundColor: "#17171B" }]}
            >
              <View style={[s.checkbox, i.on && { backgroundColor: C.button, borderColor: C.button }]}>
                {i.on && <Check size={14} color={C.onAccent} strokeWidth={3} />}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.h3, i.cancelled && { textDecorationLine: "line-through", color: C.muted }]}>{i.title}</Text>
                <Text style={s.micro}>
                  {parseDate(i.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })} · {i.allDay ? "ganztägig" : i.time + " · " + i.duration + " Min."}
                  {i.repeat !== "none" ? " · " + repeats[i.repeat] : ""}
                </Text>
                {(i.organizer || i.attendees > 0 || i.alarm !== null || i.place) && !i.cancelled ? (
                  <Text style={s.micro} numberOfLines={2}>
                    {[
                      i.organizer && "von " + i.organizer,
                      i.attendees > 0 && i.attendees + " Teilnehmer",
                      i.alarm !== null && "Erinnerung " + (i.alarm ? i.alarm + " Min. vorher" : "pünktlich"),
                      i.place && "Ort: " + i.place + " (Weg wird geplant)",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
                {i.cancelled || i.tentative || i.exists ? (
                  <Text style={{ fontSize: 12, fontWeight: "600", color: i.cancelled ? "#FF6B78" : "#E5B073" }}>
                    {i.cancelled ? (i.exists ? "Abgesagt – wird aus dem Plan entfernt" : "Abgesagt – nicht im Plan") : i.exists ? "Schon im Plan – wird aktualisiert" : "Vorläufig zugesagt"}
                  </Text>
                ) : null}
              </View>
              {i.link ? <Video size={16} color={C.muted} /> : null}
            </Pressable>
          ))}
        </View>
      )}
      {error ? <Text style={s.formError}>{error}</Text> : null}
    </Sheet>
  );
}
