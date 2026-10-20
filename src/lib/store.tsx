import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import {
  createState,
  dateKey,
  finishFocus,
  importMeals,
  monday,
  readState,
  shiftDay,
  storageKey,
  validMealPlan,
  type PlannerState,
} from "./planner";
import { parseRapla, raplaWeeksUrl, type UniEvent } from "./rapla";
import { reminders } from "./reminders";
import { schedule } from "./notify";
import { currentSubscription, syncWebPush } from "./webpush";
import { profileText } from "./training";

type Store = {
  state: PlannerState;
  ready: boolean;
  error: string;
  saved: boolean;
  update: (fn: (s: PlannerState) => PlannerState) => void;
  retry: () => void;
  syncMeals: () => Promise<void>;
  syncing: boolean;
  mealStatus: string;
  syncUni: () => Promise<void>;
  uniSyncing: boolean;
  uniStatus: string;
  pushProfile: () => Promise<string>;
};
const Context = createContext<Store | null>(null);
export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlannerState>(() => createState());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mealStatus, setMealStatus] = useState("");
  const [uniSyncing, setUniSyncing] = useState(false);
  const [uniStatus, setUniStatus] = useState("");
  const uniFlight = useRef(false);
  const inFlight = useRef(false);
  const credentials = useRef("");
  useEffect(() => {
    credentials.current = state.apiUrl + ":" + state.accessToken;
  }, [state.apiUrl, state.accessToken]);
  const blocked = useRef(false);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        try {
          if (raw) setState(readState(raw));
          setReady(true);
        } catch {
          blocked.current = true;
          setError(
            "Deine gespeicherten Daten konnten nicht gelesen werden. Bitte sichere sie, bevor du fortfährst.",
          );
        }
      })
      .catch(() => {
        if (active) {
          blocked.current = true;
          setError(
            "Der Gerätespeicher ist nicht zugänglich. Bitte lade die App erneut.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || !ready) return;
    const receive = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue || blocked.current) return;
      try {
        const incoming = readState(event.newValue);
        setState((current) =>
          JSON.stringify(current) === event.newValue ? current : incoming,
        );
      } catch {
        // An invalid value from another tab must never replace valid local state.
      }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, [ready]);
  const persist = useCallback((next: PlannerState) => {
    if (blocked.current) return;
    const current = ++revision.current;
    setSaved(false);
    queue.current = queue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)))
      .then(() => {
        if (current === revision.current) {
          setSaved(true);
          setError("");
        }
      })
      .catch(() => {
        if (current === revision.current)
          setError(
            "Speichern fehlgeschlagen. Deine letzten Änderungen sind noch nicht dauerhaft gesichert.",
          );
      });
  }, []);
  useEffect(() => {
    if (ready) persist(state);
  }, [state, ready, persist]);
  const update = useCallback((fn: (s: PlannerState) => PlannerState) => {
    if (!blocked.current) setState(fn);
  }, []);
  const syncMeals = useCallback(async () => {
    if (!ready || inFlight.current) return;
    if (!state.accessToken) {
      setMealStatus(
        "Trage deinen persönlichen App-Zugang in den Einstellungen ein.",
      );
      return;
    }
    const identity = state.apiUrl + ":" + state.accessToken;
    inFlight.current = true;
    setSyncing(true);
    setMealStatus("");
    try {
      const base = state.apiUrl.replace(/\/$/, "");
      if (Platform.OS !== "web" && !base)
        throw new Error(
          "Bitte die Netlify-Adresse in den Einstellungen eintragen.",
        );
      const response = await fetch(base + "/.netlify/functions/meal-plan", {
        headers: { Authorization: "Bearer " + state.accessToken },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Der App-Zugang ist ungültig."
            : response.status === 404
              ? "Noch kein Wochenplan vorhanden. Starte die Erstellung einmal in Netlify."
              : response.status === 503
                ? "Die Essensplanung ist auf Netlify noch nicht eingerichtet."
                : "Der Wochenplan ist gerade nicht erreichbar.",
        );
      const plan: unknown = await response.json();
      if (!validMealPlan(plan))
        throw new Error("Die Antwort enthält keinen gültigen Wochenplan.");
      if (credentials.current !== identity) return;
      update((prev) => importMeals(prev, plan));
      setMealStatus(
        "Wochenplan aktuell. Neue Mahlzeiten erscheinen automatisch als Tagesaufgaben.",
      );
    } catch (e) {
      if (credentials.current === identity)
        setMealStatus(
          e instanceof Error
            ? e.message
            : "Keine Verbindung. Der letzte Plan bleibt gespeichert.",
        );
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [ready, state.apiUrl, state.accessToken, update]);
  useEffect(() => {
    if (!ready || !state.accessToken) return;
    const startup = setTimeout(() => {
      void syncMeals();
    }, 0);
    const timer = setInterval(
      () => {
        void syncMeals();
      },
      15 * 60 * 1000,
    );
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active") void syncMeals();
    });
    const refresh = () => {
      void syncMeals();
    };
    if (Platform.OS === "web") window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(startup);
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === "web") window.removeEventListener("focus", refresh);
    };
  }, [ready, state.accessToken, syncMeals]);
  const syncUni = useCallback(async () => {
    if (!ready || uniFlight.current) return;
    const link = state.raplaUrl;
    if (!link) {
      setUniStatus("Trage deinen Rapla-Link in den Einstellungen ein.");
      return;
    }
    uniFlight.current = true;
    setUniSyncing(true);
    setUniStatus("");
    // Two weeks back keeps the recent past visible; Rapla serves at most 20 weeks.
    const from = shiftDay(monday(dateKey()), -14);
    try {
      let events: UniEvent[];
      if (Platform.OS === "web") {
        const base = state.apiUrl.replace(/\/$/, "");
        const response = await fetch(base + "/.netlify/functions/uni-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: link, from, weeks: 20 }),
          signal: AbortSignal.timeout(30000),
        });
        if (response.status === 404)
          throw new Error(
            "Der Stundenplan-Import läuft im Browser über Netlify. Lokal bitte „npx netlify dev“ nutzen oder die App am Handy öffnen.",
          );
        if (!response.ok)
          throw new Error("Rapla ist gerade nicht erreichbar. Prüfe deinen Link.");
        events = ((await response.json()) as { events: UniEvent[] }).events;
      } else {
        const response = await fetch(raplaWeeksUrl(link, from, 20), {
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok)
          throw new Error("Rapla ist gerade nicht erreichbar. Prüfe deinen Link.");
        events = parseRapla(await response.text(), from);
      }
      if (!Array.isArray(events)) throw new Error("Ungültige Antwort von Rapla.");
      update((prev) =>
        prev.raplaUrl !== link
          ? prev
          : {
              ...prev,
              uniEvents: [
                ...prev.uniEvents.filter((e) => e.date < from),
                ...events,
              ],
              uniSynced: new Date().toISOString(),
            },
      );
      setUniStatus(
        events.length
          ? events.length + " Termine aus Rapla geladen."
          : "Rapla hat keine Termine geliefert. Ist der Link richtig?",
      );
    } catch (e) {
      setUniStatus(
        e instanceof Error && e.name !== "TypeError"
          ? e.message
          : "Keine Verbindung zu Rapla. Dein letzter Stundenplan bleibt gespeichert.",
      );
    } finally {
      uniFlight.current = false;
      setUniSyncing(false);
    }
  }, [ready, state.raplaUrl, state.apiUrl, update]);
  useEffect(() => {
    if (!ready || !state.raplaUrl) return;
    const stale = () =>
      !state.uniSynced ||
      Date.now() - new Date(state.uniSynced).valueOf() > 6 * 3600 * 1000;
    const startup = setTimeout(() => {
      if (stale()) void syncUni();
    }, 0);
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active" && stale()) void syncUni();
    });
    return () => {
      clearTimeout(startup);
      subscription.remove();
    };
  }, [ready, state.raplaUrl, state.uniSynced, syncUni]);
  // A running focus round completes even when the focus screen is closed.
  const focusEnd =
    state.activeFocus && state.activeFocus.pausedLeft === null
      ? state.activeFocus.endsAt
      : 0;
  const focusId = state.activeFocus?.startedAt;
  useEffect(() => {
    if (!ready || !focusEnd) return;
    const timer = setTimeout(
      () =>
        update((prev) => {
          const active = prev.activeFocus;
          return active &&
            active.startedAt === focusId &&
            active.pausedLeft === null
            ? finishFocus(prev, active.minutes)
            : prev;
        }),
      Math.max(0, focusEnd - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [ready, focusEnd, focusId, update]);
  // Reminders are recomputed shortly after any change to the plan. On the web
  // an active push subscription (home screen app) takes over delivery.
  const [wakeTick, setWakeTick] = useState(0);
  const pushed = useRef({ key: "", at: 0 });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active") setWakeTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const list = reminders(state);
      if (Platform.OS !== "web") {
        void schedule(list).catch(() => {});
        return;
      }
      void currentSubscription().then((sub) => {
        if (!sub || !state.notify.enabled) return schedule(list);
        void schedule([]);
        const key = JSON.stringify(list);
        // Resend at least every 30 minutes so briefing texts stay fresh.
        if (key === pushed.current.key && Date.now() - pushed.current.at < 30 * 60 * 1000) return;
        return syncWebPush(state.apiUrl, state.accessToken, list).then((ok) => {
          if (ok) pushed.current = { key, at: Date.now() };
        });
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, state, wakeTick]);
  const pushProfile = useCallback(async () => {
    if (!state.accessToken)
      return "Profil lokal gespeichert. Für die Essensplanung den App-Zugang eintragen.";
    try {
      const base = state.apiUrl.replace(/\/$/, "");
      const response = await fetch(base + "/.netlify/functions/meal-profile", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + state.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile: profileText(state) }),
        signal: AbortSignal.timeout(15000),
      });
      return response.ok
        ? "Profil gespeichert. Der nächste Essensplan richtet sich danach."
        : "Profil lokal gespeichert. Netlify hat es nicht angenommen (" +
            response.status +
            ").";
    } catch {
      return "Profil lokal gespeichert. Netlify ist gerade nicht erreichbar.";
    }
  }, [state]);
  // Keep the meal planning profile on Netlify in sync with goals and training days.
  const profileKey = ready && state.accessToken ? profileText(state) : "";
  const sentProfile = useRef("");
  useEffect(() => {
    if (!profileKey || profileKey === sentProfile.current) return;
    const timer = setTimeout(() => {
      sentProfile.current = profileKey;
      void pushProfile();
    }, 4000);
    return () => clearTimeout(timer);
  }, [profileKey, pushProfile]);
  return (
    <Context.Provider
      value={{
        state,
        ready,
        error,
        saved,
        update,
        retry: () => persist(state),
        syncing,
        mealStatus,
        syncMeals,
        syncUni,
        uniSyncing,
        uniStatus,
        pushProfile,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePlanner() {
  const context = useContext(Context);
  if (!context) throw new Error("PlannerProvider fehlt");
  return context;
}
