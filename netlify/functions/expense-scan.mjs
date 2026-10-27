import { authorized, json, shift } from "../lib/meals.mjs";
import { aiConfigured, structured, withinDailyLimit } from "../lib/ai.mjs";
import { validImage } from "../lib/food.mjs";

// Reads card payments from screenshots (Apple Wallet, Trade Republic, bank
// apps) and sorts them into Hap's expense categories. The app shows the
// result for review; nothing is booked here.
export const CATEGORY_KEYS = ["essen", "mensa", "freizeit", "mobil", "uni", "kleidung", "haushalt", "gesundheit", "geschenke", "sonstiges"];
const TYPES = ["expense", "refund", "income", "transfer"];

export const expenseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "merchant", "amount", "type", "category"],
        properties: {
          date: { type: "string" },
          merchant: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: TYPES },
          category: { type: "string", enum: CATEGORY_KEYS },
        },
      },
    },
  },
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function cleanExpenses(result, today) {
  return (result?.items || [])
    .filter((i) => i && typeof i.merchant === "string" && Number.isFinite(Number(i.amount)) && Math.abs(Number(i.amount)) > 0)
    .slice(0, 80)
    .map((i) => ({
      // A date the model could not read, or one in the future, becomes today.
      date: DAY.test(i.date) && i.date <= today && i.date >= shift(today, -120) ? i.date : today,
      merchant: i.merchant.trim().slice(0, 60) || "Unbekannt",
      amount: Math.round(Math.min(10000, Math.abs(Number(i.amount))) * 100) / 100,
      type: TYPES.includes(i.type) ? i.type : "expense",
      category: CATEGORY_KEYS.includes(i.category) ? i.category : "sonstiges",
    }));
}

const weekday = (day) => new Date(day + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "long", timeZone: "UTC" });

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!process.env.HAP_ACCESS_TOKEN || process.env.HAP_ACCESS_TOKEN.length < 32) return json({ error: "Not configured" }, 503);
  if (!authorized(request, process.env.HAP_ACCESS_TOKEN)) return json({ error: "Unauthorized" }, 401);
  if (!aiConfigured()) return json({ error: "Not configured" }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const images = Array.isArray(body?.images) ? body.images : [];
  const today = typeof body?.today === "string" && DAY.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  if (!images.length || images.length > 5 || !images.every(validImage)) return json({ error: "Invalid input" }, 400);
  if (!(await withinDailyLimit("expenses", 20))) return json({ error: "Daily limit reached" }, 429);
  const content = [
    { type: "input_text", text: "Heute ist " + weekday(today) + ", der " + today + ". Lies alle Umsätze aus " + (images.length === 1 ? "dem Screenshot" : "den " + images.length + " Screenshots") + "." },
    ...images.map((image) => ({ type: "input_image", image_url: image, detail: "high" })),
  ];
  try {
    const result = await structured({
      name: "card_payments",
      maxTokens: 4000,
      instructions: [
        "Du liest Umsätze aus Screenshots von Apple Wallet, Trade Republic oder Banking-Apps eines Studenten in Stuttgart (Deutschland, Euro).",
        "Pro Umsatz: Datum als JJJJ-MM-TT, Händler (kurz und lesbar, z. B. „Rewe“, „DB“, „Lidl“), Betrag als positive Zahl in Euro, Typ und Kategorie.",
        "Datum: Löse relative Angaben vom heutigen Datum aus auf („Heute“, „Gestern“, Wochentage = der letzte vergangene, Datum ohne Jahr = das letzte vergangene). Steht ein Umsatz unter einer Datums-Überschrift, gilt dieses Datum. Ist kein Datum erkennbar, nimm das heutige.",
        "Typ: expense = Kartenzahlung/Ausgabe (auch „Ausstehend“). refund = Erstattung/Gutschrift eines Händlers. income = Gehalt oder Geld von Personen. transfer = Sparplan, Round-up, Saveback, Wertpapierkauf/-verkauf, Zinsen, Überweisung zwischen eigenen Konten, Bargeldabhebung zählt als expense.",
        "Kategorie (nur bei expense wichtig, sonst „sonstiges“): essen = Supermarkt, Lebensmittel, Lieferdienst, Restaurant-Einkauf; mensa = Mensa, Café, Bäcker, Coffee-Shop; freizeit = Bars, Restaurants, Kino, Events, Spiele, Streaming-Einzelkäufe; mobil = SSB, DB, Tanken, Taxi, Flüge, E-Scooter; uni = Bücher, Druck, Uni-Gebühren, Software fürs Studium; kleidung = Kleidung, Schuhe; haushalt = Drogerie für Haushalt, Möbel, Elektro-Kleinkram, IKEA; gesundheit = Apotheke, Fitnessstudio, Sport, Arzt; geschenke = Geschenke, Blumen; sonstiges = alles andere oder unklar.",
        "Jeden Umsatz nur einmal, auch wenn er auf mehreren Screenshots zu sehen ist. Erfinde nichts; lies nur, was sichtbar ist. Ohne erkennbare Umsätze gib eine leere Liste zurück.",
      ].join("\n"),
      content,
      schema: expenseSchema,
    });
    return json({ items: cleanExpenses(result, today) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Expense scan failed");
    return json({ error: "Failed" }, 502);
  }
}
