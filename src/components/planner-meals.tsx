import { useState } from "react";
import { Platform, Pressable, Share, Switch, Text, View } from "react-native";
import { askPermission, tap } from "@/lib/notify";
import { validRaplaUrl } from "@/lib/rapla";
import { goals, nutrition, workoutsFor } from "@/lib/training";
import type { Goal } from "@/lib/planner";
import { Bar } from "./charts";
import { router } from "expo-router";
import {
  ArrowDownToLine,
  Beef,
  Bell,
  Check,
  GraduationCap,
  User,
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
  Chip,
  Field,
  Heading,
  Pill,
  Sheet,
  Shell,
  useToday,
  s,
} from "./planner-ui";

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

function NutritionCard() {
  const { state, update } = usePlanner();
  const today = useToday();
  const [profile, setProfile] = useState(false);
  const training = workoutsFor(state, today).length > 0;
  const t = nutrition(state.profile, training);
  const protein = state.protein[today] || 0;
  return (
    <View style={[s.card, { padding: 22, gap: 16, marginBottom: 22 }]}>
      <View style={s.sectionHeading}>
        <View style={s.row}>
          <Beef size={18} color={C.green} />
          <Text style={s.h3}>Deine Ziele heute</Text>
          <Pill>{training ? "Trainingstag" : "Ruhetag"}</Pill>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setProfile(true)} style={s.row}>
          <User size={14} color={C.green} />
          <Text style={s.link}>{goals[state.profile.goal].label} · {state.profile.weight} kg</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[
          { label: "KALORIEN", value: t.kcal + "", unit: "kcal" },
          { label: "PROTEIN", value: t.protein + "", unit: "g" },
          { label: "KOHLENHYDRATE", value: t.carbs + "", unit: "g" },
          { label: "FETT", value: t.fat + "", unit: "g" },
        ].map((x) => (
          <View key={x.label} style={{ flexGrow: 1, flexBasis: 120, backgroundColor: "#202127", borderRadius: 12, padding: 14 }}>
            <Text style={s.eyebrow}>{x.label}</Text>
            <Text style={{ color: C.ink, fontSize: 22, fontWeight: "700", marginTop: 6 }}>
              {x.value} <Text style={s.micro}>{x.unit}</Text>
            </Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <View style={s.sectionHeading}>
          <Text style={s.body}>
            Protein heute: <Text style={{ fontWeight: "700" }}>{protein} g</Text> / {t.protein} g
          </Text>
          {protein >= t.protein && <Text style={{ color: "#98C5A9", fontSize: 12 }}>Ziel erreicht 💪</Text>}
        </View>
        <Bar value={protein / t.protein} color="#E5B073" />
        <View style={s.wrap}>
          {[10, 20, 30, 40].map((g) => (
            <Chip
              key={g}
              label={"+" + g + " g"}
              active={false}
              onPress={() => update((prev) => ({ ...prev, protein: { ...prev.protein, [today]: (prev.protein[today] || 0) + g } }))}
            />
          ))}
          {protein > 0 && (
            <Chip label="Zurücksetzen" active={false} onPress={() => update((prev) => ({ ...prev, protein: { ...prev.protein, [today]: 0 } }))} />
          )}
        </View>
      </View>
      <Text style={[s.micro, { lineHeight: 18 }]}>
        Richtwerte nach Mifflin-St-Jeor mit moderatem Aktivitätsfaktor – keine medizinische Beratung. Dein Profil fließt in den nächsten KI-Essensplan ein.
      </Text>
      {profile && <ProfileSheet close={() => setProfile(false)} />}
    </View>
  );
}

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
      <NutritionCard />
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
function UniSettings() {
  const { state, update, syncUni, uniSyncing, uniStatus } = usePlanner();
  const [link, setLink] = useState(state.raplaUrl);
  const [message, setMessage] = useState("");
  return (
    <View style={[s.card, { padding: 26, gap: 18 }]}>
      <View style={s.row}>
        <GraduationCap size={20} color="#B9A2F2" />
        <Heading>Stundenplan (DHBW Rapla)</Heading>
      </View>
      <Text style={[s.body, { color: C.muted, lineHeight: 22 }]}>
        Füge deinen persönlichen Rapla-Link ein. Vorlesungen, Räume und die Klausurwoche erscheinen dann automatisch in deinem Tag. Der Link bleibt nur auf diesem Gerät.
      </Text>
      <Field
        label="Rapla-Link"
        value={link}
        onChangeText={setLink}
        placeholder="https://rapla.dhbw.de/rapla/internal_calendar?key=…"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {message || uniStatus ? <Text style={s.micro}>{message || uniStatus}</Text> : null}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Button
          icon={Check}
          disabled={uniSyncing}
          onPress={() => {
            const value = link.trim();
            if (value && !validRaplaUrl(value))
              return setMessage("Das ist kein gültiger Link von rapla.dhbw.de.");
            setMessage("");
            update((prev) => ({
              ...prev,
              raplaUrl: value,
              uniSynced: "",
              uniEvents: value === prev.raplaUrl ? prev.uniEvents : [],
            }));
          }}
        >
          {uniSyncing ? "Lädt …" : "Speichern & laden"}
        </Button>
        {state.raplaUrl ? (
          <Button quiet disabled={uniSyncing} onPress={() => void syncUni()}>
            Jetzt neu laden
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function NotifySettings() {
  const { state, update } = usePlanner();
  const n = state.notify;
  const [message, setMessage] = useState("");
  const set = (patch: Partial<typeof n>) =>
    update((prev) => ({ ...prev, notify: { ...prev.notify, ...patch } }));
  const toggles = [
    { key: "lectures", label: "Vorlesungen (15 Min. vorher, mit Raum)" },
    { key: "tasks", label: "Aufgaben & Lernblöcke" },
    { key: "training", label: "Training (30 Min. vorher)" },
    { key: "exams", label: "Klausuren & Abgaben (14, 7, 3 und 1 Tag vorher)" },
  ] as const;
  return (
    <View style={[s.card, { padding: 26, gap: 18 }]}>
      <View style={s.row}>
        <Bell size={20} color={C.green} />
        <Heading>Benachrichtigungen</Heading>
      </View>
      <View style={s.sectionHeading}>
        <View style={{ flex: 1, marginRight: 18 }}>
          <Text style={s.h3}>Erinnerungen aktivieren</Text>
          <Text style={[s.muted, { lineHeight: 20, marginTop: 6 }]}>
            {Platform.OS === "web"
              ? "Im Browser kommen Erinnerungen nur, solange Hap in einem Tab geöffnet ist. Zuverlässig am Handy mit der App."
              : "Hap plant Erinnerungen für die nächsten Tage direkt auf deinem Handy."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Erinnerungen aktivieren"
          value={n.enabled}
          onValueChange={async (on) => {
            if (on && !(await askPermission())) {
              setMessage("Benachrichtigungen sind nicht erlaubt. Bitte in den System- bzw. Browser-Einstellungen freigeben.");
              return;
            }
            setMessage(on ? "Erinnerungen sind aktiv." : "");
            set({ enabled: on });
          }}
          trackColor={{ false: "#49434F", true: "#BC5568" }}
          thumbColor="white"
        />
      </View>
      {message ? <Text style={s.micro}>{message}</Text> : null}
      {n.enabled && (
        <>
          {toggles.map((t) => (
            <View key={t.key} style={s.sectionHeading}>
              <Text style={[s.body, { flex: 1 }]}>{t.label}</Text>
              <Switch
                accessibilityLabel={t.label}
                value={n[t.key]}
                onValueChange={(v) => set({ [t.key]: v })}
                trackColor={{ false: "#49434F", true: "#BC5568" }}
                thumbColor="white"
              />
            </View>
          ))}
          <View>
            <Text style={s.label}>Aufgaben vorher ankündigen</Text>
            <View style={s.wrap}>
              {[0, 5, 10, 15, 30, 60].map((m) => (
                <Chip key={m} label={m ? m + " Min." : "Pünktlich"} active={n.lead === m} onPress={() => set({ lead: m })} />
              ))}
            </View>
          </View>
          <View>
            <Text style={s.label}>Morgen-Briefing (dein Tag in einer Nachricht)</Text>
            <View style={s.wrap}>
              {["", "06:30", "07:00", "07:30", "08:00", "09:00"].map((t) => (
                <Chip key={t || "off"} label={t || "Aus"} active={n.briefing === t} onPress={() => set({ briefing: t })} />
              ))}
            </View>
          </View>
          <View>
            <Text style={s.label}>Tagesabschluss am Abend</Text>
            <View style={s.wrap}>
              {["", "20:00", "21:00", "21:30", "22:00"].map((t) => (
                <Chip key={t || "off"} label={t || "Aus"} active={n.review === t} onPress={() => set({ review: t })} />
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function SettingsContent() {
  const { state, update } = usePlanner();
  const [profile, setProfile] = useState(false);
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
        <UniSettings />
        <NotifySettings />
        <View style={[s.card, { padding: 26, gap: 14 }]}>
          <View style={s.row}>
            <User size={20} color={C.green} />
            <Heading>Profil & Ernährung</Heading>
          </View>
          <Text style={[s.body, { color: C.muted, lineHeight: 22 }]}>
            {state.profile.age} Jahre · {state.profile.height} cm · {state.profile.weight} kg · Ziel: {goals[state.profile.goal].label}
          </Text>
          <Button quiet onPress={() => setProfile(true)}>Profil bearbeiten</Button>
          {profile && <ProfileSheet close={() => setProfile(false)} />}
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

