import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Check, ImagePlus, Minus, Plus, RefreshCw, Square, SquareCheck, Trash2, TrendingUp, Wallet } from "lucide-react-native";
import { newId, parseDate, shiftDay, type Holding, type MoneyEntry, type MoneyRule } from "@/lib/planner";
import {
  categories,
  categoryOf,
  depotHistory,
  euro,
  fetchQuotes,
  holdingNow,
  kinds,
  monthly,
  parseAmount,
  period,
  periodSummary,
  projection,
  round2,
  reviewScan,
  savingsCheck,
  scanEntry,
  scanExpenses,
  type Booking,
  type ScanRow,
} from "@/lib/money";
import { pickScreenshots } from "@/lib/food";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { BarChart, Sparkline } from "./charts";
import { DateField } from "./pickers";
import { Section, Tiles, Tips } from "./history";
import { Button, C, Chip, Field, Sheet, Shell, s, useToday } from "./planner-ui";

const green = "#98C5A9";
const red = "#F5A38F";
const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const short = (d: string) => parseDate(d).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
const long = (d: string) => parseDate(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
const when = (r: Pick<MoneyRule, "every" | "day">) => (r.every === "week" ? "jeden " + weekdays[r.day] : "am " + r.day + ".");
const plain = (n: number) => String(n).replace(".", ",");

function Card({ children }: { children: ReactNode }) {
  return <View style={[s.card, { padding: 18, gap: 14 }]}>{children}</View>;
}

function Amount({ label, value, onChange, width = 120 }: { label: string; value: string; onChange: (v: string) => void; width?: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.row, { width, gap: 4, paddingHorizontal: 12, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#26262C", backgroundColor: "#0B0B0D" }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          inputMode="decimal"
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={label}
          placeholder="0"
          placeholderTextColor="#6F6D76"
          style={{ flex: 1, minWidth: 0, color: C.ink, fontSize: 17, fontWeight: "700", padding: 0, fontVariant: ["tabular-nums"] }}
        />
        <Text style={s.muted}>€</Text>
      </View>
    </View>
  );
}

function DayStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const set = (n: number) => {
    tap("select");
    onChange(((n - 1 + 31) % 31) + 1);
  };
  const button = { width: 44, height: 46, alignItems: "center", justifyContent: "center" } as const;
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>Tag im Monat</Text>
      <View style={[s.row, { gap: 0, alignSelf: "flex-start", backgroundColor: "#1C1C21", borderRadius: 14 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Früher im Monat" onPress={() => set(value - 1)} style={button}>
          <Minus size={16} color={C.muted} />
        </Pressable>
        <Text style={{ width: 44, textAlign: "center", color: C.ink, fontSize: 17, fontWeight: "700" }}>{value}.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Später im Monat" onPress={() => set(value + 1)} style={button}>
          <Plus size={16} color={C.muted} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Setup ----------

function Setup() {
  const { update } = usePlanner();
  const today = useToday();
  type SetupRow = { key: string; name: string; kind: MoneyRule["kind"]; every: MoneyRule["every"]; amount: string; day: number };
  const [rows, setRows] = useState<SetupRow[]>([
    { key: "salary", name: "Gehalt", kind: "income", every: "month", amount: "1.250", day: 25 },
    { key: "weekly", name: "Wöchentliches Geld", kind: "income", every: "week", amount: "47", day: 1 },
    { key: "rent", name: "Warmmiete", kind: "fixed", every: "month", amount: "600", day: 1 },
    { key: "power", name: "Strom", kind: "fixed", every: "month", amount: "35", day: 1 },
    { key: "net", name: "Internet", kind: "fixed", every: "month", amount: "27", day: 1 },
  ]);
  const set = (key: string, patch: Partial<SetupRow>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  function save() {
    const payday = rows[0].day;
    const start = period(payday, today).start;
    tap("success");
    update((prev) => ({
      ...prev,
      payday,
      moneyRules: [
        ...prev.moneyRules,
        ...rows
          .filter((r) => parseAmount(r.amount) > 0)
          .map((r): MoneyRule => ({ id: newId("mr"), kind: r.kind, name: r.name, amount: parseAmount(r.amount), every: r.every, day: r.day, start })),
      ],
    }));
  }
  return (
    <Card>
      <View style={s.row}>
        <Wallet size={20} color={C.green} />
        <Text style={s.h2}>Dein Geld einrichten</Text>
      </View>
      <Text style={[s.muted, { lineHeight: 20 }]}>
        Trag ein, was regelmäßig kommt und geht. Hap bucht es dann automatisch – du trägst nur noch Alltagsausgaben ein. Alles ist später änderbar.
      </Text>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
          <Text style={s.h3}>{r.name}</Text>
          <View style={[s.row, { flexWrap: "wrap", alignItems: "flex-end", gap: 12 }]}>
            <Amount label="Betrag" value={r.amount} onChange={(v) => set(r.key, { amount: v })} />
            {r.every === "month" ? (
              <DayStepper value={r.day} onChange={(day) => set(r.key, { day })} />
            ) : (
              <View style={[s.wrap, { flex: 1, minWidth: 200 }]}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <Chip key={d} label={weekdays[d].slice(0, 2)} active={r.day === d} onPress={() => set(r.key, { day: d })} />
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
      <Text style={s.micro}>Der Tag deines Gehalts ist dein Monatsanfang: Hap rechnet immer „bis zum nächsten Gehalt“. Abos und Sparpläne fügst du danach unten hinzu.</Text>
      <Button icon={Check} onPress={save}>Übernehmen</Button>
    </Card>
  );
}

// ---------- Sheets ----------

function EntrySheet({ entry, kind, close }: { entry?: MoneyEntry; kind: MoneyEntry["kind"]; close: () => void }) {
  const { update } = usePlanner();
  const today = useToday();
  const [type, setType] = useState(entry?.kind || kind);
  const [amount, setAmount] = useState(entry ? plain(entry.amount) : "");
  const [category, setCategory] = useState(entry?.category || "essen");
  const [note, setNote] = useState(entry?.note || "");
  const [date, setDate] = useState(entry?.date || today);
  const value = parseAmount(amount);
  function save() {
    if (!(value > 0)) return;
    tap("success");
    const next: MoneyEntry = { id: entry?.id || newId("me"), date, amount: value, kind: type, category: type === "income" ? "einnahme" : category, note: note.trim().slice(0, 80) };
    update((prev) => ({ ...prev, moneyEntries: [...prev.moneyEntries.filter((e) => e.id !== next.id), next] }));
    close();
  }
  return (
    <Sheet
      title={entry ? "Eintrag bearbeiten" : type === "expense" ? "Ausgabe" : "Einnahme"}
      close={close}
      footer={
        <>
          {entry && (
            <Button
              quiet
              danger
              icon={Trash2}
              onPress={() => {
                update((prev) => ({ ...prev, moneyEntries: prev.moneyEntries.filter((e) => e.id !== entry.id) }));
                close();
              }}
            >
              Löschen
            </Button>
          )}
          <Button icon={Check} disabled={!(value > 0)} onPress={save}>Speichern</Button>
        </>
      }
    >
      <View style={s.wrap}>
        <Chip label="Ausgabe" active={type === "expense"} onPress={() => setType("expense")} />
        <Chip label="Einnahme" active={type === "income"} color={green} onPress={() => setType("income")} />
      </View>
      <Amount label="Betrag" value={amount} onChange={setAmount} width={180} />
      {type === "expense" && (
        <View>
          <Text style={s.label}>Wofür?</Text>
          <View style={s.wrap}>
            {categories.map((c) => (
              <Chip key={c.key} label={c.label} active={category === c.key} color={c.color} onPress={() => setCategory(c.key)} />
            ))}
          </View>
        </View>
      )}
      <Field label="Notiz" value={note} onChangeText={setNote} placeholder={type === "expense" ? "z. B. Rewe Wocheneinkauf" : "z. B. Nebenjob, Geschenk"} maxLength={80} />
      <DateField label="Datum" value={date} onChange={setDate} />
    </Sheet>
  );
}

function RuleSheet({ rule, kind, close }: { rule?: MoneyRule; kind: MoneyRule["kind"]; close: () => void }) {
  const { state, update } = usePlanner();
  const today = useToday();
  const [type, setType] = useState(rule?.kind || kind);
  const [name, setName] = useState(rule?.name || "");
  const [amount, setAmount] = useState(rule ? plain(rule.amount) : "");
  const [every, setEvery] = useState(rule?.every || "month");
  const [day, setDay] = useState(rule?.day ?? (kind === "saving" ? 2 : 1));
  const [holding, setHolding] = useState(rule?.holdingId || state.holdings.find((h) => !h.cash)?.id || "");
  const value = parseAmount(amount);
  const ok = name.trim() && value > 0;
  function save() {
    if (!ok) return;
    tap("success");
    const next: MoneyRule = {
      id: rule?.id || newId("mr"),
      kind: type,
      name: name.trim().slice(0, 50),
      amount: value,
      every,
      day: every === "week" ? day % 7 : Math.min(31, Math.max(1, day)),
      start: rule?.start || period(state.payday, today).start,
      ...(rule?.end ? { end: rule.end } : {}),
      ...(type === "saving" && holding ? { holdingId: holding } : {}),
    };
    update((prev) => ({ ...prev, moneyRules: [...prev.moneyRules.filter((r) => r.id !== next.id), next] }));
    close();
  }
  const placeholder = { income: "z. B. Gehalt", fixed: "z. B. Warmmiete", abo: "z. B. iCloud 50 GB", saving: "z. B. ETF-Sparplan" }[type];
  return (
    <Sheet
      title={rule ? rule.name : "Neu: " + kinds[type].label}
      subtitle={type === "saving" ? "Wird jeden Termin automatisch eingezahlt und als Anteile gutgeschrieben." : "Wird automatisch gebucht, du musst nichts mehr eintragen."}
      close={close}
      footer={
        <>
          {rule && (
            <Button
              quiet
              danger
              icon={Trash2}
              onPress={() => {
                // Ending keeps past months correct; deleting removes it everywhere.
                update((prev) => ({
                  ...prev,
                  moneyRules: rule.start >= today ? prev.moneyRules.filter((r) => r.id !== rule.id) : prev.moneyRules.map((r) => (r.id === rule.id ? { ...r, end: shiftDay(today, -1) } : r)),
                }));
                close();
              }}
            >
              {type === "abo" ? "Gekündigt" : "Beenden"}
            </Button>
          )}
          <Button icon={Check} disabled={!ok} onPress={save}>Speichern</Button>
        </>
      }
    >
      {!rule && (
        <View style={s.wrap}>
          {(Object.keys(kinds) as MoneyRule["kind"][]).map((k) => (
            <Chip key={k} label={kinds[k].label} active={type === k} color={kinds[k].color} onPress={() => setType(k)} />
          ))}
        </View>
      )}
      <Field label="Name" value={name} onChangeText={setName} placeholder={placeholder} maxLength={50} />
      <Amount label="Betrag" value={amount} onChange={setAmount} width={160} />
      <View style={s.wrap}>
        <Chip label="Monatlich" active={every === "month"} onPress={() => { setEvery("month"); setDay(1); }} />
        <Chip label="Wöchentlich" active={every === "week"} onPress={() => { setEvery("week"); setDay(1); }} />
      </View>
      {every === "month" ? (
        <DayStepper value={day} onChange={setDay} />
      ) : (
        <View style={s.wrap}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Chip key={d} label={weekdays[d]} active={day === d} onPress={() => setDay(d)} />
          ))}
        </View>
      )}
      {type === "saving" && (
        <View>
          <Text style={s.label}>Geht in</Text>
          <View style={s.wrap}>
            {state.holdings.map((h) => (
              <Chip key={h.id} label={h.name} active={holding === h.id} color={kinds.saving.color} onPress={() => setHolding(h.id)} />
            ))}
            <Chip label="Ohne Depot" active={!holding} onPress={() => setHolding("")} />
          </View>
          {!state.holdings.length && <Text style={[s.micro, { marginTop: 8 }]}>Leg unter „Depot“ zuerst deinen ETF an, dann rechnet Hap die gekauften Anteile mit.</Text>}
        </View>
      )}
      {rule?.end && <Text style={s.micro}>Beendet am {long(rule.end)}. Speichern übernimmt nur die Änderungen.</Text>}
    </Sheet>
  );
}

function BookingSheet({ booking, close, editRule }: { booking: Booking; close: () => void; editRule: () => void }) {
  const { update } = usePlanner();
  const key = booking.rule.id + ":" + booking.date;
  const [amount, setAmount] = useState(plain(booking.amount));
  const value = parseAmount(amount);
  const set = (v: number | null) => {
    tap("success");
    update((prev) => {
      const next = { ...prev.moneyOverrides };
      if (v === null) delete next[key];
      else next[key] = v;
      return { ...prev, moneyOverrides: next };
    });
    close();
  };
  return (
    <Sheet
      title={booking.rule.name}
      subtitle={long(booking.date) + " · normal " + euro(booking.rule.amount)}
      close={close}
      footer={
        <>
          <Button quiet onPress={editRule}>Immer ändern</Button>
          <Button icon={Check} disabled={!(value >= 0)} onPress={() => set(value === booking.rule.amount ? null : value)}>Nur diesmal</Button>
        </>
      }
    >
      <Amount label={booking.rule.kind === "income" ? "Diesmal bekommen" : "Diesmal bezahlt"} value={amount} onChange={setAmount} width={180} />
      <View style={s.wrap}>
        <Chip label="Fiel diesmal aus (0 €)" active={value === 0} onPress={() => setAmount("0")} />
        {booking.amount !== booking.rule.amount && <Chip label={"Zurück auf " + euro(booking.rule.amount)} active={false} onPress={() => set(null)} />}
      </View>
      {booking.rule.kind === "income" && booking.rule.every === "month" && (
        <Text style={[s.micro, { lineHeight: 18 }]}>Z. B. wenn die Mensa vom Gehalt abgezogen wird: Trag hier ein, was diesen Monat wirklich ankam. Nächsten Monat gilt wieder {euro(booking.rule.amount)}.</Text>
      )}
    </Sheet>
  );
}

function BudgetSheet({ close }: { close: () => void }) {
  const { state, update } = usePlanner();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(categories.map((c) => [c.key, state.budgets[c.key] ? plain(state.budgets[c.key]) : ""])));
  return (
    <Sheet
      title="Budgets pro Monat"
      subtitle="Leer lassen, wenn du für eine Kategorie kein Limit willst."
      close={close}
      footer={
        <Button
          icon={Check}
          onPress={() => {
            tap("success");
            const budgets = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseAmount(v)]).filter(([, v]) => (v as number) > 0));
            update((prev) => ({ ...prev, budgets }));
            close();
          }}
        >
          Speichern
        </Button>
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {categories.map((c) => (
          <View key={c.key} style={{ flexBasis: "45%", flexGrow: 1 }}>
            <Amount label={c.label} value={values[c.key]} onChange={(v) => setValues({ ...values, [c.key]: v })} width={140} />
          </View>
        ))}
      </View>
    </Sheet>
  );
}

function HoldingSheet({ holding, close }: { holding?: Holding; close: () => void }) {
  const { update } = usePlanner();
  const today = useToday();
  const [name, setName] = useState(holding?.name || "");
  const [cash, setCash] = useState(holding?.cash || false);
  const [isin, setIsin] = useState(holding?.isin || "");
  const [symbol, setSymbol] = useState(holding?.symbol || "");
  const [shares, setShares] = useState(holding ? plain(holding.shares) : "");
  const [invested, setInvested] = useState(holding ? plain(holding.invested) : "");
  const cleanIsin = isin.trim().toUpperCase();
  const isinOk = !cleanIsin || /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(cleanIsin);
  const pieces = Number(shares.replace(",", ".")) || 0;
  const ok = name.trim() && isinOk && (cash || cleanIsin || symbol.trim());
  function save() {
    if (!ok) return;
    tap("success");
    const paid = parseAmount(invested) || 0;
    // A new number from the broker app becomes the new starting point.
    const changed = !holding || holding.shares !== pieces || holding.invested !== paid;
    const next: Holding = {
      id: holding?.id || newId("hd"),
      name: name.trim().slice(0, 50),
      cash,
      isin: cash ? "" : cleanIsin,
      symbol: cash ? "" : symbol.trim().toUpperCase().slice(0, 20),
      shares: cash ? 0 : pieces,
      invested: paid,
      since: changed ? today : holding.since,
    };
    update((prev) => {
      const quotes = { ...prev.quotes };
      if (holding && (holding.isin !== next.isin || holding.symbol !== next.symbol)) delete quotes[next.id];
      return { ...prev, holdings: [...prev.holdings.filter((h) => h.id !== next.id), next], quotes };
    });
    close();
  }
  return (
    <Sheet
      title={holding ? holding.name : "Neue Position"}
      subtitle="Werte aus deiner Trade-Republic-App übernehmen. Danach rechnet Hap jeden Sparplan automatisch dazu."
      close={close}
      footer={
        <>
          {holding && (
            <Button
              quiet
              danger
              icon={Trash2}
              onPress={() => {
                update((prev) => ({
                  ...prev,
                  holdings: prev.holdings.filter((h) => h.id !== holding.id),
                  moneyRules: prev.moneyRules.map((r) => (r.holdingId === holding.id ? { ...r, holdingId: undefined } : r)),
                }));
                close();
              }}
            >
              Entfernen
            </Button>
          )}
          <Button icon={Check} disabled={!ok} onPress={save}>Speichern</Button>
        </>
      }
    >
      <View style={s.wrap}>
        <Chip label="ETF / Aktie" active={!cash} color={kinds.saving.color} onPress={() => setCash(false)} />
        <Chip label="Tagesgeld / Konto" active={cash} color="#92B9DB" onPress={() => setCash(true)} />
      </View>
      <Field label="Name" value={name} onChangeText={setName} placeholder={cash ? "z. B. Notgroschen" : "z. B. FTSE All-World"} maxLength={50} />
      {!cash && (
        <>
          <Field label="ISIN" value={isin} onChangeText={setIsin} placeholder="z. B. IE00BK5BQT80" autoCapitalize="characters" maxLength={12} />
          {!isinOk && <Text style={s.formError}>Eine ISIN hat 12 Zeichen, z. B. IE00BK5BQT80.</Text>}
          <Field label="Kürzel (nur falls die ISIN nicht gefunden wird)" value={symbol} onChangeText={setSymbol} placeholder="z. B. VWCE.DE" autoCapitalize="characters" maxLength={20} />
        </>
      )}
      <View style={[s.row, { flexWrap: "wrap", gap: 12, alignItems: "flex-end" }]}>
        {!cash && (
          <View style={{ gap: 6 }}>
            <Text style={s.label}>Stücke jetzt</Text>
            <TextInput
              value={shares}
              onChangeText={setShares}
              inputMode="decimal"
              keyboardType="decimal-pad"
              accessibilityLabel="Stücke jetzt"
              placeholder="z. B. 3,4521"
              placeholderTextColor="#6F6D76"
              style={[s.input, { width: 140 }]}
            />
          </View>
        )}
        <Amount label={cash ? "Kontostand jetzt" : "Bisher eingezahlt"} value={invested} onChange={setInvested} width={150} />
      </View>
      <Text style={[s.micro, { lineHeight: 18 }]}>
        {cash
          ? "Sparpläne auf dieses Konto erhöhen den Stand automatisch."
          : "In Trade Republic: Position antippen → dort stehen Stücke und „Investiert“. Ab heute zählt Hap jeden Sparplan als Kauf zum Tageskurs dazu. Weicht es mal ab, trag hier einfach die neuen Zahlen ein."}
      </Text>
    </Sheet>
  );
}

function HistorySheet({ close }: { close: () => void }) {
  const { state } = usePlanner();
  const today = useToday();
  const list = [5, 4, 3, 2, 1, 0].map((i) => periodSummary(state, today, i)).filter((p) => p.bookings.length || p.entries.length);
  return (
    <Sheet title="Geld: Verlauf" subtitle="Jeder Zeitraum läuft von Gehalt zu Gehalt." close={close}>
      {list.length ? (
        <>
          <Section title="Ausgaben (ohne Sparen)" detail="Strich = Einnahmen">
            <BarChart
              color="#F4F3F1"
              data={list.map((p) => ({ value: round2(p.fixed + p.abos + p.spent), target: p.income, label: short(p.start) + "–" + short(p.end) + ": " + euro(p.fixed + p.abos + p.spent) + " ausgegeben von " + euro(p.income) }))}
              labels={list.length > 1 ? [short(list[0].start), short(list[list.length - 1].start)] : [short(list[0].start)]}
            />
          </Section>
          <Section title="Zeiträume">
            {[...list].reverse().map((p) => (
              <View key={p.start} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 4 }}>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Text style={[s.body, { fontWeight: "600" }]}>{short(p.start)} – {short(p.end)}</Text>
                  <Text style={[s.h3, { color: p.free >= 0 ? green : red }]}>{(p.free >= 0 ? "+" : "") + euro(p.free, false)}</Text>
                </View>
                <Text style={s.micro}>
                  Rein {euro(p.income, false)} · Fix & Abos {euro(p.fixed + p.abos, false)} · Ausgaben {euro(p.spent, false)} · Gespart {euro(p.saved, false)}
                </Text>
                {p.byCategory.length > 0 && (
                  <Text style={s.micro} numberOfLines={2}>
                    {p.byCategory.filter((c) => c.spent).sort((a, b) => b.spent - a.spent).slice(0, 4).map((c) => c.label + " " + euro(c.spent, false)).join(" · ")}
                  </Text>
                )}
              </View>
            ))}
          </Section>
        </>
      ) : (
        <Text style={s.micro}>Noch keine Daten.</Text>
      )}
    </Sheet>
  );
}

