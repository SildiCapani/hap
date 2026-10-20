import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { FoodEntry, PlannerState } from "./planner";

export type FoodEstimate = Pick<FoodEntry, "name" | "kcal" | "protein" | "carbs" | "fat"> & {
  confidence: "hoch" | "mittel" | "niedrig";
  hint: string;
  items: (FoodEntry["items"][number] & { protein: number; carbs: number; fat: number })[];
};

// Opens camera or gallery and returns a JPEG data URL of at most 1024 px,
// small enough to upload quickly and cheap to analyse.
export async function pickPhoto(source: "camera" | "library"): Promise<string | null> {
  if (Platform.OS !== "web") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Bitte erlaube Hap den Zugriff auf " + (source === "camera" ? "die Kamera." : "deine Fotos."));
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: "images", quality: 0.9 };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1024) context.resize({ width: 1024, height: null });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return saved.base64 ? "data:image/jpeg;base64," + saved.base64 : null;
}

export async function scanFood(
  state: Pick<PlannerState, "apiUrl" | "accessToken">,
  input: { image?: string; note?: string },
): Promise<FoodEstimate | string> {
  if (!state.accessToken) return "Für die Kalorien-Schätzung braucht Hap deinen persönlichen App-Zugang (Einstellungen).";
  const response = await fetch(state.apiUrl.replace(/\/$/, "") + "/.netlify/functions/food-scan", {
    method: "POST",
    headers: { Authorization: "Bearer " + state.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(70000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung. Versuch es gleich nochmal.";
  if (response.status === 401) return "Der App-Zugang stimmt nicht mit HAP_ACCESS_TOKEN auf Netlify überein.";
  if (response.status === 429) return "Tageslimit für Foto-Analysen erreicht (schützt vor Kosten). Morgen geht es weiter – oder trag die Mahlzeit manuell ein.";
  if (response.status === 503 || response.status === 404) return "Die Analyse ist auf Netlify noch nicht verfügbar (neu deployen, OPENAI_API_KEY prüfen).";
  if (!response.ok) return "Die KI konnte das Foto gerade nicht auswerten. Versuch es nochmal oder trag es manuell ein.";
  return (await response.json()) as FoodEstimate;
}

export function foodTotals(state: PlannerState, day: string) {
  const entries = state.foodLog.filter((f) => f.date === day);
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") => entries.reduce((n, f) => n + f[k], 0);
  // Protein counted with the old quick buttons still counts.
  return { entries, kcal: sum("kcal"), protein: sum("protein") + (state.protein[day] || 0), carbs: sum("carbs"), fat: sum("fat") };
}
