import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
// Lets long-press drags in the day view take over from page scrolling.
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Code,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Dumbbell,
  Flower2,
  Footprints,
  GraduationCap,
  House,
  Laptop,
  Leaf,
  ListChecks,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Sparkles,
  Sprout,
  Sun,
  Target,
  Timer,
  Trash2,
  Trophy,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import {
  categories,
  dateKey,
  monday,
  occurrenceKey,
  parseDate,
  progress,
  repeats,
  shiftDay,
  tasksFor,
  validDate,
  type Category,
  type Repeat,
  type Task,
} from "@/lib/planner";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";

export const C = {
  bg: "#0B0B0D",
  white: "#141417",
  ink: "#F4F3F1",
  muted: "#9C9AA3",
  line: "#1E1E23",
  green: "#FF7A66",
  pale: "#2B1B19",
  lime: "#FFD0C8",
  button: "#FF7A66",
  hero: "#17171B",
  // Text and icons on the accent color (white would be too faint there).
  onAccent: "#0B0B0D",
};
const icons: Record<string, LucideIcon> = {
  graduation: GraduationCap,
  dumbbell: Dumbbell,
  utensils: Utensils,
  sparkles: Sparkles,
  sun: Sun,
  book: BookOpen,
  coffee: Coffee,
  leaf: Leaf,
  target: Target,
  bag: ShoppingBag,
  flower: Flower2,
  house: House,
  brain: Brain,
  code: Code,
  laptop: Laptop,
  timer: Timer,
  footprints: Footprints,
};
const nav = [
  { path: "/", label: "Heute", icon: House },
  { path: "/todos", label: "To-dos", icon: ListChecks },
  { path: "/study", label: "Lernen", icon: Brain },
  { path: "/training", label: "Training", icon: Dumbbell },
  { path: "/meals", label: "Essen", icon: Utensils },
  { path: "/progress", label: "Fortschritt", icon: Trophy },
];
export type Preset = Partial<Omit<Task, "id" | "skipped">>;
const EditorContext = createContext<
  (date?: string, task?: Task, preset?: Preset) => void