// ---------- Screenshot-Import ----------

const reasonText: Record<ScanRow["reason"], string> = {
  "": "",
  before: "vor diesem Gehaltsmonat",
  duplicate: "schon eingetragen",
  fixed: "bucht Hap schon (Fixkosten, Abo, Sparplan)",
  other: "",
};
const typeText = { refund: "Erstattung", income: "Einnahme", transfer: "Sparplan / Umbuchung – zählt nicht", expense: "" };

function ScanSheet({ close }: { close: () => void }) {
  const { state, update } = usePlanner();
  const today = useToday();
  const { start } = period(state.payday, today);
  const [phase, setPhase] = useState<{ busy: number; error: string }>({ busy: 0, error: "" });
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [open, setOpen] = useState("");
  const picked = (rows || []).filter((r) => r.pick);
  const total = round2(picked.reduce((n, r) => n + (r.type === "expense" ? r.amount : 0), 0));

  async function choose() {
    let images: string[];
    try {
      images = await pickScreenshots(5);
    } catch (error) {
      return setPhase({ busy: 0, error: error instanceof Error ? error.message : "Die Bilder konnten nicht geladen werden." });
    }
    if (!images.length) return;
    setPhase({ busy: images.length, error: "" });
    const result = await scanExpenses(state, images, today);
    if (typeof result === "string") return setPhase({ busy: 0, error: result });
    setPhase({ busy: 0, error: result.length ? "" : "Auf den Screenshots waren keine Umsätze zu erkennen." });
    setRows(result.length ? reviewScan(state, result, today) : null);
  }
  const change = (key: string, next: Partial<ScanRow>) => setRows((list) => (list || []).map((r) => (r.key === key ? { ...r, ...next } : r)));
  function save() {
    tap("success");
    const added = picked.map((r) => scanEntry(r, newId("me")));
    update((prev) => ({ ...prev, moneyEntries: [...prev.moneyEntries, ...added] }));
    close();
  }

  return (
    <Sheet
      title="Aus Screenshots"
      subtitle={"Gehaltsmonat seit " + long(start)}
      close={close}
      footer={
        rows ? (
          <>
            <Button quiet icon={ImagePlus} onPress={() => void choose()} disabled={!!phase.busy}>Andere</Button>
            <Button icon={Check} disabled={!picked.length} onPress={save}>
              {picked.length ? picked.length + " eintragen · " + euro(total) : "Nichts ausgewählt"}
            </Button>
          </>
        ) : undefined
      }
    >
      {phase.busy ? (
        <View style={[s.row, { gap: 12, paddingVertical: 24, justifyContent: "center" }]}>
          <ActivityIndicator color={C.green} />
          <Text style={s.muted}>Lese {phase.busy === 1 ? "den Screenshot" : phase.busy + " Screenshots"} … (bis zu 1 Minute)</Text>
        </View>
      ) : rows ? (
        <View>
          <Text style={[s.micro, { marginBottom: 6 }]}>Haken = wird eingetragen. Antippen ändert die Kategorie.</Text>
          {rows.map((r) => {
            const c = categoryOf(r.category);
            const why = reasonText[r.reason];
            const Box = r.pick ? SquareCheck : Square;
            return (
              <View key={r.key} style={{ borderBottomWidth: 1, borderBottomColor: C.line, opacity: r.pick ? 1 : 0.6 }}>
                <View style={[s.row, { gap: 10, minHeight: 52 }]}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: r.pick, disabled: r.type === "transfer" }}
                    accessibilityLabel={r.merchant + " übernehmen"}
                    disabled={r.type === "transfer"}
                    onPress={() => change(r.key, { pick: !r.pick })}
                    hitSlop={8}
                  >
                    <Box size={22} color={r.pick ? C.green : C.muted} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setOpen(open === r.key ? "" : r.key)} disabled={r.type !== "expense"} style={[s.row, { flex: 1, gap: 10, minWidth: 0 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.body, { fontSize: 15 }]} numberOfLines={1}>{r.merchant}</Text>
                      <Text style={s.micro} numberOfLines={1}>
                        {short(r.date)} · {r.type === "expense" ? c.label : typeText[r.type]}
                        {why ? " · " + why : ""}
                      </Text>
                    </View>
                    <Text style={[s.body, { fontWeight: "600", fontVariant: ["tabular-nums"] }, r.type !== "expense" ? { color: green } : null]}>
                      {(r.type === "expense" ? "−" : "+") + euro(r.amount)}
                    </Text>
                  </Pressable>
                </View>
                {open === r.key && (
                  <View style={[s.wrap, { paddingBottom: 12 }]}>
                    {categories.map((k) => (
                      <Chip key={k.key} label={k.label} active={r.category === k.key} color={k.color} onPress={() => { change(r.key, { category: k.key }); setOpen(""); }} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={[s.body, { lineHeight: 22 }]}>
            Mach Screenshots von deiner Umsatzliste in Wallet oder Trade Republic – bis zu 5 auf einmal. Hap liest Datum, Händler und Betrag aus und sortiert sie in Kategorien. Du prüfst alles, bevor es eingetragen wird.
          </Text>
          <Text style={s.micro}>
            Was vor dem letzten Gehalt war, schon eingetragen ist oder von Hap selbst gebucht wird (Miete, Abos, Sparplan), ist nicht angehakt. Die Bilder gehen zum Auslesen an OpenAI und werden nicht gespeichert.
          </Text>
          <View style={s.row}>
            <Button icon={ImagePlus} onPress={() => void choose()}>Screenshots auswählen</Button>
          </View>
        </View>
      )}
      {phase.error ? <Text style={s.formError}>{phase.error}</Text> : null}
    </Sheet>
  );
}

// ---------- Screen ----------

function Row({ dot, title, sub, value, valueColor, onPress, dim }: { dot: string; title: string; sub?: string; value: string; valueColor?: string; onPress?: () => void; dim?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.row, { gap: 12, minHeight: 48, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line, opacity: dim ? 0.6 : 1 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.body, { fontSize: 15 }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.micro} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text style={[s.body, { fontWeight: "600", fontVariant: ["tabular-nums"] }, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </Pressable>
  );
}

function MoneyContent() {
  const { state, update } = usePlanner();
  const today = useToday();
  const [entry, setEntry] = useState<{ entry?: MoneyEntry; kind: MoneyEntry["kind"] } | null>(null);
  const [rule, setRule] = useState<{ rule?: MoneyRule; kind: MoneyRule["kind"] } | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [holding, setHolding] = useState<Holding | "new" | null>(null);
  const [budgets, setBudgets] = useState(false);
  const [history, setHistory] = useState(false);
  const [scan, setScan] = useState(false);
  const [quoteState, setQuoteState] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const [years, setYears] = useState(10);
  const p = periodSummary(state, today);
  const check = savingsCheck(state, today);
  const [perMonth, setPerMonth] = useState(Math.round(check.saving));
  const out = p.fixed + p.abos;
  const total = Math.max(1, p.income);
  const bar = (n: number) => (Math.max(0, Math.min(1, n / total)) * 100 + "%") as `${number}%`;

  const tracked = state.holdings.filter((h) => !h.cash && (h.isin || h.symbol));
  async function refresh() {
    setQuoteState({ busy: true, error: "" });
    const result = await fetchQuotes(state);
    if (typeof result === "string") return setQuoteState({ busy: false, error: result });
    const missing = tracked.filter((h) => !result.quotes[h.id]);
    const refused = missing.filter((h) => result.errors[h.id] === "refused");
    const unknown = missing.filter((h) => result.errors[h.id] !== "refused").map((h) => h.name);
    update((prev) => {
      const quotes = { ...prev.quotes };
      for (const [id, q] of Object.entries(result.quotes)) if (q) quotes[id] = q;
      return { ...prev, quotes };
    });
    const error = [
      refused.length ? "Yahoo Finance lehnt die Kursabfrage gerade ab – später nochmal mit „Kurse“ versuchen." : "",
      unknown.length ? "Kein Kurs gefunden für: " + unknown.join(", ") + ". Prüf die ISIN oder trag das Börsenkürzel ein (z. B. EUNL.DE)." : "",
    ].filter(Boolean).join(" ");
    setQuoteState({ busy: false, error });
  }
  // Prices older than six hours are refreshed when the page opens.
  const trackedKey = tracked.map((h) => h.id + h.isin + h.symbol).join();
  useEffect(() => {
    const stale = tracked.some((h) => !state.quotes[h.id] || Date.now() - new Date(state.quotes[h.id].at).getTime() > 6 * 36e5);
    if (!stale || !state.accessToken) return;
    const timer = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedKey, state.accessToken]);

  const depot = state.holdings.map((h) => ({ h, now: holdingNow(state, h, today) }));
  const depotValue = depot.reduce((n, d) => n + (d.now.value ?? d.now.invested), 0);
  const depotPaid = depot.reduce((n, d) => n + d.now.invested, 0);
  const curve = depotHistory(state, today, 26).filter((x) => x.invested > 0);
  const latest = Object.values(state.quotes).map((q) => q.at).sort().pop();
  const abos = state.moneyRules.filter((r) => r.kind === "abo" && (!r.end || r.end >= today));
  const regular = state.moneyRules.filter((r) => (r.kind === "income" || r.kind === "fixed") && (!r.end || r.end >= today));
  const plans = state.moneyRules.filter((r) => r.kind === "saving" && (!r.end || r.end >= today));
  const entries = [...p.entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={{ gap: 18 }}>
      <View style={[s.card, { padding: 20, gap: 8 }]}>
        <Text style={{ color: C.green, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 }}>NOCH FREI BIS {long(p.end).toUpperCase()}</Text>
        <View style={[s.row, { alignItems: "baseline", gap: 10, flexWrap: "wrap" }]}>
          <Text style={{ color: p.free >= 0 ? C.ink : red, fontSize: 42, fontWeight: "800", letterSpacing: -1.2, fontVariant: ["tabular-nums"] }}>{euro(p.free, false)}</Text>
          {p.daysLeft > 0 && <Text style={s.muted}>≈ {euro(p.perDay, false)} pro Tag · noch {p.daysLeft} {p.daysLeft === 1 ? "Tag" : "Tage"}</Text>}
        </View>
        <View accessibilityLabel={"Von " + euro(p.income) + ": " + euro(out) + " fix, " + euro(p.saved) + " gespart, " + euro(p.spent) + " ausgegeben"} style={{ height: 8, borderRadius: 4, backgroundColor: "#26262C", overflow: "hidden", flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: bar(out), backgroundColor: "#8FA3C8" }} />
          <View style={{ width: bar(p.saved), backgroundColor: kinds.saving.color }} />
          <View style={{ width: bar(p.spent), backgroundColor: "#F4F3F1" }} />
        </View>
        <Text style={[s.micro, { lineHeight: 18 }]}>
          Rein {euro(p.income, false)} · Fix & Abos {euro(out, false)} · Gespart {euro(p.saved, false)} · Ausgegeben {euro(p.spent, false)}
          {p.expected > 0 ? "\nDavon kommen noch " + euro(p.expected) + "." : ""}
        </Text>
        <View style={[s.row, { flexWrap: "wrap", marginTop: 8 }]}>
          <Button icon={Plus} onPress={() => setEntry({ kind: "expense" })}>Ausgabe</Button>
          <Button quiet icon={ImagePlus} onPress={() => setScan(true)}>Screenshot</Button>
          <Button quiet onPress={() => setEntry({ kind: "income" })}>Einnahme</Button>
          <Button quiet icon={TrendingUp} onPress={() => setHistory(true)}>Verlauf</Button>
        </View>
      </View>

      <Card>
        <Section title={"Dieser Monat · " + short(p.start) + " – " + short(p.end)} detail="antippen zum Anpassen">
          <View>
            {p.bookings.map((b) => (
              <Row
                key={b.rule.id + b.date}
                dot={kinds[b.rule.kind].color}
                title={b.rule.name}
                sub={long(b.date) + (b.amount !== b.rule.amount ? " · diesmal angepasst" : b.done ? "" : " · kommt noch")}
                value={(b.rule.kind === "income" ? "+" : "−") + euro(b.amount)}
                valueColor={b.rule.kind === "income" ? green : undefined}
                dim={!b.done}
                onPress={() => setBooking(b)}
              />
            ))}
            {!p.bookings.length && <Text style={s.micro}>Noch nichts Regelmäßiges eingetragen.</Text>}
          </View>
        </Section>
      </Card>

      <Card>
        <Section title="Ausgaben nach Kategorie" detail={euro(p.spent, false) + " diesen Monat"}>
          {p.byCategory.length ? (
            p.byCategory.map((c) => {
              const over = c.budget > 0 && c.spent > c.budget;
              return (
                <View key={c.key} style={{ gap: 6 }}>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <View style={s.row}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
                      <Text style={s.body}>{c.label}</Text>
                    </View>
                    <Text style={[s.micro, { color: over ? red : C.muted }]}>
                      {euro(c.spent, false)}{c.budget ? " / " + euro(c.budget, false) : ""}
                    </Text>
                  </View>
                  {c.budget > 0 && (
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: "#232328", overflow: "hidden" }}>
                      <View style={{ width: (Math.min(100, (c.spent / c.budget) * 100) + "%") as `${number}%`, height: 4, backgroundColor: over ? red : c.color }} />
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={s.micro}>Noch keine Ausgaben in diesem Monat.</Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => setBudgets(true)}>
            <Text style={s.link}>{Object.keys(state.budgets).length ? "Budgets anpassen" : "Budgets festlegen"}</Text>
          </Pressable>
        </Section>
        {entries.length > 0 && (
          <Section title="Eingetragen">
            <View>
              {entries.slice(0, 12).map((e) => (
                <Row
                  key={e.id}
                  dot={e.kind === "income" ? green : categoryOf(e.category).color}
                  title={e.note || (e.kind === "income" ? "Einnahme" : categoryOf(e.category).label)}
                  sub={long(e.date) + (e.kind === "expense" && e.note ? " · " + categoryOf(e.category).label : "")}
                  value={(e.kind === "income" ? "+" : "−") + euro(e.amount)}
                  valueColor={e.kind === "income" ? green : undefined}
                  onPress={() => setEntry({ entry: e, kind: e.kind })}
                />
              ))}
            </View>
          </Section>
        )}
      </Card>

      <Card>
        <Section title="Abos" detail={euro(round2(abos.reduce((n, r) => n + monthly(r), 0))) + "/Monat · " + euro(round2(abos.reduce((n, r) => n + monthly(r), 0) * 12), false) + "/Jahr"}>
          <View>
            {abos.map((r) => (
              <Row key={r.id} dot={kinds.abo.color} title={r.name} sub={when(r)} value={euro(r.amount)} onPress={() => setRule({ rule: r, kind: r.kind })} />
            ))}
            {!abos.length && <Text style={s.micro}>Trag deine Abos ein, z. B. iCloud, Spotify, Netflix – dann siehst du, was sie im Jahr kosten.</Text>}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setRule({ kind: "abo" })}>
            <Text style={s.link}>+ Abo</Text>
          </Pressable>
        </Section>
      </Card>

      <Card>
        <Section title="Regelmäßig">
          <View>
            {regular.map((r) => (
              <Row
                key={r.id}
                dot={kinds[r.kind].color}
                title={r.name}
                sub={kinds[r.kind].label + " · " + when(r)}
                value={(r.kind === "income" ? "+" : "−") + euro(r.amount)}
                valueColor={r.kind === "income" ? green : undefined}
                onPress={() => setRule({ rule: r, kind: r.kind })}
              />
            ))}
          </View>
          <View style={[s.row, { gap: 18 }]}>
            <Pressable accessibilityRole="button" onPress={() => setRule({ kind: "income" })}>
              <Text style={s.link}>+ Einnahme</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setRule({ kind: "fixed" })}>
              <Text style={s.link}>+ Fixkosten</Text>
            </Pressable>
          </View>
        </Section>
      </Card>

      <Card>
        <Section title="Depot & Sparen" detail={latest ? "Kurse von " + new Date(latest).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : undefined}>
          {state.holdings.length ? (
            <>
              <Tiles
                items={[
                  { label: "Wert", value: euro(Math.round(depotValue), false), detail: "eingezahlt " + euro(Math.round(depotPaid), false) },
                  {
                    label: "Gewinn / Verlust",
                    value: (depotValue - depotPaid >= 0 ? "+" : "−") + euro(Math.abs(Math.round(depotValue - depotPaid)), false),
                    detail: depotPaid ? (depotValue - depotPaid >= 0 ? "+" : "") + plain(round2(((depotValue - depotPaid) / depotPaid) * 100)) + " %" : undefined,
                    color: depotValue >= depotPaid ? green : red,
                  },
                ]}
              />
              {curve.length > 1 && <Sparkline values={curve.map((c) => c.value)} color={kinds.saving.color} />}
              <View>
                {depot.map(({ h, now }) => {
                  const planList = plans.filter((r) => r.holdingId === h.id);
                  return (
                    <Row
                      key={h.id}
                      dot={h.cash ? "#92B9DB" : kinds.saving.color}
                      title={h.name}
                      sub={[
                        h.cash ? "Konto" : now.quote ? plain(round2(now.shares)) + " Stück · " + euro(now.price) : quoteState.busy ? "Kurs wird geladen …" : "ohne Kurs · " + (h.isin || h.symbol),
                        planList.map((r) => euro(r.amount, false) + " " + when(r)).join(" + "),
                      ].filter(Boolean).join(" · ")}
                      value={now.value === null ? euro(now.invested, false) : euro(Math.round(now.value), false)}
                      valueColor={now.gain === null || h.cash ? undefined : now.gain >= 0 ? green : red}
                      onPress={() => setHolding(h)}
                    />
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={[s.micro, { lineHeight: 18 }]}>Leg deinen ETF aus Trade Republic an (Name, ISIN, Stücke, eingezahlt). Hap lädt den aktuellen Kurs und rechnet deine Sparpläne automatisch dazu.</Text>
          )}
          {plans.length > 0 && (
            <View>
              {plans.map((r) => (
                <Row
                  key={r.id}
                  dot={kinds.saving.color}
                  title={r.name}
                  sub={"Sparplan · " + when(r) + (r.holdingId ? " → " + (state.holdings.find((h) => h.id === r.holdingId)?.name || "") : "")}
                  value={euro(r.amount)}
                  onPress={() => setRule({ rule: r, kind: "saving" })}
                />
              ))}
            </View>
          )}
          {quoteState.error ? <Text style={s.formError}>{quoteState.error}</Text> : null}
          <View style={[s.row, { flexWrap: "wrap", gap: 18 }]}>
            <Pressable accessibilityRole="button" onPress={() => setHolding("new")}>
              <Text style={s.link}>+ Position</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setRule({ kind: "saving" })}>
              <Text style={s.link}>+ Sparplan</Text>
            </Pressable>
            {tracked.length > 0 && (
              <Pressable accessibilityRole="button" disabled={quoteState.busy} onPress={() => void refresh()} style={s.row}>
                {quoteState.busy ? <ActivityIndicator size="small" color={C.green} /> : <RefreshCw size={14} color={C.green} />}
                <Text style={s.link}>Kurse</Text>
              </Pressable>
            )}
          </View>
        </Section>
      </Card>

      <Card>
        <Section title="Spar-Check">
          <Tiles
            items={[
              { label: "Einnahmen / Monat", value: euro(Math.round(check.income), false) },
              { label: "Fix & Abos", value: euro(Math.round(check.fixed), false), detail: check.income ? Math.round((check.fixed / check.income) * 100) + " % vom Einkommen" : undefined },
              { label: "Sparrate", value: Math.round(check.rate * 100) + " %", detail: euro(Math.round(check.saving), false) + " im Monat", color: check.rate >= 0.2 ? green : undefined },
              check.basis === "none"
                ? { label: "Übrig / Monat", value: "–", detail: "erst mit Ausgaben oder Budgets" }
                : { label: "Übrig / Monat", value: euro(Math.round(check.leftover), false), detail: check.basis === "measured" ? "nach deinen üblichen Ausgaben" : "nach deinen Budgets", color: check.leftover < 0 ? red : undefined },
            ]}
          />
        </Section>
        <Tips list={check.tips} title="Einordnung" />
        <Section title="Rechenbeispiel" detail={"Startwert " + euro(Math.round(check.depot), false)}>
          <View style={[s.row, { flexWrap: "wrap", gap: 12 }]}>
            <View style={[s.row, { gap: 0, backgroundColor: "#1C1C21", borderRadius: 14 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="10 € weniger" onPress={() => setPerMonth(Math.max(0, perMonth - 10))} style={{ width: 44, height: 46, alignItems: "center", justifyContent: "center" }}>
                <Minus size={16} color={C.muted} />
              </Pressable>
              <Text style={{ minWidth: 110, textAlign: "center", color: C.ink, fontSize: 16, fontWeight: "700" }}>{euro(perMonth, false)} / Monat</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="10 € mehr" onPress={() => setPerMonth(perMonth + 10)} style={{ width: 44, height: 46, alignItems: "center", justifyContent: "center" }}>
                <Plus size={16} color={C.muted} />
              </Pressable>
            </View>
            <View style={s.wrap}>
              {[5, 10, 20, 30].map((y) => (
                <Chip key={y} label={y + " J."} active={years === y} onPress={() => setYears(y)} />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {[0, 0.03, 0.06].map((r) => (
              <View key={r} style={[s.row, { justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }]}>
                <Text style={s.body}>{r ? "mit " + Math.round(r * 100) + " % pro Jahr" : "ohne Rendite"}</Text>
                <Text style={[s.h3, { fontVariant: ["tabular-nums"] }]}>{euro(projection(check.depot, perMonth, r, years), false)}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.micro, { lineHeight: 18 }]}>
            Reine Rechenbeispiele mit angenommenen, gleichbleibenden Renditen – echte Kurse schwanken und können auch fallen. Hap gibt Faustregeln aus deinen eigenen Zahlen, keine Anlageberatung.
          </Text>
        </Section>
      </Card>

      {entry && <EntrySheet entry={entry.entry} kind={entry.kind} close={() => setEntry(null)} />}
      {rule && <RuleSheet rule={rule.rule} kind={rule.kind} close={() => setRule(null)} />}
      {booking && (
        <BookingSheet
          booking={booking}
          close={() => setBooking(null)}
          editRule={() => {
            setBooking(null);
            setRule({ rule: booking.rule, kind: booking.rule.kind });
          }}
        />
      )}
      {holding && <HoldingSheet holding={holding === "new" ? undefined : holding} close={() => setHolding(null)} />}
      {budgets && <BudgetSheet close={() => setBudgets(false)} />}
      {history && <HistorySheet close={() => setHistory(false)} />}
      {scan && <ScanSheet close={() => setScan(false)} />}
    </View>
  );
}

export function MoneyScreen() {
  const { state } = usePlanner();
  return (
    <Shell title="Geld" subtitle="Was kommt, was geht, was übrig bleibt.">
      {state.payday ? <MoneyContent /> : <Setup />}
    </Shell>
  );
}
