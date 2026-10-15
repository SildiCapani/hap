import { useState } from "react";
import { Platform, Pressable, Share, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import {
  ArrowDownToLine,
  Check,
  Coffee,
  Leaf,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Utensils,
} from "lucide-react-native";
import { dateKey, monday, parseDate, readState } from "@/lib/planner";
import { usePlanner } from "@/lib/store";
import {
  Button,
  C,
  Field,
  Heading,
  Pill,
  Shell,
  useToday,
  s,
} from "./planner-ui";

function MealsContent() {
  const { state, update, syncing, mealStatus, syncMeals } = usePlanner();
  const today = useToday();
  const [tab, setTab] = useState<"plan" | "groceries">("plan");
  const plan = state.mealPlan;
  return (
    <>
      <View style={[s.hero, { backgroundColor: "#27252D", padding: 29 }]}>
        <View style={{ flex: 1 }}>
          <Pill bg="#3B2934">DEINE WOCHE AUF DEM TELLER</Pill>
          <Text style={[s.h2, { marginTop: 18, fontSize: 26 }]}>
            Gut essen. Weniger planen.
          </Text>
          <Text
            style={[s.body, { color: "#B4A6B8", marginTop: 9, lineHeight: 23 }]}
          >
            Dein Wochenplan und eine Einkaufsliste, die mitdenkt.
          </Text>
        </View>
        <Utensils size={48} color="#CC929F" strokeWidth={1.1} />
      </View>
      <View
        style={[
          s.sectionHeading,
          { flexWrap: "wrap", gap: 12, marginBottom: 20 },
        ]}
      >
        <View style={s.row}>
          <Button quiet onPress={() => setTab("plan")} icon={Utensils}>
            Wochenplan
          </Button>
          <Button quiet onPress={() => setTab("groceries")} icon={ShoppingBag}>
            Einkaufsliste
          </Button>
        </View>
        <Button
          quiet
          onPress={() => void syncMeals()}
          disabled={syncing}
          icon={RefreshCw}
        >
          {syncing ? "Wird geladen …" : "Aktualisieren"}
        </Button>
      </View>
      {mealStatus ? (
        <View style={s.notice}>
          <Text style={[s.body, { lineHeight: 22 }]}>{mealStatus}</Text>
        </View>
      ) : null}
      {!plan ? (
        <View style={[s.card, s.empty, { paddingVertical: 50 }]}>
          <Leaf size={45} color="#C192A1" strokeWidth={1.3} />
          <Text style={[s.h2, { marginTop: 10, textAlign: "center" }]}>
            Hier zieht dein Essensplan ein.
          </Text>
          <Text
            style={[
              s.body,
              {
                color: C.muted,
                textAlign: "center",
                maxWidth: 460,
                lineHeight: 23,
              },
            ]}
          >
            Die automatische Erstellung ist vorbereitet. Nach der
            Netlify-Einrichtung kommt jede Woche dein neuer Plan hier an.
          </Text>
          <Button
            quiet
            onPress={() => router.push("/settings")}
            icon={Settings2}
          >
            Verbindung einrichten
          </Button>
        </View>
      ) : (
        <>
          {plan.weekStart !== monday(today) && (
            <View style={s.notice}>
              <Text style={s.body}>
                {plan.weekStart > today
                  ? "Der Plan für die kommende Woche ist schon da."
                  : "Du siehst einen älteren Plan. Aktualisiere ihn, sobald der neue erstellt wurde."}
              </Text>
            </View>
          )}
          <Heading
            detail={
              "Ab " + parseDate(plan.weekStart).toLocaleDateString("de-DE")
            }
          >
            {tab === "plan"
              ? "Für jeden Tag etwas Gutes"
              : String(
                  plan.groceries.filter(
                    (g, i) =>
                      state.groceries[plan.weekStart + ":" + i + ":" + g.name],
                  ).length,
                ) +
                "/" +
                plan.groceries.length +
                " eingekauft"}
          </Heading>
          <View style={{ gap: 13, marginTop: 18 }}>
            {tab === "plan"
              ? plan.days.map((d) => (
                  <View key={d.date} style={[s.card, { padding: 23 }]}>
                    <View style={[s.sectionHeading, { marginBottom: 18 }]}>
                      <Text style={s.h3}>
                        {parseDate(d.date).toLocaleDateString("de-DE", {
                          weekday: "long",
                          day: "numeric",
                          month: "numeric",
                        })}
                      </Text>
                      {d.date === today && <Pill>Heute</Pill>}
                    </View>
                    {[
                      { label: "Frühstück", value: d.breakfast, icon: Coffee },
                      { label: "Mittagessen", value: d.lunch, icon: Sun },
                      { label: "Abendessen", value: d.dinner, icon: Utensils },
                    ].map((m) => (
                      <View
                        key={m.label}
                        style={[s.row, { paddingVertical: 10 }]}
                      >
                        <m.icon size={16} color="#BA8C9E" />
                        <View style={{ flex: 1 }}>
                          <Text style={s.micro}>{m.label}</Text>
                          <Text style={[s.body, { marginTop: 4 }]}>
                            {m.value}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              : plan.groceries.map((g, i) => {
                  const key = plan.weekStart + ":" + i + ":" + g.name;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="checkbox"
                    aria-checked={!!state.groceries[key]}
                      accessibilityState={{ checked: !!state.groceries[key] }}
                      accessibilityLabel={g.name + " eingekauft"}
                      onPress={() =>
                        update((prev) => ({
                          ...prev,
                          groceries: {
                            ...prev.groceries,
                            [key]: !prev.groceries[key],
                          },
                        }))
                      }
                      style={[s.card, s.row, { padding: 19 }]}
                    >
                      <View
                        style={[
                          s.checkbox,
                          state.groceries[key] && {
                            backgroundColor: C.button,
                            borderColor: C.button,
                          },
                        ]}
                      >
                        {state.groceries[key] && (
                          <Check size={15} color="white" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            s.body,
                            state.groceries[key] && {
                              textDecorationLine: "line-through",
                              color: C.muted,
                            },
                          ]}
                        >
                          {g.name}
                        </Text>
                        <Text style={[s.micro, { marginTop: 4 }]}>
                          {g.category}
                        </Text>
                      </View>
                      <Text style={s.muted}>{g.amount}</Text>
                    </Pressable>
                  );
                })}
          </View>
          <View style={s.notice}>
            <Text style={[s.body, { lineHeight: 22 }]}>
              Mahlzeiten werden beim ersten Laden jeder Woche automatisch in
              deinen Kalender übernommen. Dort kannst du sie abhaken, bearbeiten
              und löschen. Gelöschte Aufgaben bleiben auch nach einer
              Aktualisierung gelöscht.
            </Text>
          </View>
        </>
      )}
      <View style={s.footerNote}>
        <ShieldCheck size={15} color={C.muted} />
        <Text style={[s.micro, { flex: 1, lineHeight: 19 }]}>
          Dein letzter Plan bleibt auf dem Gerät verfügbar. Hap aktualisiert
          beim Öffnen, bei der Rückkehr zur App und alle 15 Minuten, solange die
          App läuft.
        </Text>
      </View>
    </>
  );
}
export function MealsScreen() {
  return (
    <Shell
      title="Dein Essensplan"
      subtitle="Mehr Genuss. Weniger „Was essen wir heute?“."
    >
      <MealsContent />
    </Shell>
  );
}
function SettingsContent() {
  const { state, update } = usePlanner();
  const [name, setName] = useState(state.name);
  const [url, setUrl] = useState(state.apiUrl);
  const [token, setToken] = useState(state.accessToken);
  const [backup, setBackup] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<ReturnType<typeof readState> | null>(
    null,
  );

  function save() {
    if (url.trim() && !/^https:\/\/[^\s]+\/?$/.test(url.trim()))
      return setMessage("Bitte eine vollständige HTTPS-Adresse eingeben.");
    update((prev) => ({
      ...prev,
      name: name.trim(),
      apiUrl: url.trim().replace(/\/$/, ""),
      accessToken: token.trim(),
    }));
    setMessage("Einstellungen gespeichert.");
  }
  async function exportBackup() {
    try {
      const content = JSON.stringify({ ...state, accessToken: "" }, null, 2);
      if (Platform.OS === "web") {
        const objectUrl = URL.createObjectURL(
          new Blob([content], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = "hap-backup-" + dateKey() + ".json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } else {
        await Share.share({ message: content, title: "Hap-Backup" });
      }
      setMessage("Backup erstellt. Der App-Zugang ist darin nicht enthalten.");
    } catch {
      setMessage(
        "Das Backup konnte nicht exportiert werden. Bitte versuche es erneut.",
      );
    }
  }
  return (
    <>
      <View style={{ gap: 23, maxWidth: 740 }}>
        {message ? (
          <View style={s.notice}>
            <Text style={s.body}>{message}</Text>
          </View>
        ) : null}
        <View style={[s.card, { padding: 26, gap: 20 }]}>
          <Heading>Dein Alltag</Heading>
          <Field
            label="Wie darf Hap dich nennen?"
            value={name}
            onChangeText={setName}
            placeholder="Dein Vorname"
            maxLength={40}
          />
          <View style={s.sectionHeading}>
            <View style={{ flex: 1, marginRight: 18 }}>
              <Text style={s.h3}>Sanft starten</Text>
              <Text style={[s.muted, { lineHeight: 21, marginTop: 6 }]}>
                Tipps für Tag 1–3, Tag 4–7 und ab Tag 8. Du kannst jederzeit
                beliebig viele Aufgaben planen.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Sanft starten"
              value={state.gentle}
              onValueChange={(gentle) =>
                update((prev) => ({ ...prev, gentle }))
              }
              trackColor={{ false: "#49434F", true: "#BC5568" }}
              thumbColor="white"
            />
          </View>
        </View>
        <View style={[s.card, { padding: 26, gap: 20 }]}>
          <Heading>Verbindung zum Essensplan</Heading>
          <Text style={[s.body, { color: C.muted, lineHeight: 23 }]}>
            Netlify erstellt den Plan jede Woche. Der OpenAI-API-Schlüssel wird
            nur dort als geheime Umgebungsvariable hinterlegt.
          </Text>
          <Field
            label="Netlify-Adresse (im Web optional)"
            value={url}
            onChangeText={setUrl}
            placeholder="https://dein-hap.netlify.app"
            autoCapitalize="none"
          />
          <Field
            label="Persönlicher App-Zugang"
            value={token}
            onChangeText={setToken}
            placeholder="Wert von HAP_ACCESS_TOKEN"
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={[s.micro, { lineHeight: 20 }]}>
            Der App-Zugang wird lokal gespeichert. Verwende ein eigenes
            zufälliges Token, niemals deinen OpenAI-API-Schlüssel. Auf der
            Netlify-Website kann das Adressfeld leer bleiben.
          </Text>
          <Button icon={Check} onPress={save}>
            Einstellungen speichern
          </Button>
        </View>
        <View style={[s.card, { padding: 26, gap: 18 }]}>
          <Heading>Deine Daten bleiben bei dir</Heading>
          <Text style={[s.body, { color: C.muted, lineHeight: 23 }]}>
            Aufgaben, Häkchen und Änderungen bleiben in diesem Browser bzw. auf
            diesem Gerät erhalten, auch nach dem Schließen. Es gibt noch keine
            Synchronisierung zwischen Geräten. Beim Löschen der Browserdaten
            gehen lokale Daten verloren – sichere sie deshalb als Backup.
          </Text>
          <Button
            quiet
            icon={ArrowDownToLine}
            onPress={() => void exportBackup()}
          >
            Backup herunterladen
          </Button>
          <Button quiet onPress={() => setImporting(!importing)}>
            Backup wiederherstellen
          </Button>
          {importing && (
            <>
              <Field
                label="Inhalt der Backup-JSON-Datei einfügen"
                value={backup}
                onChangeText={setBackup}
                multiline
              />
              <Button
                quiet
                onPress={() => {
                  try {
                    setPending(readState(backup));
                  } catch (e) {
                    setMessage(
                      e instanceof Error ? e.message : "Ungültiges Backup",
                    );
                  }
                }}
              >
                Backup prüfen
              </Button>
            </>
          )}
          {pending && (
            <View
              style={{
                gap: 12,
                padding: 17,
                backgroundColor: "#3A2E25",
                borderRadius: 12,
              }}
            >
              <Text style={[s.body, { lineHeight: 22 }]}>
                Dieses Backup enthält {pending.tasks.length} Aufgaben. Beim
                Wiederherstellen werden deine aktuellen lokalen Daten ersetzt.
              </Text>
              <Button
                onPress={() => {
                  update(() => ({
                    ...pending,
                    accessToken: state.accessToken,
                  }));
                  setName(pending.name);
                  setUrl(pending.apiUrl);
                  setToken(state.accessToken);
                  setPending(null);
                  setImporting(false);
                  setBackup("");
                  setMessage("Dein Backup wurde wiederhergestellt.");
                }}
              >
                Daten jetzt ersetzen
              </Button>
              <Button quiet onPress={() => setPending(null)}>
                Abbrechen
              </Button>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

export function SettingsScreen() {
  return (
    <Shell
      title="Ganz dein Hap"
      subtitle="Deine Einstellungen, deine Daten, dein Rhythmus."
    >
      <SettingsContent />
    </Shell>
  );
}

