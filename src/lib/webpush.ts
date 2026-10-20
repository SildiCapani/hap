import { Platform } from "react-native";
import type { Reminder } from "./reminders";

// Push for Hap opened from the home screen (PWA). iOS only allows this for
// web apps added to the home screen (iOS 16.4+); Android Chrome everywhere.
export function webPushSupported() {
  return (
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing || navigator.serviceWorker.register("/sw.js");
}

export async function currentSubscription() {
  if (!webPushSupported()) return null;
  try {
    const reg = await registration();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function endpoint(base: string) {
  return base.replace(/\/$/, "") + "/.netlify/functions/push";
}

// Must run from a tap (iOS requires a user gesture for the permission prompt).
export async function enableWebPush(base: string, token: string): Promise<string> {
  if (!webPushSupported())
    return isIOS() && !isStandalone()
      ? "Auf dem iPhone: zuerst über Teilen → „Zum Home-Bildschirm“ hinzufügen und Hap von dort öffnen."
      : "Dieser Browser unterstützt keine Push-Benachrichtigungen.";
  if (!token) return "Für Push braucht Hap deinen persönlichen App-Zugang – trag ihn unten ein (Wert von HAP_ACCESS_TOKEN).";
  if ((await Notification.requestPermission()) !== "granted")
    return "Benachrichtigungen wurden nicht erlaubt. Du kannst sie in den Browser- bzw. iPhone-Einstellungen freigeben.";
  const config = await fetch(endpoint(base)).catch(() => null);
  if (!config || !config.ok)
    return "Push ist auf Netlify noch nicht eingerichtet (VAPID-Schlüssel fehlen). Bis dahin erinnert Hap dich nur, solange die App offen ist.";
  const { publicKey } = (await config.json()) as { publicKey: string };
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  return "";
}

export async function syncWebPush(base: string, token: string, list: Reminder[]) {
  const sub = await currentSubscription();
  if (!sub || !token) return false;
  const response = await fetch(endpoint(base), {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), reminders: list }),
    signal: AbortSignal.timeout(15000),
  });
  return response.ok;
}

export async function disableWebPush(base: string, token: string) {
  const sub = await currentSubscription();
  if (!sub) return;
  if (token)
    await fetch(endpoint(base), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    }).catch(() => {});
  await sub.unsubscribe().catch(() => false);
}

// Android Chrome offers an install prompt; it is kept until the user taps
// "Installieren". iOS has no prompt, only Teilen → Zum Home-Bildschirm.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event as InstallPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    listeners.forEach((l) => l());
  });
}
export function canPromptInstall() {
  return !!installEvent;
}
export function onInstallChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function promptInstall() {
  if (!installEvent) return false;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  listeners.forEach((l) => l());
  return outcome === "accepted";
}

export async function sendTestPush(base: string, token: string): Promise<string> {
  const sub = await currentSubscription();
  if (!sub) return "Push ist auf diesem Gerät noch nicht aktiv. Schalte zuerst die Erinnerungen ein.";
  const response = await fetch(endpoint(base), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung zu Netlify.";
  if (response.status === 401) return "Der App-Zugang stimmt nicht mit HAP_ACCESS_TOKEN auf Netlify überein.";
  if (!response.ok) return "Netlify konnte die Test-Nachricht nicht senden (" + response.status + ").";
  return "Test gesendet – die Benachrichtigung sollte gleich erscheinen.";
}
