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
  importMeals,
  readState,
  storageKey,
  validMealPlan,
  type PlannerState,
} from "./planner";

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
};
const Context = createContext<Store | null>(null);
export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlannerState>(() => createState());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mealStatus, setMealStatus] = useState("");
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
