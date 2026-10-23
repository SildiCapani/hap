import { useState } from "react";
import { Platform, Pressable, Share, Switch, Text, View } from "react-native";
import { tap, testLocal } from "@/lib/notify";
import { InstallCard, useNotifyToggle, usePushActive } from "./install-card";
import { sendTestPush } from "@/lib/webpush";
import { validRaplaUrl } from "@/lib/rapla";
import { goals } from "@/lib/training";
import { FoodTracker } from "./food";
import { ProfileSheet } from "./profile-sheet";
import { currentMeals, groceriesFor, recalcGroceries, slotLabel } from "@/lib/mealplan";
import { CalendarSettings } from "./calendar-settings";
import { TransportSettings } from "./transport-settings";
import { router } from "expo-router";
import {
  ArrowDownToLine,
  Flame,
  Bell,
  Cloud,
  Sparkles,
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
  Shell,
  useToday,
  s,
} from "./planner-ui";

function MealsContent() {
  const { state, update, syncing, mealStatus, syncMeals, generateMeals } = usePlanner();
  const [generating, setGenerating] = useState("");
  const today = useToday();
  const [tab, setTab] = useState<"today" | "plan" | "groceries">("today");
  const plan = state.mealPlan;
  const meals = plan ? currentMeals(state, plan) : [];
  const grocery = plan ? groceriesFor(state, plan) : null;
  const [recalc, setRecalc] = useState("");
  const tabs = [
    { key: "today", label: "Heute", icon: Flame },
    { key: "plan", label: "Wochenplan", icon: Utensils },
    { key: "groceries", label: "Einkauf", icon: ShoppingBag },
  ] as const;
  return (
    <>
      <View style={[s.row, { backgroundColor: "#1C1D22", borderRadius: 12, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: C.line }]}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => {
              tap();
              setTab(t.key);
            }}
            style={[s.row, { flex: 1, justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 9 }, tab === t.key && { backgroundColor: C.pale }]}
          >
            <t.icon size={15} color={tab === t.key ? C.green : C.muted} />
            <Text style={{ color: tab === t.key ? C.ink : C.muted, fontWeight: tab === t.key ? "700" : "500", fontSize: 13 }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "today" ? (
        <FoodTracker />
      ) : (
        <>
          <View style={[s.row, { justifyContent: "flex-end", marginBottom: 14 }]}>
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
          {state.accessToken && (!plan || plan.weekStart < monday(today)) && (
            <View style={[s.card, { padding: 20, gap: 12, marginBottom: 18 }]}>
              <Text style={s.h3}>Noch kein Plan für diese Woche</Text>
              <Text style={[s.muted, { lineHeight: 19 }]}>
                Die KI erstellt Frühstück, Mittag- und Abendessen plus Einkaufsliste – passend zu deinem Profil und deinen Trainingstagen.
              </Text>
              <Button
                icon={Sparkles}
                disabled={!!generating && generating.startsWith("…")}
                onPress={() => {
                  tap("medium");
                  setGenerating("… Wird gestartet");
                  void generateMeals().then(setGenerating);
                }}
              >
                Plan jetzt erstellen
              </Button>
              {generating ? <Text style={[s.micro, { lineHeight: 17 }]}>{generating}</Text> : null}
            </View>
          )}
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
                      (grocery?.items || []).filter(
                        (g, i) =>
                          state.groceries[plan.weekStart + ":" + i + ":" + g.name],
                      ).length,
                    ) +
                    "/" +
                    (grocery?.items.length || 0) +
                    " eingekauft"}
              </Heading>
              {tab === "groceries" && grocery?.outdated && (
                <View style={[s.notice, { marginTop: 14, gap: 10 }]}>
                  <Text style={[s.body, { lineHeight: 21 }]}>
                    Du hast Gerichte geändert. Die Einkaufsliste passt noch zum ursprünglichen Plan.
                  </Text>
                  <Button
                    quiet
                    icon={Sparkles}
                    disabled={recalc.startsWith("…")}
                    onPress={() => {
                      setRecalc("… Wird berechnet");
                      const dishes = meals.flatMap((d) => d.meals.map((m) => m.current).filter((x): x is string => !!x));
                      void recalcGroceries(state, dishes).then((result) => {
                        if (typeof result === "string") return setRecalc(result);
                        update((prev) => ({ ...prev, groceryList: { weekStart: plan.weekStart, basis: grocery.basis, items: result } }));
                        setRecalc("Einkaufsliste angepasst ✓");
                      });
                    }}
                  >
                    Einkaufsliste anpassen
                  </Button>
                  {recalc ? <Text style={s.micro}>{recalc}</Text> : null}
                </View>
              )}
              <View style={{ gap: 13, marginTop: 18 }}>
                {tab === "plan"
                  ? meals.map((d) => (
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
                        {d.meals.map((m) => {
                          const SlotIcon = m.slot === "breakfast" ? Coffee : m.slot === "lunch" ? Sun : Utensils;
                          return (
                            <View key={m.slot} style={[s.row, { paddingVertical: 10 }]}>
                              <SlotIcon size={16} color="#BA8C9E" />
                              <View style={{ flex: 1 }}>
                                <View style={s.row}>
                                  <Text style={s.micro}>{slotLabel[m.slot]}</Text>
                                  {m.changed && (
                                    <Text style={[s.micro, { color: C.green }]}>{m.current ? "· geändert" : "· gestrichen"}</Text>
                                  )}
                                </View>
                                <Text
                                  style={[
                                    s.body,
                                    { marginTop: 4 },
                                    !m.current && { color: C.muted, textDecorationLine: "line-through" },
                                  ]}
                                >
                                  {m.current || m.original}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ))
                  : (grocery?.items || []).map((g, i) => {
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
                              <Check size={15} color={C.onAccent} />
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
      </>
      )}
      {tab !== "today" && (
        <View style={s.footerNote}>
          <ShieldCheck size={15} color={C.muted} />
          <Text style={[s.micro, { flex: 1, lineHeight: 19 }]}>
            Dein letzter Plan bleibt auf dem Gerät verfügbar. Hap aktualisiert
            beim Öffnen, bei der Rückkehr zur App und alle 15 Minuten, solange die
            App läuft.
          </Text>
        </View>
      )}
    </>
  );
}
export function MealsScreen() {
  return (
    <Shell
      title="Essen"
      subtitle="Kalorien im Blick, Wochenplan und Einkaufsliste."
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

function CloudSettings() {
  const { state, cloud, resolveCloud, checkCloud } = usePlanner();
  const [confirm, setConfirm] = useState(false);
  if (!state.accessToken) return null;
  const pending = cloud.pending;
  const when = (iso: string) =>
    new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <View style={[s.card, { padding: 26, gap: 14 }, pending && { borderColor: C.green }]}>
      <View style={s.row}>
        <Cloud size={20} color={C.green} />
        <Heading>Sync & Backup</Heading>
      </View>
      {pending ? (
        <>
          <Text style={[s.body, { lineHeight: 22 }]}>
            In deiner Cloud liegen Daten vom {when(pending.savedAt)} ({pending.state.tasks.length} Aufgaben,{" "}
            {pending.state.exams.length} Prüfungen, {pending.state.workoutLogs.length} Trainings). Welche Daten sollen gelten?
          </Text>
          <Button icon={Cloud} onPress={() => resolveCloud(true)}>
            Cloud-Daten übernehmen
          </Button>
          {!confirm ? (
            <Button quiet onPress={() => setConfirm(true)}>
              Dieses Gerät behalten
            </Button>
          ) : (
            <Button quiet danger onPress={() => resolveCloud(false)}>
              Ja, Cloud mit diesem Gerät überschreiben
            </Button>
          )}
        </>
      ) : (
        <>
          <Text style={[s.body, { color: C.muted, lineHeight: 22 }]}>
            {state.cloudLinked
              ? "Hap synchronisiert deine Daten automatisch zwischen deinen Geräten (Handy, Laptop, App vom Home-Bildschirm). Änderungen von beiden Seiten werden zusammengeführt."
              : "Hap prüft gerade, ob es schon eine Sicherung gibt …"}
          </Text>
          {cloud.savedAt ? <Text style={s.micro}>Zuletzt synchronisiert: {when(cloud.savedAt)}</Text> : null}
          {state.cloudLinked && (
            <Pressable onPress={() => void checkCloud()}>
              <Text style={s.link}>Jetzt synchronisieren</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function NotifySettings() {
  const { state, update } = usePlanner();
  const n = state.notify;
  const [message, setMessage] = useState("");
  const toggle = useNotifyToggle();
  const push = usePushActive();
  const [token, setToken] = useState("");
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
            {Platform.OS !== "web"
              ? "Hap plant Erinnerungen für die nächsten Tage direkt auf deinem Handy."
              : push && n.enabled
                ? "Push aktiv: Erinnerungen kommen auch, wenn Hap geschlossen ist."
                : "Am zuverlässigsten, wenn Hap auf deinem Home-Bildschirm liegt. Im normalen Browser-Tab nur, solange Hap offen ist."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Erinnerungen aktivieren"
          value={n.enabled}
          onValueChange={(on) => {
            void toggle(on).then(setMessage);
          }}
          trackColor={{ false: "#49434F", true: "#BC5568" }}
          thumbColor="white"
        />
      </View>
      {message ? <Text style={[s.micro, { lineHeight: 17 }]}>{message}</Text> : null}
      {Platform.OS === "web" && !state.accessToken && (
        <View style={{ gap: 10 }}>
          <Field
            label="Persönlicher App-Zugang (für Push)"
            value={token}
            onChangeText={setToken}
            placeholder="Wert von HAP_ACCESS_TOKEN"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            quiet
            icon={Check}
            disabled={token.trim().length < 32}
            onPress={() => {
              update((prev) => ({ ...prev, accessToken: token.trim() }));
              setMessage("App-Zugang gespeichert. Jetzt Erinnerungen einschalten.");
            }}
          >
            Zugang speichern
          </Button>
        </View>
      )}
      <InstallCard dismissible={false} />
      {n.enabled && (
        <Button
          quiet
          icon={Bell}
          onPress={() => {
            setMessage("Wird gesendet …");
            void (push
              ? sendTestPush(state.apiUrl, state.accessToken)
              : testLocal().then((ok) =>
                  ok
                    ? Platform.OS === "web"
                      ? "Test angezeigt. Ohne Push kommen Erinnerungen nur, solange Hap offen ist."
                      : "Test kommt in 3 Sekunden."
                    : "Benachrichtigungen sind nicht erlaubt.",
                )
            ).then(setMessage);
          }}
        >
          Test-Benachrichtigung senden
        </Button>
      )}
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
        <CloudSettings />
        <UniSettings />
        <CalendarSettings />
        <TransportSettings />
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

