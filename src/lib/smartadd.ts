import { Platform } from "react-native";
import { dateKey, shiftDay, type PlannerState, type Category, type Repeat } from "./planner";
import { agenda } from "./agenda";
import { clock } from "./study";

export type SmartTask = { title: string; date: string; time: string; duration: number; category: Category; repeat: Repeat };

// The next week as compact text, so the AI understands "after the lecture".
export function scheduleContext(state: PlannerState, days = 7) {
  const today = dateKey();
  return Array.from({ length: days }, (_, i) => shiftDay(today, i))
    .map((d) => {
      const items = agenda(state, d).timed.filter((x) => x.kind !== "travel");
      const weekday = new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short" });
      return d + " (" + weekday + "): " + (items.length ? items.map((x) => clock(x.start) + "–" + clock(x.end) + " " + x.title).join("; ") : "frei");
    })
    .join("\n");
}

export async function smartParse(state: PlannerState, text: string): Promise<SmartTask[] | string> {
  if (!state.accessToken) return "Für die KI-Eingabe braucht Hap deinen persönlichen App-Zugang (Einstellungen).";
  const now = new Date();
  const response = await fetch(state.apiUrl.replace(/\/$/, "") + "/.netlify/functions/plan-parse", {
    method: "POST",
    headers: { Authorization: "Bearer " + state.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      now: dateKey(now) + " " + clock(now.getHours() * 60 + now.getMinutes()) + " (" + now.toLocaleDateString("de-DE", { weekday: "long" }) + ")",
      context: scheduleContext(state),
    }),
    signal: AbortSignal.timeout(60000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung. Versuch es gleich nochmal.";
  if (response.status === 429) return "Tageslimit für die KI-Eingabe erreicht.";
  if (!response.ok) return "Die KI konnte den Satz gerade nicht verstehen (" + response.status + ").";
  const { tasks } = (await response.json()) as { tasks: SmartTask[] };
  return tasks.length ? tasks : "Daraus konnte Hap keine Aufgabe machen. Formuliere es etwas genauer.";
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

// Speech input in browsers that support it (Safari, Chrome); in the native
// app the keyboard's dictation button does the same.
export function speechAvailable() {
  return Platform.OS === "web" && typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
}

export function listen(onText: (text: string) => void, onEnd: () => void) {
  const w = window as unknown as Record<string, new () => Recognition>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  const r = new Ctor();
  r.lang = "de-DE";
  r.interimResults = true;
  r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
  r.onend = onEnd;
  r.onerror = onEnd;
  r.start();
  return () => r.stop();
}
