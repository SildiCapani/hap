import { useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3, Minus, Plus, X } from "lucide-react-native";
import { dateKey, parseDate } from "@/lib/planner";
import { tap } from "@/lib/notify";

// Date and time are picked, never typed: a calendar for dates and the wheel
// for times (the system pickers: iOS/Android natively, the browser's on web).
// Values stay "YYYY-MM-DD" and "HH:MM". Colors are local so this file does
// not depend on planner-ui (which uses these fields).
const ink = "#F4F3F1", muted = "#9C9AA3", accent = "#FF7A66";

const pad = (n: number) => String(n).padStart(2, "0");
const toTime = (d: Date) => pad(d.getHours()) + ":" + pad(d.getMinutes());
const timeDate = (v: string) => {
  const [h, m] = (v || "09:00").split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const dateLabel = (v: string) =>
  parseDate(v).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(v.slice(0, 4) !== dateKey().slice(0, 4) ? { year: "numeric" as const } : {}),
  });

function Box({ label, text, icon, onPress, onClear, children }: { label: string; text: string; icon: ReactNode; onPress?: () => void; onClear?: () => void; children?: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={st.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label + ": " + (text || "nicht gesetzt")} onPress={onPress} style={st.box}>
        {icon}
        <Text style={[st.value, !text && { color: muted }]} numberOfLines={1}>
          {text || "Auswählen"}
        </Text>
        {onClear && text ? (
          <Pressable accessibilityRole="button" accessibilityLabel={label + " entfernen"} hitSlop={10} onPress={onClear} style={{ zIndex: 2 }}>
            <X size={16} color={muted} />
          </Pressable>
        ) : null}
        {children}
      </Pressable>
    </View>
  );
}

// Browser: a transparent native input over the box opens the system picker
// (iOS: calendar / wheel). showPicker() also opens it on desktop browsers.
function WebInput({ type, value, onChange }: { type: "date" | "time"; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type={type}
      value={value}
      step={type === "time" ? 300 : undefined}
      aria-hidden="true"
      tabIndex={-1}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      onClick={(e) => {
        const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
        try {
          el.showPicker?.();
        } catch {
          // Some browsers only allow it from certain gestures; the tap still focuses the field.
        }
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.011, border: 0, padding: 0, margin: 0, fontSize: 16, cursor: "pointer", colorScheme: "dark" }}
    />
  );
}

function NativeSheet({ mode, value, onDone, close }: { mode: "date" | "time"; value: Date; onDone: (d: Date) => void; close: () => void }) {
  const [current, setCurrent] = useState(value);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityLabel="Schließen" onPress={close} style={StyleSheet.absoluteFill} />
      <View style={st.sheet}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 8 }}>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={10}>
            <Text style={{ color: muted, fontSize: 16 }}>Abbrechen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap("success");
              onDone(current);
              close();
            }}
            hitSlop={10}
          >
            <Text style={{ color: accent, fontSize: 16, fontWeight: "700" }}>Fertig</Text>
          </Pressable>
        </View>
        <DateTimePicker
          value={current}
          mode={mode}
          display={mode === "date" ? "inline" : "spinner"}
          locale="de-DE"
          minuteInterval={mode === "time" ? 5 : undefined}
          themeVariant="dark"
          accentColor={accent}
          textColor={ink}
          onChange={(_e: DateTimePickerEvent, d?: Date) => d && setCurrent(d)}
        />
      </View>
    </Modal>
  );
}

function usePicker(mode: "date" | "time", value: string, onChange: (v: string) => void) {
  const [open, setOpen] = useState(false);
  const asDate = mode === "date" ? (value ? parseDate(value) : new Date()) : timeDate(value);
  const apply = (d: Date) => onChange(mode === "date" ? dateKey(d) : toTime(d));
  const show = () => {
    tap();
    if (Platform.OS === "android")
      DateTimePickerAndroid.open({ value: asDate, mode, is24Hour: true, onChange: (e, d) => e.type === "set" && d && apply(d) });
    else setOpen(true);
  };
  const sheet = open && Platform.OS === "ios" ? <NativeSheet mode={mode} value={asDate} onDone={apply} close={() => setOpen(false)} /> : null;
  return { show, sheet };
}

export function DateField({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const picker = usePicker("date", value, onChange);
  const web = Platform.OS === "web";
  return (
    <>
      <Box label={label} text={value ? dateLabel(value) : ""} icon={<CalendarDays size={16} color={accent} />} onPress={web ? undefined : picker.show} onClear={optional ? () => onChange("") : undefined}>
        {web ? <WebInput type="date" value={value} onChange={onChange} /> : null}
      </Box>
      {picker.sheet}
    </>
  );
}

export function TimeField({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const picker = usePicker("time", value, onChange);
  const web = Platform.OS === "web";
  return (
    <>
      <Box label={label} text={value ? value + " Uhr" : ""} icon={<Clock3 size={16} color={accent} />} onPress={web ? undefined : picker.show} onClear={optional ? () => onChange("") : undefined}>
        {web ? <WebInput type="time" value={value} onChange={onChange} /> : null}
      </Box>
      {picker.sheet}
    </>
  );
}

// Duration without typing: common choices plus −/+ in 15-minute steps.
export function DurationField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const set = (v: number) => {
    tap("select");
    onChange(Math.min(600, Math.max(5, v)));
  };
  const text = value < 60 ? value + " Min." : Math.floor(value / 60) + " h" + (value % 60 ? " " + (value % 60) + " Min." : "");
  return (
    <View style={{ gap: 8 }}>
      <Text style={st.label}>{label}</Text>
      <View style={[st.box, { justifyContent: "space-between", paddingHorizontal: 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Kürzer" onPress={() => set(value - 15)} style={st.step}>
          <Minus size={16} color={ink} />
        </Pressable>
        <Text style={[st.value, { textAlign: "center" }]} numberOfLines={1}>{text}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Länger" onPress={() => set(value + 15)} style={st.step}>
          <Plus size={16} color={ink} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: value === m }}
            onPress={() => set(m)}
            style={[st.chip, value === m && { backgroundColor: "#2B1B19", borderColor: accent }]}
          >
            <Text style={{ color: value === m ? accent : muted, fontSize: 13, fontWeight: value === m ? "700" : "500" }}>
              {m < 60 ? m + " Min." : m / 60 + " h"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  label: { color: "#C1BDC9", fontSize: 11, fontWeight: "600", marginBottom: 9 },
  box: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#26262C",
    backgroundColor: "#141417",
    overflow: "hidden",
  },
  value: { flex: 1, color: ink, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  step: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#1C1C21", alignItems: "center", justifyContent: "center" },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1E1E23", backgroundColor: "#141417" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#141417", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
});
