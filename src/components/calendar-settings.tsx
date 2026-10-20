import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarPlus, ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react-native";
import { dateKey, newId } from "@/lib/planner";
import { normalizeCalendarUrl } from "@/lib/ics";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, Chip, Field, Heading, s } from "./planner-ui";

const colors = ["#5EC2B7", "#F2C14E", "#7FB3FF", "#F28BB5", "#A0D468", "#FF9F6B"];
const leads = [
  [0, "Keine"],
  [15, "15 Min."],
  [30, "30 Min."],
  [60, "1 Std."],
  [180, "3 Std."],
] as const;

const help = [
  ["iPhone / iCloud", "Kalender-App → „Kalender“ → ⓘ neben dem Kalender → „Öffentlicher Kalender“ einschalten → „Link teilen“ → kopieren. Tipp: eigenen Kalender „Reisen“ anlegen und im DB Navigator „In Kalender übernehmen“ wählen."],
  ["Google", "calendar.google.com → Einstellungen → Kalender auswählen → „Privatadresse im iCal-Format“ kopieren."],
  ["Outlook", "Einstellungen → Kalender → Freigegebene Kalender → „Kalender veröffentlichen“ → ICS-Link kopieren."],
  ["TripIt (Flüge & Bahn)", "Buchungsmails an plans@tripit.com weiterleiten → in TripIt unter Einstellungen „Calendar Feed“ den Link kopieren."],
];

export function CalendarSettings() {
  const { state, update, syncCalendars, calSyncing } = usePlanner();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(colors[0]);
  const [lead, setLead] = useState(0);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [howto, setHowto] = useState(false);
  const [confirm, setConfirm] = useState("");
  const today = dateKey();
  function add() {
    const link = normalizeCalendarUrl(url);
    if (!link) return setError("Der Link muss mit https:// oder webcal:// beginnen.");
    if (state.calendars.some((c) => normalizeCalendarUrl(c.url) === link)) return setError("Diesen Kalender hast du schon abonniert.");
    const cal = { id: newId("cal"), name: name.trim() || "Kalender", url: link, color, lead, syncedAt: "", error: "" };
    tap("success");
    update((prev) => ({ ...prev, calendars: [...prev.calendars, cal] }));
    setName("");
    setUrl("");
    setError("");
    setAdding(false);
    // Load right away instead of waiting for the next automatic refresh.
    setTimeout(() => void syncCalendars(cal), 50);
  }
  return (
    <View style={[s.card, { padding: 26, gap: 16 }]}>
      <View style={s.row}>
        <CalendarPlus size={20} color={C.green} />
        <Heading>Kalender-Abos</Heading>
      </View>
      <Text style={[s.body, { color: C.muted, lineHeight: 22 }]}>
        Reisen, Google-, Outlook- oder iCloud-Kalender: Termine erscheinen automatisch in deinem Zeitplan und werden alle 2 Stunden aktualisiert.
      </Text>
      {state.calendars.map((cal) => {
        const upcoming = state.calEvents.filter((e) => e.calId === cal.id && e.date >= today).length;
        return (
          <View key={cal.id} style={{ gap: 10, padding: 14, borderRadius: 12, backgroundColor: "#202127" }}>
            <View style={s.row}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cal.color }} />
              <Text style={[s.h3, { flex: 1 }]} numberOfLines={1}>
                {cal.name}
              </Text>
              <Pressable accessibilityLabel={cal.name + " neu laden"} hitSlop={8} disabled={calSyncing} onPress={() => void syncCalendars(cal.id)}>
                <RefreshCw size={16} color={C.muted} />
              </Pressable>
              <Pressable accessibilityLabel={cal.name + " entfernen"} hitSlop={8} onPress={() => setConfirm(confirm === cal.id ? "" : cal.id)}>
                <Trash2 size={16} color="#EC939B" />
              </Pressable>
            </View>
            <Text style={[s.micro, cal.error ? { color: "#F2A0A5" } : null]}>
              {cal.error ||
                (cal.syncedAt
                  ? upcoming + " kommende Termine · aktualisiert " + new Date(cal.syncedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
                  : calSyncing
                    ? "Wird geladen …"
                    : "Noch nicht geladen")}
            </Text>
            <View style={s.wrap}>
              <Text style={[s.micro, { alignSelf: "center" }]}>Erinnern:</Text>
              {leads.map(([m, label]) => (
                <Chip
                  key={m}
                  label={label}
                  active={cal.lead === m}
                  color={cal.color}
                  onPress={() => update((prev) => ({ ...prev, calendars: prev.calendars.map((c) => (c.id === cal.id ? { ...c, lead: m } : c)) }))}
                />
              ))}
            </View>
            {confirm === cal.id && (
              <Button
                quiet
                danger
                onPress={() =>
                  update((prev) => ({
                    ...prev,
                    calendars: prev.calendars.filter((c) => c.id !== cal.id),
                    calEvents: prev.calEvents.filter((e) => e.calId !== cal.id),
                  }))
                }
              >
                Abo „{cal.name}“ entfernen
              </Button>
            )}
          </View>
        );
      })}
      {adding ? (
        <View style={{ gap: 14 }}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Reisen" maxLength={40} />
          <Field label="Kalender-Link (iCal)" value={url} onChangeText={setUrl} placeholder="webcal://… oder https://….ics" autoCapitalize="none" autoCorrect={false} />
          <View>
            <Text style={s.label}>Farbe</Text>
            <View style={s.wrap}>
              {colors.map((c) => (
                <Pressable
                  key={c}
                  accessibilityLabel={"Farbe " + c}
                  onPress={() => setColor(c)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: color === c ? "white" : "transparent" }}
                />
              ))}
            </View>
          </View>
          <View>
            <Text style={s.label}>Erinnern vor jedem Termin</Text>
            <View style={s.wrap}>
              {leads.map(([m, label]) => (
                <Chip key={m} label={label} active={lead === m} onPress={() => setLead(m)} />
              ))}
            </View>
            <Text style={[s.micro, { marginTop: 6 }]}>Für Flüge eignen sich 3 Std., für Züge 30 Min.</Text>
          </View>
          {error ? <Text style={s.formError}>{error}</Text> : null}
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <Button icon={CalendarPlus} onPress={add}>
              Abonnieren
            </Button>
            <Button quiet onPress={() => setAdding(false)}>
              Abbrechen
            </Button>
          </View>
        </View>
      ) : (
        <Button quiet icon={CalendarPlus} onPress={() => setAdding(true)}>
          Kalender abonnieren
        </Button>
      )}
      <Pressable accessibilityRole="button" onPress={() => setHowto(!howto)} style={s.row}>
        {howto ? <ChevronDown size={15} color={C.green} /> : <ChevronRight size={15} color={C.green} />}
        <Text style={s.link}>Wo finde ich den Link?</Text>
      </Pressable>
      {howto && (
        <View style={{ gap: 12 }}>
          {help.map(([title, text]) => (
            <View key={title}>
              <Text style={s.h3}>{title}</Text>
              <Text style={[s.micro, { lineHeight: 18, marginTop: 4 }]}>{text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
