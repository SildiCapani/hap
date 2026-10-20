import * as DocumentPicker from "expo-document-picker";
import type { ExamKind, PlannerState } from "./planner";

export type ModuleDraft = {
  name: string;
  ects: number;
  exam: "Klausur" | "Abgabe" | "Präsentation" | "Mündlich" | "Sonstiges";
  date: string;
  hours: number;
  topics: string[];
};

export const examKindFor = (exam: ModuleDraft["exam"]): ExamKind =>
  exam === "Abgabe" ? "assignment" : exam === "Präsentation" ? "presentation" : "exam";

async function toDataUrl(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

export async function pickPdf(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if ((asset.size || 0) > 3.2 * 1024 * 1024)
    throw new Error("Die PDF ist zu groß (max. ca. 3 MB). Nimm nur die Seiten mit deinen Modulen oder einen Screenshot.");
  const data = await toDataUrl(asset.uri);
  return data.replace(/^data:[^;]*;/, "data:application/pdf;");
}

export async function scanModules(
  state: Pick<PlannerState, "apiUrl" | "accessToken">,
  input: { text?: string; image?: string; pdf?: string },
): Promise<ModuleDraft[] | string> {
  if (!state.accessToken) return "Dafür braucht Hap deinen persönlichen App-Zugang (Einstellungen).";
  const response = await fetch(state.apiUrl.replace(/\/$/, "") + "/.netlify/functions/module-scan", {
    method: "POST",
    headers: { Authorization: "Bearer " + state.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung. Versuch es gleich nochmal.";
  if (response.status === 429) return "Tageslimit für Modul-Importe erreicht (10 pro Tag).";
  if (response.status === 400) return "Diese Datei kann Hap nicht lesen. Versuch einen Screenshot oder kopierten Text.";
  if (!response.ok) return "Die KI konnte das gerade nicht auswerten (" + response.status + ").";
  return ((await response.json()) as { modules: ModuleDraft[] }).modules;
}
