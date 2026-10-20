import { dateKey, parseDate, shiftDay, type PlannerState } from "./planner.ts";
import { agenda, briefing } from "./agenda.ts";
import { minutes } from "./rapla.ts";
import { examKinds, focusPick, hoursLabel, upcomingExams } from "./study.ts";
import { dueLabel, todoTimes } from "./todos.ts";

export type Reminder = { id: string; at: number; title: string; body: string; url: string };

function at(day: string, mins: number) {
  const d = parseDate(day);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.valueOf();
}

// All reminders for the next days, sorted. iOS keeps at most 64 scheduled,
// so the list is capped and recomputed whenever the plan changes.
export function reminders(state: PlannerState, now = Date.now(), horizon = 4): Reminder[] {
  const n = state.notify;
  const list: Reminder[] = [];
  if (state.activeFocus && state.activeFocus.pausedLeft === null && state.activeFocus.endsAt > now)
    list.push({
      id: "focus:" + state.activeFocus.startedAt,
      at: state.activeFocus.endsAt,
      title: "Fokusrunde geschafft! 🎉",
      body: state.activeFocus.label + " – Zeit für eine kurze Pause.",
      url: "/focus",
    });
  if (!n.enabled) return list;
  for (const todo of state.todos)
    for (const t of todoTimes(todo, now, horizon))
      list.push({
        id: "todo:" + todo.id + ":" + t,
        at: t,
        title: "📝 " + todo.title,
        body: todo.due ? "Fällig: " + dueLabel(todo, new Date(t)) : "Auf deiner To-do-Liste",
        url: "/todos",
      });
  const today = dateKey(new Date(now));
  for (let i = 0; i < horizon; i++) {
    const day = shiftDay(today, i);
    const { timed } = agenda(state, day);
    for (const item of timed) {
      if (item.done) continue;
      const lead =
        item.kind === "uni" ? 15 : item.kind === "training" ? 30 : n.lead;
      if (
        (item.kind === "uni" && !n.lectures) ||
        (item.kind === "task" && !n.tasks) ||
        (item.kind === "training" && !n.training) ||
        (item.kind === "exam" && !n.exams)
      )
        continue;
      const time = at(day, item.start - lead);
      const room = item.event?.rooms[0];
      list.push({
        id: item.key + ":" + day,
        at: time,
        title:
          item.kind === "uni"
            ? "In 15 Min.: " + item.title
            : item.kind === "training"
              ? "Gleich Training: " + item.workout?.name + " 💪"
              : item.kind === "exam"
                ? item.title + " in 30 Min."
                : item.title,
        body:
          item.kind === "uni"
            ? (room ? "Raum " + room : "Vorlesung") + " · bis " + item.event?.end
            : item.kind === "training"
              ? "Um " + item.workout?.time + " · " + item.workout?.exercises.length + " Übungen. Trinken nicht vergessen."
              : item.kind === "task"
                ? "Startet " + (lead ? "in " + lead + " Min." : "jetzt") + " · " + item.sub
                : "Tief durchatmen. Du bist vorbereitet.",
        url: item.kind === "training" ? "/training" : item.kind === "exam" ? "/study" : "/",
      });
    }
    if (n.briefing) {
      const lines = briefing(state, day);
      list.push({
        id: "brief:" + day,
        at: at(day, minutes(n.briefing)),
        title: "Guten Morgen" + (state.name ? ", " + state.name : "") + " ☀️",
        body: lines.length ? lines.slice(0, 4).join(" · ") : "Heute ist nichts geplant – plane deinen Tag in Hap.",
        url: "/",
      });
    }
    if (n.review) {
      const pick = focusPick(state, day);
      list.push({
        id: "review:" + day,
        at: at(day, minutes(n.review)),
        title: "Tagesabschluss",
        body: pick
          ? "Noch " + hoursLabel(pick.perDay - pick.today) + " für " + pick.exam.title + " offen. Hake ab, was du geschafft hast."
          : "Hake ab, was du heute geschafft hast, und plane morgen.",
        url: pick ? "/focus?exam=" + pick.exam.id : "/",
      });
    }
    if (n.exams)
      for (const s of upcomingExams(state, day))
        if ([14, 7, 3, 1].includes(s.days))
          list.push({
            id: "exam:" + s.exam.id + ":" + s.days,
            at: at(day, 18 * 60),
            title: examKinds[s.exam.kind].label + " in " + s.days + (s.days === 1 ? " Tag" : " Tagen"),
            body:
              s.exam.title +
              (s.left ? " · noch " + hoursLabel(s.left) + " Lernzeit offen" : " · Lernziel erreicht 💯"),
            url: "/study",
          });
  }
  const seen = new Set<string>();
  return list
    .filter((r) => r.at > now + 5000 && !seen.has(r.id) && !!seen.add(r.id))
    .sort((a, b) => a.at - b.at)
    .slice(0, 60);
}
