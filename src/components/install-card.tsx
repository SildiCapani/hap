import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { BellRing, Share, Smartphone, X } from "lucide-react-native";
import { askPermission } from "@/lib/notify";
import { usePlanner } from "@/lib/store";
import {
  canPromptInstall,
  disableWebPush,
  enableWebPush,
  isIOS,
  isStandalone,
  onInstallChange,
  promptInstall,
  webPushSupported,
} from "@/lib/webpush";
import { Button, C, s } from "./planner-ui";

// Turns reminders on. On the web this subscribes to push (home screen app)
// and falls back to in-tab reminders. Returns a message for the user.
export function useNotifyToggle() {
  const { state, update } = usePlanner();
  const set = (enabled: boolean) =>
    update((prev) => ({ ...prev, notify: { ...prev.notify, enabled } }));
  return async (on: boolean): Promise<string> => {
    if (!on) {
      if (Platform.OS === "web") await disableWebPush(state.apiUrl, state.accessToken);
      set(false);
      return "";
    }
    if (Platform.OS !== "web" || !webPushSupported()) {
      if (Platform.OS === "web" && isIOS() && !isStandalone())
        return "Auf dem iPhone gehen Erinnerungen nur, wenn Hap auf dem Home-Bildschirm liegt: Teilen → „Zum Home-Bildschirm“, dann Hap von dort öffnen.";
      if (!(await askPermission()))
        return "Benachrichtigungen sind nicht erlaubt. Bitte in den Einstellungen freigeben.";
      set(true);
      return Platform.OS === "web" ? "Aktiv – solange Hap geöffnet ist." : "Erinnerungen sind aktiv.";
    }
    const problem = await enableWebPush(state.apiUrl, state.accessToken);
    if (!problem) {
      set(true);
      return "Push ist aktiv – Erinnerungen kommen auch, wenn Hap geschlossen ist.";
    }
    // Without push (e.g. Netlify not set up yet) reminders still work while Hap is open.
    if (typeof Notification !== "undefined" && Notification.permission === "granted") set(true);
    return problem;
  };
}

export function usePushActive() {
  const { state } = usePlanner();
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || !webPushSupported()) return;
    let alive = true;
    void navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => alive && setActive(!!sub));
    return () => {
      alive = false;
    };
  }, [state.notify.enabled]);
  return active;
}

// Guides a phone browser user to "add to home screen", then to turn on
// reminders inside the installed app. Hidden once done or dismissed.
export function InstallCard({ dismissible = true }: { dismissible?: boolean }) {
  const { state, update } = usePlanner();
  const toggle = useNotifyToggle();
  const [prompt, setPrompt] = useState(canPromptInstall());
  const [message, setMessage] = useState("");
  useEffect(() => onInstallChange(() => setPrompt(canPromptInstall())), []);
  if (Platform.OS !== "web") return null;
  if (dismissible && state.installHidden) return null;
  const standalone = isStandalone();
  if (standalone && (state.notify.enabled || !dismissible)) return null;
  const hide = () => update((prev) => ({ ...prev, installHidden: true }));
  return (
    <View style={[s.card, { padding: 18, gap: 12, marginBottom: 16, borderColor: "#6B3544", backgroundColor: "#22171C" }]}>
      <View style={s.row}>
        {standalone ? <BellRing size={18} color={C.green} /> : <Smartphone size={18} color={C.green} />}
        <Text style={[s.h3, { flex: 1 }]}>
          {standalone ? "Erinnerungen einschalten" : "Hap als App auf den Home-Bildschirm"}
        </Text>
        {dismissible && (
          <Pressable accessibilityLabel="Ausblenden" hitSlop={10} onPress={hide}>
            <X size={17} color={C.muted} />
          </Pressable>
        )}
      </View>
      <Text style={[s.muted, { lineHeight: 19 }]}>
        {standalone
          ? "Vorlesung in 15 Min., Training, Abgaben, Fokus-Ende – Hap meldet sich, auch wenn die App zu ist."
          : "Vollbild, dein Logo auf dem Home-Bildschirm und Push-Erinnerungen – ganz ohne App Store."}
      </Text>
      {standalone ? (
        <Button icon={BellRing} onPress={() => void toggle(true).then(setMessage)}>
          Erinnerungen erlauben
        </Button>
      ) : prompt ? (
        <Button icon={Smartphone} onPress={() => void promptInstall()}>
          Installieren
        </Button>
      ) : isIOS() ? (
        <View style={{ gap: 8 }}>
          {[
            ["1", "Unten in Safari auf Teilen tippen", true],
            ["2", "„Zum Home-Bildschirm“ wählen", false],
            ["3", "Hap vom Home-Bildschirm öffnen und Erinnerungen erlauben", false],
          ].map(([n, label, icon]) => (
            <View key={String(n)} style={s.row}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.button, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{n}</Text>
              </View>
              <Text style={[s.body, { flex: 1 }]}>{label}</Text>
              {icon ? <Share size={16} color={C.green} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.body}>Im Browsermenü (⋮) auf „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ tippen.</Text>
      )}
      {message ? <Text style={[s.micro, { lineHeight: 17 }]}>{message}</Text> : null}
    </View>
  );
}
