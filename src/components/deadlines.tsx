import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarPlus, X } from "lucide-react-native";
import { parseDate, type Task, type Todo } from "@/lib/planner";
import { deadlineStatus, deadlinesToPlan, dropBlocks, estimateEffort, planDeadline } from "@/lib/deadlines";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, s, useToday } from "./planner-ui";
import { hours } from "./todos";

const uni = "#C4A3EF";
const day = (d: string) => parseDate(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });

// Home card: deadlines (e.g. from Moodle) that have no work time yet. One
// tap plans the estimated hours into free time before the due date.
export function DeadlineCard() {
  const { state, update } = usePlanner();
  const today = useToday();
  const [result, setResult] = useState("");
  const list = deadlinesToPlan(state, today);
  if (!list.length && !result) return null;
  const need = (t: Todo) => (t.effort === undefined ? estimateEffort(t.title) : deadlineStatus(state, t, today).missing);

  function plan(items: Todo[]) {
    tap("success");
    // Planned on the current state; only the result goes into the update.
    let next = state;
    let missing = 0;
    const created: Task[] = [];
    for (const t of items) {
      const r = planDeadline(next, t, t.effort ?? estimateEffort(t.title));
      next = r.state;
      missing += r.missing;
      created.push(...r.created);
    }
    const ids = new Set(items.map((t) => t.id));
    const efforts = new Map(next.todos.filter((t) => ids.has(t.id)).map((t) => [t.id, t.effort]));
    update((prev) => {
      let tasks = prev.tasks;
      for (const id of ids) tasks = dropBlocks({ ...prev, tasks }, id, today);
      return {
        ...prev,
        tasks: [...tasks, ...created],
        todos: prev.todos.map((t) => (efforts.has(t.id) ? { ...t, effort: efforts.get(t.id) } : t)),
      };
    });
    const when = created.slice(0, 3).map((b) => day(b.date) + " " + b.time).join(", ");
    setResult(
      created.length
        ? created.length + (created.length === 1 ? " Block" : " Blöcke") + " eingeplant (" + when + (created.length > 3 ? " …" : "") + ")." + (missing >= 30 ? " " + hours(missing) + " passten nicht mehr rein." : "")
        : "Vor der Frist ist kein freier Platz mehr. Verschieb etwas im Zeitplan.",
    );
  }
  const skip = (t: Todo) => {
    tap("light");
    update((prev) => ({ ...prev, todos: prev.todos.map((x) => (x.id === t.id ? { ...x, effort: 0 } : x)) }));
  };

  return (
    <View style={[s.card, { padding: 16, marginBottom: 16, gap: 10 }]}>
      <View style={s.row}>
        <CalendarPlus size={18} color={uni} />
        <Text style={[s.eyebrow, { color: uni, flex: 1 }]}>ABGABEN PLANEN</Text>
        {result ? (
          <Pressable accessibilityLabel="Hinweis schließen" hitSlop={8} onPress={() => setResult("")}>
            <X size={16} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
      {list.slice(0, 3).map((t) => (
        <View key={t.id} style={[s.row, { gap: 10 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.h3} numberOfLines={1}>{t.title}</Text>
            <Text style={[s.micro, { marginTop: 2 }]}>
              fällig {day(t.due.slice(0, 10))} · {t.effort === undefined ? "≈ " + hours(need(t)) : hours(need(t)) + " fehlen noch"}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => plan([t])} hitSlop={6}>
            <Text style={[s.link, { color: uni }]}>Einplanen</Text>
          </Pressable>
          <Pressable accessibilityLabel={t.title + ": keine Zeit nötig"} onPress={() => skip(t)} hitSlop={8}>
            <X size={15} color={C.muted} />
          </Pressable>
        </View>
      ))}
      {list.length > 1 && (
        <View style={s.row}>
          <Button quiet icon={CalendarPlus} onPress={() => plan(list)}>
            {"Alle " + list.length + " einplanen"}
          </Button>
        </View>
      )}
      {result ? <Text style={[s.micro, { color: C.ink, lineHeight: 18 }]}>{result}</Text> : null}
      {list.length ? <Text style={s.micro}>Zeit ändern: To-do antippen → Arbeitszeit. ✕ = braucht keine Zeit.</Text> : null}
    </View>
  );
}
