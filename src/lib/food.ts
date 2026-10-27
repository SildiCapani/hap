import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { FoodEntry, PlannerState } from "./planner";

export type FoodEstimate = Pick<FoodEntry, "name" | "kcal" | "protein" | "carbs" | "fat"> & {
  confidence: "hoch" | "mittel" | "niedrig";
  hint: string;
  items: (FoodEntry["items"][number] & { protein: number; carbs: number; fat: number })[];
};

const MAX_SIDE = 1024;
const MAX_BYTES = 600 * 1024;

// Browsers: draw the photo straight into a small canvas. The full-size image
// (12–48 MP on current iPhones) is never put on a canvas, which Safari refuses
// above ~16 MP, and the result is re-encoded until it is small enough.
async function compressWeb(asset: ImagePicker.ImagePickerAsset, maxSide = MAX_SIDE, maxBytes = MAX_BYTES): Promise<string> {
  const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Das Foto-Format kann dieser Browser nicht lesen. Stell in den iPhone-Einstellungen unter Kamera → Formate auf „Maximale Kompatibilität“."));
      el.src = url;
    });
    let side = maxSide;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.72, 0.6, 0.5]) {
        const data = canvas.toDataURL("image/jpeg", quality);
        if (data.length * 0.75 <= maxBytes) return data;
      }
      side = Math.round(side * 0.75);
    }
    throw new Error("Das Foto ließ sich nicht verkleinern. Versuch es mit einem Screenshot.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressNative(asset: ImagePicker.ImagePickerAsset, maxSide = MAX_SIDE, maxBytes = MAX_BYTES): Promise<string> {
  const longest = Math.max(asset.width || 0, asset.height || 0);
  const context = ImageManipulator.manipulate(asset.uri);
  // Resize along the longer side so portrait photos shrink as well.
  if (!longest || longest > maxSide)
    context.resize(asset.height > asset.width ? { width: null, height: maxSide } : { width: maxSide, height: null });
  const image = await context.renderAsync();
  for (const compress of [0.7, 0.55, 0.4]) {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (saved.base64 && (saved.base64.length * 0.75 <= maxBytes || compress === 0.4)) return "data:image/jpeg;base64," + saved.base64;
  }
  throw new Error("Das Foto konnte nicht verarbeitet werden.");
}

// Opens camera or gallery and returns a JPEG data URL of at most 1024 px and
// about 600 KB – small enough to upload quickly and cheap to analyse.
export async function pickPhoto(source: "camera" | "library"): Promise<string | null> {
  if (Platform.OS !== "web") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Bitte erlaube Hap den Zugriff auf " + (source === "camera" ? "die Kamera." : "deine Fotos."));
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: "images", quality: 0.8 };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  return Platform.OS === "web" ? compressWeb(asset) : compressNative(asset);
}

// Screenshots keep more pixels than food photos so small list text stays
// readable; a tall iPhone screenshot ends up about 830 × 1800 px.
export async function pickScreenshots(limit = 5): Promise<string[]> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Bitte erlaube Hap den Zugriff auf deine Fotos.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9, allowsMultipleSelection: true, selectionLimit: limit, orderedSelection: true });
  const assets = result.canceled ? [] : (result.assets || []).slice(0, limit);
  const out: string[] = [];
  for (const asset of assets) out.push(Platform.OS === "web" ? await compressWeb(asset, 1800, 700 * 1024) : await compressNative(asset, 1800, 700 * 1024));
  return out;
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
  if (response.status === 400 || response.status === 413) return "Das Foto konnte nicht übertragen werden. Versuch es nochmal oder mach einen Screenshot davon.";
  if (!response.ok) return "Die KI konnte das Foto gerade nicht auswerten. Versuch es nochmal oder trag es manuell ein.";
  return (await response.json()) as FoodEstimate;
}

export function foodTotals(state: PlannerState, day: string) {
  const entries = state.foodLog.filter((f) => f.date === day);
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") => entries.reduce((n, f) => n + f[k], 0);
  // Protein counted with the old quick buttons still counts.
  return { entries, kcal: sum("kcal"), protein: sum("protein") + (state.protein[day] || 0), carbs: sum("carbs"), fat: sum("fat") };
}

export type Product = {
  code: string;
  name: string;
  brand: string;
  per100: { kcal: number; protein: number; carbs: number; fat: number };
  serving: number; // grams, 0 if unknown
  pack: number; // grams of the whole package, 0 if unknown
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."))) || 0;

// Exact values for packaged food from Open Food Facts (free, no key).
export async function lookupBarcode(code: string): Promise<Product | string> {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 8 || clean.length > 14) return "Das ist kein gültiger Barcode (8–14 Ziffern).";
  const response = await fetch(
    "https://world.openfoodfacts.org/api/v2/product/" +
      clean +
      ".json?fields=product_name,product_name_de,brands,nutriments,serving_quantity,product_quantity",
    { signal: AbortSignal.timeout(15000) },
  ).catch(() => null);
  if (!response) return "Open Food Facts ist gerade nicht erreichbar.";
  if (response.status === 404) return "Dieses Produkt kennt Open Food Facts noch nicht. Trag es per Foto oder Text ein.";
  if (!response.ok) return "Open Food Facts antwortet gerade nicht (" + response.status + ").";
  const data = (await response.json()) as { status: number; product?: Record<string, unknown> };
  const p = data.product;
  if (data.status !== 1 || !p) return "Dieses Produkt kennt Open Food Facts noch nicht. Trag es per Foto oder Text ein.";
  const n = (p.nutriments || {}) as Record<string, unknown>;
  const kcal = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
  if (!kcal && !num(n.proteins_100g)) return "Für dieses Produkt fehlen die Nährwerte. Trag es per Foto oder Text ein.";
  return {
    code: clean,
    name: String(p.product_name_de || p.product_name || "Produkt").slice(0, 80),
    brand: String(p.brands || "").split(",")[0].trim().slice(0, 40),
    per100: {
      kcal: Math.round(kcal),
      protein: Math.round(num(n.proteins_100g) * 10) / 10,
      carbs: Math.round(num(n.carbohydrates_100g) * 10) / 10,
      fat: Math.round(num(n.fat_100g) * 10) / 10,
    },
    serving: Math.round(num(p.serving_quantity)),
    pack: Math.round(num(p.product_quantity)),
  };
}

export function portion(product: Product, grams: number) {
  const f = grams / 100;
  return {
    kcal: Math.round(product.per100.kcal * f),
    protein: Math.round(product.per100.protein * f),
    carbs: Math.round(product.per100.carbs * f),
    fat: Math.round(product.per100.fat * f),
  };
}