>(() => {});
export function useEditor() {
  return useContext(EditorContext);
}
export function useToday() {
  const [today, setToday] = useState(dateKey());
  useEffect(() => {
    const timer = setInterval(() => setToday(dateKey()), 30000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <Image
      source={require("@/assets/images/logo.png")}
      accessibilityLabel="Hap-Logo"
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: size * 0.23 }}
    />
  );
}
export function Icon({
  name,
  color = C.green,
  size = 20,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const Component = icons[name] || Sparkles;
  return <Component size={size} color={color} strokeWidth={1.8} />;
}
export function Button({
  children,
  onPress,
  quiet = false,
  icon: Component,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onPress: () => void;
  quiet?: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        quiet && s.quietButton,
        danger && { backgroundColor: "#3E2429" },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {Component && (
        <Component
          size={17}
          color={danger ? "#F2A0A5" : quiet ? C.ink : C.onAccent}
        />
      )}
      <Text
        style={[
          s.buttonText,
          quiet && { color: C.ink, fontWeight: "600" },
          danger && { color: "#F2A0A5" },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Heading({
  children,
  detail,
}: {
  children: ReactNode;
  detail?: string;
}) {
  return (
    <View style={s.sectionHeading}>
      <Text style={s.h2}>{children}</Text>
      {detail && <Text style={s.muted}>{detail}</Text>}
    </View>
  );
}
export function Pill({
  children,
  color = C.green,
  bg = C.pale,
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{children}</Text>
    </View>
  );
}
export function Ring({
  done,
  total,
  size = 118,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const radius = (size - 14) / 2,
    circumference = 2 * Math.PI * radius;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={C.pale}
          strokeWidth={7}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={C.green}
          strokeWidth={7}
          fill="transparent"
          strokeDasharray={String(circumference) + " " + circumference}
          strokeDashoffset={circumference * (1 - (total ? done / total : 0))}
          strokeLinecap="round"
          transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
        />
      </Svg>
      <Text
        style={{
          color: C.ink,
          fontSize: 31,
          fontWeight: "700",
          letterSpacing: -1,
        }}
      >
        {done}
        <Text style={{ fontSize: 20, color: C.muted }}>/{total}</Text>
      </Text>
      <Text style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
        GESCHAFFT
      </Text>
    </View>
  );
}
// Shows a running focus round or workout on every other screen, so it is
// one tap away when the app is opened in between.
function ActiveBanner({ path }: { path: string }) {
  const { state } = usePlanner();
  const [now, setNow] = useState(() => Date.now());
  const focus = state.activeFocus;
  const workout = state.activeWorkout;
  useEffect(() => {
    if (!focus) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [focus]);
  const items: { key: string; to: string; label: string; color: string }[] = [];
  if (focus && path !== "/focus") {
    const left = Math.max(0, focus.pausedLeft ?? focus.endsAt - now);
    const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
    items.push({
      key: "focus",
      to: "/focus",
      color: "#F07B83",
      label:
        (focus.pausedLeft !== null ? "Fokus pausiert" : "Fokus läuft") +
        " · " + focus.label + " · " + String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0"),
    });
  }
  if (workout && path !== "/training") {
    const w = state.workouts.find((x) => x.id === workout.workoutId);
    const all = Object.values(workout.sets).flat();
    items.push({
      key: "workout",
      to: "/training",
      color: categories.sport.color,
      label: (w?.name || "Training") + " läuft · " + all.filter((x) => x.done).length + "/" + all.length + " Sätze",
    });
  }
  if (!items.length) return null;
  return (
    <View style={{ gap: 1 }}>
      {items.map((i) => (
        <Pressable
          key={i.key}
          accessibilityRole="link"
          onPress={() => router.push(i.to as "/")}
          style={[s.row, { backgroundColor: "#2A1C22", paddingHorizontal: 20, paddingVertical: 11 }]}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.color }} />
          <Text numberOfLines={1} style={{ color: i.color, fontWeight: "700", fontSize: 12, flex: 1, fontVariant: ["tabular-nums"] }}>
            {i.label}
          </Text>
          <ChevronRight size={15} color={i.color} />
        </Pressable>
      ))}
    </View>
  );
}
export function Shell({
  children,
  title,
  subtitle,
  header = true,
  bottom,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  header?: boolean;
  // Pinned above the tab bar on phones (e.g. the quick entry on Heute).
  bottom?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const mobile = width < 680;
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { state, ready, saved, error, retry } = usePlanner();
  const today = useToday();
  const [editor, setEditor] = useState<{
    date: string;
    task?: Task;
    preset?: Preset;
  } | null>(null);
  return (
    <EditorContext.Provider
      value={(date = today, task, preset) => setEditor({ date, task, preset })}
    >
      <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
        {wide && (
          <View style={s.sidebar}>
            <View style={s.brand}>
              <BrandMark />
              <Text style={s.brandName}>
                hap<Text style={{ color: "#EF6676" }}>.</Text>
              </Text>
            </View>
            <Text style={s.sidebarEyebrow}>DEIN TAG. DEIN RHYTHMUS.</Text>
            <View style={{ gap: 9, marginTop: 43 }}>
              {nav.map((n) => (
                <Pressable
                  key={n.path}
                  accessibilityRole="link"
                  onPress={() => router.push(n.path as "/")}
                  style={[s.navItem, path === n.path && s.navActive]}
                >
                  <n.icon
                    size={21}
                    color={path === n.path ? C.green : C.muted}
                  />
                  <Text
                    style={[
                      s.navLabel,
                      path === n.path && { color: C.green, fontWeight: "700" },
                    ]}
                  >
                    {n.label}
                  </Text>
                  {path === n.path && <View style={s.navDot} />}
                </Pressable>
              ))}
            </View>
            <View style={s.sidebarBottom}>
              <View style={s.smallGarden}>
                <Flower2 size={27} color="#D697A4" />
                <Text style={s.gardenTitle}>
                  Kleine Schritte.{"\n"}Große Veränderung.
                </Text>
                <Text style={s.gardenNote}>
                  Ein gutes Leben wächst{"\n"}Tag für Tag.
                </Text>
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/settings")}
                style={[s.navItem, path === "/settings" && s.navActive]}
              >
                <Settings2 size={19} color={C.muted} />
                <Text style={s.navLabel}>Einstellungen</Text>
              </Pressable>
              <View style={s.saveNote}>
                <View
                  style={[
                    s.navDot,
                    {
                      marginLeft: 0,
                      backgroundColor: saved ? "#8DB59B" : "#DBB986",
                    },
                  ]}
                />
                <Text style={s.micro}>
                  {saved
                    ? "Auf diesem Gerät gespeichert"
                    : "Wird gespeichert …"}
                </Text>
              </View>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Phones show no top bar: every page starts with its own title. */}
          {!mobile && (
          <View style={s.topbar}>
            {!wide ? (
              <View style={[s.brand, { gap: 8 }]}>
                <BrandMark size={mobile ? 26 : 31} />
                <Text style={[s.brandName, { fontSize: mobile ? 22 : 26 }]}>
                  hap.
                </Text>
              </View>
            ) : (
              <View style={s.row}>
                <Text style={s.muted}>Mein Alltag</Text>
                <ChevronRight size={14} color="#8D8495" />
                <Text style={{ color: C.ink, fontSize: 12 }}>{title}</Text>
              </View>
            )}
            <View style={s.row}>
              {!mobile && (
                <View style={s.row}>
                  <Sun size={16} color="#DBB884" />
                  <Text style={s.muted}>
                    {parseDate(today).toLocaleDateString("de-DE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </Text>
                </View>
              )}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Einstellungen öffnen"
                onPress={() => router.push("/settings")}
                style={s.avatar}
              >
                <Text style={{ color: C.green, fontWeight: "700" }}>
                  {state.name ? state.name[0].toUpperCase() : "H"}
                </Text>
              </Pressable>
            </View>
          </View>
          )}
          <ActiveBanner path={path} />
          {error ? (
            <View style={s.errorBar}>
              <Text style={{ color: "#F3A4A9", flex: 1 }}>{error}</Text>
              {ready && (
                <Button quiet onPress={retry}>
                  Erneut speichern
                </Button>
              )}
            </View>
          ) : null}
          {!ready ? (
            <View style={s.loading}>
              <ActivityIndicator color={C.green} />
              <Text style={s.muted}>
                {error
                  ? "Gespeicherte Daten geschützt."
                  : "Dein Tag wird vorbereitet …"}
              </Text>
            </View>
          ) : (
            <GestureScrollView
              contentContainerStyle={[
                s.scrollContent,
                mobile && {
                  padding: 16,
                  paddingTop: 14,
                  paddingBottom: (bottom ? 150 : 96) + insets.bottom,
                },
                !wide && !mobile && { paddingBottom: 110 },
              ]}
            >
              <View style={s.content}>
                {mobile && (
                  <View style={[s.brand, { gap: 8, marginBottom: 16 }]}>
                    <BrandMark size={28} />
                    <Text style={[s.brandName, { fontSize: 24 }]}>
                      hap<Text style={{ color: C.green }}>.</Text>
                    </Text>
                  </View>
                )}
                {header && (
                  <View
                    style={[
                      s.pageHeader,
                      mobile && { alignItems: "flex-start", marginBottom: 18 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.h1, mobile && { fontSize: 26 }]}>
                        {title}
                      </Text>
                      {!mobile && (
                        <Text
                          style={[s.body, { color: C.muted, marginTop: 7 }]}
                        >
                          {subtitle}
                        </Text>
                      )}
                    </View>
                    {!mobile && (
                      <Button
                        icon={Plus}
                        onPress={() => setEditor({ date: today })}
                      >
                        Neue Aufgabe
                      </Button>
                    )}
                  </View>
                )}
                {!mobile && bottom}
                {children}
              </View>
            </GestureScrollView>
          )}
          {mobile && bottom && (
            <View
              pointerEvents="box-none"
              style={{ position: "absolute", left: 0, right: 0, bottom: 54 + Math.max(10, insets.bottom), paddingHorizontal: 12, paddingVertical: 10 }}
            >
              {bottom}
            </View>
          )}
          {!wide && (
            <View
              style={[s.mobileNav, { paddingBottom: Math.max(10, insets.bottom) }]}
            >
              {nav
                .filter((n) => n.path !== "/progress")
                .map((n) => {
                  const active =
                    path === n.path ||
                    (n.path === "/study" && path === "/focus") ||
                    (n.path === "/" && path === "/calendar");
                  return (
                    <Pressable
                      key={n.path}
                      accessibilityRole="link"
                      accessibilityLabel={n.label}
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        if (!active) tap();
                        router.push(n.path as "/");
                      }}
                      style={s.mobileNavItem}
                    >
                      <View style={s.mobileNavIcon}>
                        <n.icon
                          size={21}
                          color={active ? C.ink : "#6F6D76"}
                          strokeWidth={active ? 2.4 : 1.8}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          color: active ? C.ink : "#6F6D76",
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {n.label}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          )}
        </View>
        {editor && (
          <TaskEditor
            day={editor.date}
            task={editor.task}
            preset={editor.preset}
            close={() => setEditor(null)}
          />
        )}
      </SafeAreaView>
    </EditorContext.Provider>
  );
}
function TaskRow({ task, day }: { task: Task; day: string }) {
  const { state, update } = usePlanner();
  const edit = useEditor();
  const done = !!state.done[occurrenceKey(task, day)];
  const category = categories[task.category];
  return (
    <View style={[s.taskRow, done && { backgroundColor: "#202126" }]}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={done}
        accessibilityState={{ checked: done }}
        accessibilityLabel={task.title + (done ? " wieder öffnen" : " abhaken")}
        onPress={() => {
          tap(done ? "light" : "success");
          update((prev) => ({
            ...prev,
            done: {
              ...prev.done,
              [occurrenceKey(task, day)]: !prev.done[occurrenceKey(task, day)],
            },
          }));
        }}
        style={[
          s.checkbox,
          done && { backgroundColor: C.button, borderColor: C.button },
        ]}
      >
        {done && <Check size={15} color={C.onAccent} strokeWidth={3} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={task.title + " bearbeiten"}
        onPress={() => edit(day, task)}
        style={s.taskBody}
      >
        <View style={[s.taskIcon, { backgroundColor: category.pale }]}>
          <Icon name={task.icon} color={category.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              s.taskTitle,
              done && { textDecorationLine: "line-through", color: "#99909F" },
            ]}
          >
            {task.title}
          </Text>
          <View style={[s.row, { marginTop: 7, gap: 8, flexWrap: "wrap" }]}>
            <Text style={[s.micro, { color: category.color }]}>
              {category.label}
            </Text>
            <Text style={s.micro}>·</Text>
            <Clock3 size={11} color={C.muted} />
            <Text style={s.micro}>
              {task.time} · {task.duration} Min.
            </Text>
            {task.repeat !== "none" && <RefreshCw size={11} color={C.muted} />}
          </View>
        </View>
        <MoreHorizontal size={19} color="#A39AA9" />
      </Pressable>
    </View>
  );
}
export function WeekStrip({
  day,
  select,
}: {
  day: string;
  select: (date: string) => void;
}) {
  const { state } = usePlanner();
  const today = useToday();
  const start = monday(day);
  return (
    <View style={s.weekStrip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vorherige Woche"
        onPress={() => select(shiftDay(day, -7))}
        style={s.arrow}
      >
        <ChevronLeft size={17} color={C.muted} />
      </Pressable>
      {Array.from({ length: 7 }, (_, i) => shiftDay(start, i)).map((d) => {
        const p = progress(state, d);
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={parseDate(d).toLocaleDateString("de-DE")}
            accessibilityState={{ selected: day === d }}
            onPress={() => select(d)}
            style={[s.weekDay, d === day && s.weekDayActive]}
          >
            <Text style={[s.micro, d === day && { color: "#F9DCE1" }]}>
              {parseDate(d)
                .toLocaleDateString("de-DE", { weekday: "short" })
                .replace(".", "")}
            </Text>
            <Text style={[s.dayNumber, d === day && { color: C.onAccent }]}>
              {parseDate(d).getDate()}
            </Text>
            <View
              style={[
                s.dayDot,
                {
                  backgroundColor: p.perfect
                    ? "#DB8392"
                    : p.total
                      ? "#7C6974"
                      : "transparent",
                },
                d === today && {
                  backgroundColor: d === day ? "#FFD0D5" : C.green,
                },
              ]}
            />
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nächste Woche"
        onPress={() => select(shiftDay(day, 7))}
        style={s.arrow}
      >
        <ChevronRight size={17} color={C.muted} />
      </Pressable>
    </View>
  );
}
export function TaskList({ day }: { day: string }) {
  const { state } = usePlanner();
  const edit = useEditor();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [hideDone, setHideDone] = useState(false);
  const all = tasksFor(state, day);
  const tasks = all.filter(
    (t) =>
      (filter === "all" || t.category === filter) &&
      (!hideDone || !state.done[occurrenceKey(t, day)]),
  );
  const groups = [
    { label: "VORMITTAG", tasks: tasks.filter((t) => t.time < "12:00") },
    {
      label: "NACHMITTAG",
      tasks: tasks.filter((t) => t.time >= "12:00" && t.time < "18:00"),
    },
    { label: "ABEND", tasks: tasks.filter((t) => t.time >= "18:00") },
  ];
  return (
    <View>
      <View style={[s.sectionHeading, { marginTop: 27 }]}>
        <View style={s.row}>
          <Text style={s.h2}>Deine Aufgaben</Text>
          <Pill>{all.length}</Pill>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setHideDone(!hideDone)}
        >
          <Text style={s.link}>
            {hideDone ? "Alle anzeigen" : "Erledigte ausblenden"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingVertical: 16 }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter("all")}
          style={[s.filter, filter === "all" && s.filterActive]}
        >
          <Text style={[s.filterText, filter === "all" && { color: C.green }]}>
            Alle
          </Text>
        </Pressable>
        {(Object.keys(categories) as Category[]).map((key) => (
          <Pressable
            accessibilityRole="button"
            key={key}
            onPress={() => setFilter(key)}
            style={[
              s.filter,
              key === filter && {
                backgroundColor: categories[key].pale,
                borderColor: categories[key].pale,
              },
            ]}
          >
            <Icon
              name={categories[key].icon}
              size={14}
              color={categories[key].color}
            />
            <Text
              style={[
                s.filterText,
                key === filter && { color: categories[key].color },
              ]}
            >
              {categories[key].label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.card}>
        {tasks.length ? (
          groups
            .filter((g) => g.tasks.length)
            .map((group) => (
              <View key={group.label}>
                <Text style={s.groupLabel}>{group.label}</Text>
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} day={day} />
                ))}
              </View>
            ))
        ) : (
          <View style={s.empty}>
            <Sprout size={31} color="#C895A5" />
            <Text style={s.h3}>
              {all.length
                ? "Hier ist alles erledigt."
                : "Platz für deinen Tag."}
            </Text>
            <Text style={s.muted}>
              {all.length
                ? "Wähle einen anderen Filter oder füge etwas hinzu."
                : "Starte mit einer kleinen Aufgabe."}
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => edit(day)}
          style={s.addRow}
        >
          <Plus size={18} color={C.green} />
          <Text style={s.link}>Aufgabe hinzufügen</Text>
        </Pressable>
      </View>
    </View>
  );
}
export function DaySide({ day }: { day: string }) {
  const { state } = usePlanner();
  const p = progress(state, day);
  const today = useToday();
  const days = Math.max(
    1,
    Math.round(
      (parseDate(today).valueOf() - parseDate(state.started).valueOf()) /
        86400000,
    ) + 1,
  );
  const phase = days <= 3 ? 1 : days <= 7 ? 2 : 3;
  const meal = state.mealPlan?.days.find((d) => d.date === day);
  return (
    <View style={{ gap: 20 }}>
      <View style={[s.card, s.progressCard]}>
        <View style={[s.sectionHeading, { marginBottom: 24, width: "100%" }]}>
          <Text style={s.h3}>Dein Tagesziel</Text>
          <Target size={19} color={C.muted} />
        </View>
        <Ring done={p.done} total={p.total} size={142} />
        <Text style={[s.h3, { marginTop: 20 }]}>
          {p.perfect
            ? "Alles geschafft. Stark!"
            : p.done
              ? "Du kommst voran."
              : "Ein Häkchen ist der Anfang."}
        </Text>
        <Text
          style={[
            s.muted,
            { textAlign: "center", marginTop: 9, lineHeight: 20 },
          ]}
        >
          {p.perfect
            ? "Genieß den Rest deines Tages."
            : String(Math.max(0, p.total - p.done)) +
              (p.total - p.done === 1
                ? " Aufgabe wartet"
                : " Aufgaben warten") +
              " noch auf dich."}
        </Text>
        <View style={s.xpBadge}>
          <Sparkles size={15} color="#DCC58F" />
          <Text style={{ color: "#DAC38E", fontWeight: "600", fontSize: 12 }}>
            +{p.done * 20} XP für diesen Tag
          </Text>
        </View>
      </View>
      <View style={[s.card, { padding: 23 }]}>
        <View style={s.sectionHeading}>
          <View style={s.row}>
            <View
              style={[
                s.taskIcon,
                { width: 32, height: 32, backgroundColor: "#23342B" },
              ]}
            >
              <Utensils size={16} color={C.green} />
            </View>
            <Text style={s.h3}>Auf dem Teller</Text>
          </View>
          <Leaf size={17} color="#B29AA7" />
        </View>
        <Text
          style={{
            fontSize: 11,
            color: C.muted,
            marginTop: 22,
            letterSpacing: 1,
          }}
        >
          ABENDESSEN
        </Text>
        <Text style={[s.h3, { marginTop: 10, lineHeight: 24 }]}>
          {meal?.dinner || "Was gibt’s diese Woche?"}
        </Text>
        <Text style={[s.muted, { marginTop: 8, lineHeight: 20 }]}>
          {meal
            ? "Aus deinem gespeicherten Wochenplan."
            : "Dein Essensplan und die Einkaufsliste haben hier ihren Platz."}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/meals")}
          style={[s.row, { marginTop: 20 }]}
        >
          <Text style={s.link}>Zum Essensplan</Text>
          <ArrowRight size={15} color={C.green} />
        </Pressable>
      </View>
      {state.gentle && (
        <View style={s.gentleCard}>
          <View style={s.row}>
            <Sprout size={18} color={C.green} />
            <Text style={s.h3}>In deinem Tempo</Text>
          </View>
          <Text style={[s.muted, { lineHeight: 21, marginTop: 12 }]}>
            {phase === 1
              ? "Tag 1–3: Finde deinen Anfang. Vier Beispielaufgaben helfen dir beim Start."
              : phase === 2
                ? "Tag 4–7: Finde deinen Rhythmus. Ergänze deine festen Uni- und Sporttermine."
                : "Ab Tag 8: Dein eigener Rhythmus. Plane die Woche und schaffe Raum für Pausen."}
          </Text>
          <View style={[s.row, { marginTop: 16 }]}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 9,
                  backgroundColor: n <= phase ? "#CE697A" : "#46353F",
                }}
              />
            ))}
            <Text style={s.micro}>{phase}/3</Text>
          </View>
        </View>
      )}
    </View>
  );
}
function TaskEditor({
  day,
  task,
  preset,
  close,
}: {
  day: string;
  task?: Task;
  preset?: Preset;
  close: () => void;
}) {
  const { state, update } = usePlanner();
  const sheet = useSheetLayout(560);
  const base = task || preset;
  const [placeId, setPlaceId] = useState(base?.placeId);
  const [title, setTitle] = useState(base?.title || "");
  const [note, setNote] = useState(base?.note || "");
  const [date, setDate] = useState(base?.date || day);
  const [time, setTime] = useState(base?.time || "09:00");
  const [duration, setDuration] = useState(String(base?.duration || 30));
  const [category, setCategory] = useState<Category>(base?.category || "life");
  const [icon, setIcon] = useState(base?.icon || "sparkles");
  const [repeat, setRepeat] = useState<Repeat>(base?.repeat || "none");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  function save() {
    if (!title.trim()) return setError("Gib deiner Aufgabe einen Namen.");
    if (!validDate(date))
      return setError("Bitte ein gültiges Datum als JJJJ-MM-TT eingeben.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      return setError("Bitte eine Uhrzeit als HH:MM eingeben.");
    if (
      !Number.isInteger(Number(duration)) ||
      Number(duration) < 1 ||
      Number(duration) > 1440
    )
      return setError("Die Dauer muss zwischen 1 und 1440 Minuten liegen.");
    const next: Task = {
      id:
        task?.id ||
        "task-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
      title: title.trim(),
      note: note.trim(),
      date,
      time,
      duration: Number(duration),
      category,
      icon,
      repeat,
      skipped: task?.skipped || [],
      placeId,
    };
    update((prev) => ({
      ...prev,
      tasks: task
        ? prev.tasks.map((t) => (t.id === task.id ? next : t))
        : [...prev.tasks, next],
    }));
    close();
  }
  function remove(onlyToday: boolean) {
    if (!task) return;
    update((prev) => ({
      ...prev,
      tasks: onlyToday
        ? prev.tasks.map((t) =>
            t.id === task.id ? { ...t, skipped: [...t.skipped, day] } : t,
          )
        : prev.tasks.filter((t) => t.id !== task.id),
      done: Object.fromEntries(
        Object.entries(prev.done).filter(([key]) =>
          onlyToday
            ? key !== occurrenceKey(task, day)
            : !key.startsWith(task.id + ":"),
        ),
      ),
    }));
    close();
  }
  return (
    <Modal
      visible
      transparent
      animationType={sheet.animation}
      onRequestClose={close}
    >
      <View style={[s.modalBackdrop, sheet.backdrop]}>
        <Pressable
          accessibilityLabel="Dialog schließen"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[s.modal, sheet.modal]}>
          <Grabber show={sheet.phone} />
          <View style={[s.modalHeader, sheet.phone && { padding: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>
                {task ? "Aufgabe bearbeiten" : "Etwas Gutes vornehmen"}
              </Text>
              <Text style={[s.muted, { marginTop: 5 }]}>
                {task?.repeat && task.repeat !== "none"
                  ? "Änderungen gelten für die gesamte Serie."
                  : "Ein kleiner Plan ist ein guter Anfang."}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Schließen"
              onPress={close}
              style={s.arrow}
            >
              <X size={21} color={C.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 25, gap: 19 }}
          >
            <Field
              label="Was hast du vor?"
              value={title}
              onChangeText={setTitle}
              placeholder="z. B. Vorlesung nacharbeiten"
              autoFocus={Platform.OS === "web"}
              maxLength={120}
            />
            <View>
              <Text style={s.label}>Kategorie</Text>
              <View style={s.wrap}>
                {(Object.keys(categories) as Category[]).map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => {
                      setCategory(key);
                      setIcon(categories[key].icon);
                    }}
                    style={[
                      s.categoryOption,
                      category === key && {
                        backgroundColor: categories[key].pale,
                        borderColor: categories[key].color,
                      },
                    ]}
                  >
                    <Icon
                      name={categories[key].icon}
                      color={categories[key].color}
                      size={18}
                    />
                    <Text
                      style={{ color: categories[key].color, fontSize: 12 }}
                    >
                      {categories[key].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text style={s.label}>Dein Icon</Text>
              <View style={s.wrap}>
                {Object.keys(icons).map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={"Icon " + key}
                    onPress={() => setIcon(key)}
                    style={[
                      s.iconOption,
                      icon === key && {
                        backgroundColor: C.pale,
                        borderColor: C.green,
                      },
                    ]}
                  >
                    <Icon name={key} size={20} />
                  </Pressable>
                ))}
              </View>
            </View>
            <Field
              label="Datum / Serienbeginn (JJJJ-MM-TT)"
              value={date}
              onChangeText={setDate}
              placeholder="2026-10-15"
              maxLength={10}
            />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Uhrzeit (HH:MM)"
                  value={time}
                  onChangeText={setTime}
                  placeholder="09:00"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Dauer in Minuten"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>
            {state.transport.enabled && state.places.length > 0 && (
              <View>
                <Text style={s.label}>Ort (für die Wegplanung)</Text>
                <View style={s.wrap}>
                  <Chip label="Kein Weg" active={!placeId} onPress={() => setPlaceId(undefined)} />
                  <Chip label="Zuhause" active={placeId === "home"} onPress={() => setPlaceId("home")} />
                  {state.places.map((p) => (
                    <Chip key={p.id} label={p.name + " · " + p.minutes + " Min."} active={placeId === p.id} onPress={() => setPlaceId(p.id)} />
                  ))}
                </View>
              </View>
            )}
            <View>
              <Text style={s.label}>Wiederholung</Text>
              <View style={s.wrap}>
                {(Object.keys(repeats) as Repeat[]).map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => setRepeat(key)}
                    style={[s.filter, repeat === key && s.filterActive]}
                  >
                    <Text
                      style={[
                        s.filterText,
                        repeat === key && { color: C.green },
                      ]}
                    >
                      {repeats[key]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Field
              label="Notizen (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Was möchtest du dir merken?"
              multiline
              maxLength={2000}
            />
            {error ? <Text style={s.formError}>{error}</Text> : null}
            {task && (
              <View style={{ gap: 10 }}>
                {!deleting ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDeleting(true)}
                    style={s.row}
                  >
                    <Trash2 size={15} color="#EC939B" />
                    <Text style={{ color: "#EC939B", fontSize: 12 }}>
                      Aufgabe löschen
                    </Text>
                  </Pressable>
                ) : (
                  <View
                    style={{
                      gap: 10,
                      padding: 15,
                      backgroundColor: "#302127",
                      borderRadius: 12,
                    }}
                  >
                    <Text style={s.body}>Was möchtest du löschen?</Text>
                    {task.repeat !== "none" && (
                      <Button quiet danger onPress={() => remove(true)}>
                        Nur am {parseDate(day).toLocaleDateString("de-DE")}
                      </Button>
                    )}
                    <Button quiet danger onPress={() => remove(false)}>
                      {task.repeat === "none"
                        ? "Aufgabe endgültig löschen"
                        : "Gesamte Serie löschen"}
                    </Button>
                    <Pressable onPress={() => setDeleting(false)}>
                      <Text style={s.link}>Abbrechen</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          <View style={s.modalFooter}>
            <Button quiet onPress={close}>
              Abbrechen
            </Button>
            <Button icon={Check} onPress={save}>
              {task ? "Änderungen speichern" : "Aufgabe anlegen"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
// On phones dialogs become bottom sheets: reachable with the thumb, full width.
function useSheetLayout(preferred: number) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const phone = width < 600;
  return {
    phone,
    animation: (phone && Platform.OS !== "web" ? "slide" : "fade") as
      | "slide"
      | "fade",
    backdrop: phone
      ? { justifyContent: "flex-end" as const, paddingVertical: 0 }
      : null,
    modal: phone
      ? {
          width: "100%" as const,
          maxHeight: "94%" as const,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          paddingBottom: insets.bottom,
        }
      : {
          width: width < preferred + 40 ? ("95%" as const) : preferred,
          maxHeight: "92%" as const,
        },
  };
}
function Grabber({ show }: { show: boolean }) {
  return show ? (
    <View
      style={{
        alignSelf: "center",
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#4A4A55",
        marginTop: 9,
      }}
    />
  ) : null;
}
export function Sheet({
  title,
  subtitle,
  close,
  children,
  footer,
  width: preferred = 560,
}: {
  title: string;
  subtitle?: string;
  close: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const sheet = useSheetLayout(preferred);
  return (
    <Modal
      visible
      transparent
      animationType={sheet.animation}
      onRequestClose={close}
    >
      <View style={[s.modalBackdrop, sheet.backdrop]}>
        <Pressable
          accessibilityLabel="Dialog schließen"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[s.modal, sheet.modal]}>
          <Grabber show={sheet.phone} />
          <View style={[s.modalHeader, sheet.phone && { padding: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{title}</Text>
              {subtitle ? (
                <Text style={[s.muted, { marginTop: 5 }]}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Schließen"
              onPress={close}
              style={s.arrow}
            >
              <X size={21} color={C.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 25, gap: 19 }}
          >
            {children}
          </ScrollView>
          {footer ? <View style={s.modalFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
export function Chip({
  label,
  active,
  onPress,
  color = C.green,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[
        s.filter,
        active && { backgroundColor: C.pale, borderColor: color },
      ]}
    >
      <Text style={[s.filterText, active && { color, fontWeight: "600" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#928B9A"
        style={[
          s.input,
          props.multiline && { minHeight: 88, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}

export const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: C.bg },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sidebar: {
    width: 224,
    backgroundColor: "#17181C",
    borderRightWidth: 1,
    borderRightColor: C.line,
    padding: 23,
    paddingTop: 35,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandIcon: {
    backgroundColor: C.green,
    width: 39,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: C.ink,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -2,
  },
  sidebarEyebrow: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: "#9E96A5",
    marginTop: 16,
  },
  navItem: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  navActive: { backgroundColor: "#342229" },
  navLabel: { color: "#B0ABB8", fontSize: 13 },
  navDot: {
    width: 5,
    height: 5,
    backgroundColor: C.green,
    borderRadius: 9,
    marginLeft: "auto",
  },
  sidebarBottom: { marginTop: "auto" },
  smallGarden: {
    padding: 20,
    paddingTop: 25,
    backgroundColor: "#252027",
    borderRadius: 14,
    marginBottom: 24,
  },
  gardenTitle: {
    color: "#DAC0CA",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    marginTop: 15,
  },
  gardenNote: { color: "#B2A8B8", fontSize: 11, lineHeight: 19, marginTop: 10 },
  saveNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 21,
    paddingHorizontal: 3,
  },
  topbar: {
    height: 82,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#17181C",
  },
  avatar: {
    width: 34,
    height: 34,
    backgroundColor: "#30232B",
    borderRadius: 13,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4C333D",
  },
  scrollContent: {
    padding: 38,
    paddingTop: 33,
    paddingBottom: 42,
    flexGrow: 1,
  },
  content: { width: "100%", maxWidth: 1280, alignSelf: "center" },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 28,
  },
  h1: { color: C.ink, fontSize: 36, fontWeight: "800", letterSpacing: -1.2 },
  h2: { color: C.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  h3: { color: C.ink, fontSize: 15, fontWeight: "600" },
  body: { color: C.ink, fontSize: 15 },
  muted: { color: C.muted, fontSize: 13 },
  micro: { color: C.muted, fontSize: 12 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: "#6F6D76" },
  button: {
    backgroundColor: C.button,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
  },
  quietButton: { backgroundColor: "#1C1C21" },
  buttonText: { color: C.onAccent, fontSize: 14, fontWeight: "700" },
  link: { color: C.green, fontSize: 13, fontWeight: "600" },
  hero: {
    backgroundColor: C.hero,
    borderRadius: 18,
    padding: 32,
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
    marginBottom: 29,
    overflow: "hidden",
  },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 7 },
  heroTitle: {
    color: "#FFF4F6",
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 40,
    letterSpacing: -0.7,
    marginTop: 14,
  },
  heroText: { color: "#DBB9C3", fontSize: 12, marginTop: 12, lineHeight: 20 },
  heroSmall: { color: "#F2D8DF", fontSize: 11 },
  heroDecor: {
    width: 155,
    height: 155,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#6B3544",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#341921",
  },
  heroDecorDot: {
    width: 22,
    height: 22,
    borderRadius: 40,
    backgroundColor: "#EF7486",
    position: "absolute",
    top: 9,
    right: 9,
  },
  columns: { flexDirection: "row", gap: 25, alignItems: "stretch" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    overflow: "hidden",
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 10, fontWeight: "600" },
  weekStrip: {
    backgroundColor: "transparent",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  weekDay: {
    flex: 1,
    minWidth: 26,
    maxWidth: 70,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    gap: 9,
  },
  weekDayActive: { backgroundColor: C.button },
  dayNumber: { color: C.ink, fontSize: 18, fontWeight: "600" },
  dayDot: { width: 4, height: 4, borderRadius: 9 },
  arrow: { padding: 7, alignItems: "center", justifyContent: "center" },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.white,
    minHeight: 38,
  },
  filterActive: { backgroundColor: C.pale, borderColor: C.green },
  filterText: { color: C.muted, fontSize: 13 },
  groupLabel: {
    fontSize: 8,
    color: "#A79DAE",
    letterSpacing: 1.5,
    paddingTop: 19,
    paddingHorizontal: 22,
    paddingBottom: 5,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 21,
    gap: 15,
    borderBottomColor: "#2D2E35",
    borderBottomWidth: 1,
    minHeight: 86,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.4,
    borderColor: "#57525F",
    justifyContent: "center",
    alignItems: "center",
  },
  taskBody: {
    flex: 1,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    paddingVertical: 18,
  },
  taskIcon: {
    width: 41,
    height: 41,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  taskTitle: {
    color: "#E3E1E7",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 21 },
  progressCard: { alignItems: "center", padding: 24 },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#342D24",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 20,
  },
  gentleCard: {
    borderWidth: 1,
    borderColor: "#45313E",
    borderRadius: 15,
    padding: 22,
    backgroundColor: "#29212B",
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 25,
  },
  empty: { alignItems: "center", padding: 30, gap: 14 },
  celebration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    marginTop: 20,
    backgroundColor: "#35252D",
    borderRadius: 11,
  },
  mobileNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderColor: C.line,
    paddingTop: 6,
    justifyContent: "space-around",
  },
  mobileNavItem: { alignItems: "center", gap: 3, flex: 1, minHeight: 48 },
  mobileNavIcon: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#08090DBB",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  modal: {
    backgroundColor: "#1C1D22",
    borderRadius: 19,
    overflow: "hidden",
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 25,
    borderBottomWidth: 1,
    borderColor: C.line,
    gap: 10,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  label: { color: "#C1BDC9", fontSize: 11, fontWeight: "600", marginBottom: 9 },
  input: {
    borderWidth: 1,
    borderColor: "#26262C",
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    color: C.ink,
    backgroundColor: "#141417",
    minHeight: 46,
  },
  categoryOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 11,
    gap: 7,
    alignItems: "center",
    minWidth: 65,
  },
  iconOption: {
    width: 37,
    height: 37,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  formError: { color: "#F2A0A5", fontSize: 12 },
  errorBar: {
    backgroundColor: "#3E2429",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  calendarWeekLabel: {
    textAlign: "center",
    paddingBottom: 17,
    color: C.muted,
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: C.line,
  },
  calendarCell: {
    width: "14.2857%",
    minHeight: 115,
    padding: 9,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
    gap: 5,
  },
  calendarNumber: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarTask: { padding: 4, borderRadius: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  statCard: { flex: 1, minWidth: 140, padding: 25, gap: 15 },
  statValue: {
    color: C.ink,
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1,
  },
  progressTrack: {
    height: 9,
    backgroundColor: C.pale,
    borderRadius: 9,
    overflow: "hidden",
    marginTop: 25,
  },
  notice: {
    padding: 18,
    borderRadius: 11,
    backgroundColor: "#2D2530",
    marginBottom: 18,
  },
});

