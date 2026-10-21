import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { Archive, Bell, Check, ChevronDown, ChevronRight, Clock3, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react-native";
import { dateKey, localStamp, newId, shiftDay, validDate, type RemindMode, type Todo } from "@/lib/planner";
import { defaultRemind, dueLabel, remindLabel, remindModes, sortTodos, todoState, type TodoState } from "@/lib/todos";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, Chip, Field, Sheet, Shell, s } from "./planner-ui";

const stateStyle: Record<TodoState, { label: string; color: string }> = {
  overdue: { label: "Überfällig", color: "#FF6B78" },
  today: { label: "Heute", color: "#F07B83" },
  soon: { label: "Demnächst", color: "#E5B073" },
  later: { label: "Später", color: "#92B9DB" },
  open: { label: "Ohne Endzeit", color: "#A5A3AE" },
};
const order: TodoState[] = ["overdue", "today", "soon", "later", "open"];
const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function useTodoActions() {
  const { update } = usePlanner();
  return {
    toggle: (todo: Todo) => {
      tap(todo.doneAt ? "light" : "success");
      update((prev) => ({
        ...prev,
        todos: prev.todos.map((t) => (t.id === todo.id ? { ...t, doneAt: t.doneAt ? null : localStamp() } : t)),
      }));
    },
  };
}

export function TodoRow({ todo, onEdit }: { todo: Todo; onEdit?: () => void }) {
  const { toggle } = useTodoActions();
  const status = todoState(todo);
  const remind = remindLabel(todo);
  const done = !!todo.doneAt;
  return (
    <Animated.View layout={LinearTransition} exiting={FadeOut.duration(200)} style={[s.row, { gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#1A1A1F" }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={todo.title + (done ? " wieder öffnen" : " erledigen")}
        hitSlop={10}
        onPress={() => toggle(todo)}
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.6,
          borderColor: done ? C.button : stateStyle[status].color,
          backgroundColor: done ? C.button : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done && <Check size={14} color={C.onAccent} strokeWidth={3} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={todo.title + " bearbeiten"} onPress={onEdit} disabled={!onEdit} style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[s.body, { fontSize: 17, fontWeight: "500" }, done && { color: C.muted, textDecorationLine: "line-through" }]} numberOfLines={2}>
          {todo.title}
        </Text>
        {(todo.due || remind || done) && (
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            {done ? (
              <Text style={s.micro}>Erledigt {dueLabel({ ...todo, due: todo.doneAt || "" })}</Text>
            ) : todo.due ? (
              <View style={[s.row, { gap: 4 }]}>
                <Clock3 size={11} color={stateStyle[status].color} />
                <Text style={{ fontSize: 11, color: stateStyle[status].color, fontWeight: "600" }}>{dueLabel(todo)}</Text>
              </View>
            ) : null}
            {remind && !done ? (
              <View style={[s.row, { gap: 4 }]}>
                <Bell size={11} color={C.muted} />
                <Text style={s.micro}>{remind}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function TodoEditor({ todo, draft, close, saved }: { todo?: Todo; draft?: string; close: () => void; saved?: () => void }) {
  const { update } = usePlanner();
  const today = dateKey();
  const [title, setTitle] = useState(todo?.title || draft || "");
  const [dueDay, setDueDay] = useState(todo?.due.slice(0, 10) || "");
  const [dueTime, setDueTime] = useState(todo?.due.slice(11, 16) || "18:00");
  const [remind, setRemind] = useState<Todo["remind"]>(todo?.remind || defaultRemind);
  const [onceDay, setOnceDay] = useState(todo?.remind.at.slice(0, 10) || today);
  const [onceTime, setOnceTime] = useState(todo?.remind.at.slice(11, 16) || "09:00");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const setMode = (mode: RemindMode) => setRemind({ ...remind, mode });
  function save() {
    if (!title.trim()) return setError("Was möchtest du erledigen?");
    if (dueDay && (!validDate(dueDay) || !validTime(dueTime))) return setError("Endzeit als Datum JJJJ-MM-TT und Uhrzeit HH:MM.");
    if (remind.mode === "once" && (!validDate(onceDay) || !validTime(onceTime))) return setError("Erinnerung als Datum JJJJ-MM-TT und Uhrzeit HH:MM.");
    if ((remind.mode === "daily" || remind.mode === "weekly") && !validTime(remind.time)) return setError("Uhrzeit als HH:MM.");
    if (remind.mode === "before" && !dueDay) return setError("„Vor der Endzeit“ braucht eine Endzeit.");
    const next: Todo = {
      id: todo?.id || newId("todo"),
      title: title.trim(),
      due: dueDay ? dueDay + "T" + dueTime : "",
      remind: { ...remind, at: remind.mode === "once" ? onceDay + "T" + onceTime : "" },
      createdAt: todo?.createdAt || localStamp(),
      doneAt: todo?.doneAt || null,
    };
    tap("success");
    update((prev) => ({ ...prev, todos: todo ? prev.todos.map((t) => (t.id === todo.id ? next : t)) : [...prev.todos, next] }));
    saved?.();
    close();
  }
  return (
    <Sheet
      title={todo ? "To-do bearbeiten" : "Neues To-do"}
      subtitle="Endzeit und Erinnerung sind optional."
      close={close}
      footer={
        <>
          <Button quiet onPress={close}>Abbrechen</Button>
          <Button icon={Check} onPress={save}>Speichern</Button>
        </>
      }
    >
      <Field label="Was ist zu tun?" value={title} onChangeText={setTitle} placeholder="z. B. Übungsblatt 3 abgeben" maxLength={160} />
      <View style={{ gap: 10 }}>
        <Text style={s.label}>Endzeit</Text>
        <View style={s.wrap}>
          <Chip label="Keine" active={!dueDay} onPress={() => setDueDay("")} />
          <Chip label="Heute" active={dueDay === today} onPress={() => setDueDay(today)} />
          <Chip label="Morgen" active={dueDay === shiftDay(today, 1)} onPress={() => setDueDay(shiftDay(today, 1))} />
          <Chip label="In 1 Woche" active={dueDay === shiftDay(today, 7)} onPress={() => setDueDay(shiftDay(today, 7))} />
        </View>
        {dueDay ? (
          <View style={s.row}>
            <View style={{ flex: 1.4 }}>
              <Field label="Datum (JJJJ-MM-TT)" value={dueDay} onChangeText={setDueDay} maxLength={10} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Uhrzeit" value={dueTime} onChangeText={setDueTime} maxLength={5} />
            </View>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 10 }}>
        <Text style={s.label}>Erinnern</Text>
        <View style={s.wrap}>
          {(Object.keys(remindModes) as RemindMode[]).map((m) => (
            <Chip key={m} label={remindModes[m]} active={remind.mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
        {remind.mode === "once" && (
          <View style={s.row}>
            <View style={{ flex: 1.4 }}>
              <Field label="Am (JJJJ-MM-TT)" value={onceDay} onChangeText={setOnceDay} maxLength={10} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Um" value={onceTime} onChangeText={setOnceTime} maxLength={5} />
            </View>
          </View>
        )}
        {(remind.mode === "daily" || remind.mode === "weekly") && (
          <>
            {remind.mode === "weekly" && (
              <View style={s.wrap}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <Chip key={d} label={weekdays[d]} active={remind.weekday === d} onPress={() => setRemind({ ...remind, weekday: d })} />
                ))}
              </View>
            )}
            <Field label="Uhrzeit" value={remind.time} onChangeText={(time) => setRemind({ ...remind, time })} maxLength={5} />
          </>
        )}
        {remind.mode === "hourly" && (
          <View style={s.wrap}>
            {[1, 2, 3, 4].map((h) => (
              <Chip key={h} label={"Alle " + h + " Std."} active={remind.hours === h} onPress={() => setRemind({ ...remind, hours: h })} />
            ))}
          </View>
        )}
        {remind.mode === "before" && (
          <View style={s.wrap}>
            {[
              [15, "15 Min."],
              [60, "1 Std."],
              [180, "3 Std."],
              [1440, "1 Tag"],
            ].map(([m, label]) => (
              <Chip key={m} label={String(label)} active={remind.before === m} onPress={() => setRemind({ ...remind, before: Number(m) })} />
            ))}
          </View>
        )}
        {remind.mode === "hourly" && <Text style={s.micro}>Zwischen 8 und 22 Uhr, bis das To-do erledigt ist.</Text>}
        {remind.mode !== "none" && <Text style={s.micro}>Wiederholte Erinnerungen enden mit der Endzeit oder sobald du abhakst.</Text>}
      </View>
      {error ? <Text style={s.formError}>{error}</Text> : null}
      {todo &&
        (!confirm ? (
          <Pressable onPress={() => setConfirm(true)} style={s.row}>
            <Trash2 size={15} color="#EC939B" />
            <Text style={{ color: "#EC939B", fontSize: 12 }}>Löschen</Text>
          </Pressable>
        ) : (
          <Button
            danger
            onPress={() => {
              update((prev) => ({ ...prev, todos: prev.todos.filter((t) => t.id !== todo.id) }));
              close();
            }}
          >
            Endgültig löschen
          </Button>
        ))}
    </Sheet>
  );
}

function TodosContent() {
  const { state, update } = usePlanner();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ todo?: Todo; draft?: string } | null>(null);
  const [archive, setArchive] = useState(false);
  const [clear, setClear] = useState(false);
  const open = sortTodos(state.todos.filter((t) => !t.doneAt));
  const done = [...state.todos.filter((t) => t.doneAt)].sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  const groups = order.map((g) => ({ g, items: open.filter((t) => todoState(t) === g) })).filter((x) => x.items.length);
  function add() {
    if (!text.trim()) return;
    tap("success");
    update((prev) => ({
      ...prev,
      todos: [...prev.todos, { id: newId("todo"), title: text.trim(), due: "", remind: defaultRemind, createdAt: localStamp(), doneAt: null }],
    }));
    setText("");
  }
  return (
    <>
      <View style={{ backgroundColor: "#17171B", borderRadius: 16, paddingLeft: 16, paddingRight: 6, marginBottom: 6 }}>
        <View style={[s.row, { gap: 8 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={add}
            returnKeyType="done"
            placeholder="Neues To-do …"
            placeholderTextColor="#7E7887"
            accessibilityLabel="Neues To-do"
            style={{ flex: 1, color: C.ink, fontSize: 16, paddingVertical: 10, minHeight: 44 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Endzeit und Erinnerung festlegen"
            onPress={() => setEditing({ draft: text })}
            style={{ width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#232328" }}
          >
            <SlidersHorizontal size={17} color={C.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hinzufügen"
            disabled={!text.trim()}
            onPress={add}
            style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: text.trim() ? C.button : "#2A2B31" }}
          >
            <Check size={18} color={text.trim() ? C.onAccent : C.muted} />
          </Pressable>
        </View>
      </View>
      {!state.notify.enabled && state.todos.some((t) => t.remind.mode !== "none" && !t.doneAt) && (
        <Pressable onPress={() => router.push("/settings")} style={[s.notice, s.row]}>
          <Bell size={15} color={C.green} />
          <Text style={[s.body, { flex: 1 }]}>Erinnerungen sind aus. Tippe hier, um Benachrichtigungen einzuschalten.</Text>
        </Pressable>
      )}
      {groups.length ? (
        <View>
          {groups.map(({ g, items }) => (
            <Animated.View key={g} entering={FadeInDown} layout={LinearTransition}>
              <View style={[s.row, { paddingTop: 22, paddingBottom: 2 }]}>
                <Text style={{ color: stateStyle[g].color, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 }}>{stateStyle[g].label.toUpperCase()}</Text>
                <Text style={{ color: "#6F6D76", fontSize: 12 }}>{items.length}</Text>
              </View>
              <View>
                {items.map((t) => (
                  <TodoRow key={t.id} todo={t} onEdit={() => setEditing({ todo: t })} />
                ))}
              </View>
            </Animated.View>
          ))}
        </View>
      ) : (
        <View style={[s.card, s.empty]}>
          <Check size={30} color={C.green} />
          <Text style={s.h3}>{done.length ? "Alles erledigt. Stark!" : "Noch keine To-dos"}</Text>
          <Text style={[s.muted, { textAlign: "center" }]}>Schreib oben, was ansteht. Endzeit und Erinnerung kannst du mit ⚙ festlegen.</Text>
        </View>
      )}
      {done.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Pressable accessibilityRole="button" onPress={() => setArchive(!archive)} style={[s.row, { paddingVertical: 10, paddingHorizontal: 4 }]}>
            <Archive size={16} color={C.muted} />
            <Text style={[s.h3, { color: C.muted, flex: 1 }]}>Archiv ({done.length})</Text>
            {archive ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
          </Pressable>
          {archive && (
            <Animated.View entering={FadeInDown} style={{ gap: 10 }}>
              <View style={s.card}>
                {done.map((t) => (
                  <View key={t.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <TodoRow todo={t} />
                    </View>
                    <Pressable
                      accessibilityLabel={t.title + " wiederherstellen"}
                      hitSlop={8}
                      onPress={() => update((prev) => ({ ...prev, todos: prev.todos.map((x) => (x.id === t.id ? { ...x, doneAt: null } : x)) }))}
                      style={[s.arrow, { marginRight: 10 }]}
                    >
                      <RotateCcw size={16} color={C.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
              {!clear ? (
                <Pressable onPress={() => setClear(true)} style={[s.row, { paddingHorizontal: 4 }]}>
                  <Trash2 size={14} color="#EC939B" />
                  <Text style={{ color: "#EC939B", fontSize: 12 }}>Archiv leeren</Text>
                </Pressable>
              ) : (
                <Button
                  quiet
                  danger
                  onPress={() => {
                    update((prev) => ({ ...prev, todos: prev.todos.filter((t) => !t.doneAt) }));
                    setClear(false);
                  }}
                >
                  Alle {done.length} archivierten To-dos löschen
                </Button>
              )}
            </Animated.View>
          )}
        </View>
      )}
      {editing && (
        <TodoEditor
          todo={editing.todo}
          draft={editing.draft}
          close={() => setEditing(null)}
          saved={() => {
            if (!editing.todo) setText("");
          }}
        />
      )}
    </>
  );
}

// Compact list for the home screen: overdue and due today.
export function DueTodos() {
  const { state } = usePlanner();
  const due = sortTodos(state.todos.filter((t) => !t.doneAt && ["overdue", "today"].includes(todoState(t))));
  if (!due.length) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable onPress={() => router.push("/todos" as "/")} style={[s.row, { marginBottom: 2 }]}>
        <Text style={[s.eyebrow, { flex: 1 }]}>HEUTE FÄLLIG</Text>
        <Text style={s.link}>Alle To-dos</Text>
        <ChevronRight size={14} color={C.green} />
      </Pressable>
      <View>
        {due.slice(0, 4).map((t) => (
          <TodoRow key={t.id} todo={t} onEdit={() => router.push("/todos" as "/")} />
        ))}
        {due.length > 4 && (
          <Pressable onPress={() => router.push("/todos" as "/")} style={{ padding: 12, paddingLeft: 52 }}>
            <Text style={s.link}>+{due.length - 4} weitere</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function TodosScreen() {
  return (
    <Shell title="To-dos" subtitle="Aufschreiben, abhaken, vergessen dürfen.">
      <TodosContent />
    </Shell>
  );
}
