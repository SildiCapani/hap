import { useState } from "react";
import { Text, View, type DimensionValue } from "react-native";
import Svg, { Circle, Polyline, Line } from "react-native-svg";
import { categories, parseDate, shiftDay, monday, type PlannerState } from "@/lib/planner";
import { agenda } from "@/lib/agenda";
import { hoursLabel } from "@/lib/study";
import { C, s } from "./planner-ui";

export function Sparkline({
  values,
  color = C.green,
  height = 70,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  if (values.length < 2)
    return (
      <View style={{ height, justifyContent: "center" }}>
        <Text style={s.micro}>Ab zwei Einträgen siehst du hier deinen Verlauf.</Text>
      </View>
    );
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [
    6 + (i / (values.length - 1)) * Math.max(1, width - 12),
    6 + (1 - (v - min) / span) * (height - 12),
  ]);
  const last = points[points.length - 1];
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={height - 1} y2={height - 1} stroke={C.line} strokeWidth={1} />
          <Polyline
            points={points.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={last[0]} cy={last[1]} r={4.5} fill={color} />
        </Svg>
      )}
    </View>
  );
}

// GitHub-style grid: one cell per day, darker = more focus minutes.
export function Heatmap({
  data,
  color = "#F07B83",
}: {
  data: { date: string; minutes: number }[];
  color?: string;
}) {
  const max = Math.max(60, ...data.map((d) => d.minutes));
  const weeks: (typeof data)[] = [];
  const first = data[0] ? (parseDate(data[0].date).getDay() + 6) % 7 : 0;
  const padded = [...Array.from({ length: first }, () => null), ...data];
  for (let i = 0; i < padded.length; i += 7)
    weeks.push(padded.slice(i, i + 7).filter(Boolean) as typeof data);
  return (
    <View style={{ flexDirection: "row", gap: 4, flexWrap: "nowrap" }}>
      {weeks.map((week, w) => (
        <View key={w} style={{ gap: 4, justifyContent: w === 0 ? "flex-end" : "flex-start" }}>
          {week.map((d) => {
            const level = d.minutes ? 0.25 + 0.75 * Math.min(1, d.minutes / max) : 0;
            return (
              <View
                key={d.date}
                accessibilityLabel={parseDate(d.date).toLocaleDateString("de-DE") + ": " + d.minutes + " Minuten"}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  backgroundColor: level ? color : "#26272D",
                  opacity: level || 1,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const timeKinds = [
  { key: "uni", label: "Vorlesung", color: "#B9A2F2" },
  { key: "focus", label: "Fokus", color: "#F07B83" },
  { key: "sport", label: "Training", color: categories.sport.color },
  { key: "life", label: "Aufgaben", color: categories.life.color },
] as const;

export function weekTime(state: PlannerState, today: string) {
  const start = monday(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = shiftDay(start, i);
    const { timed } = agenda(state, d);
    const uni = timed.filter((t) => t.kind === "uni").reduce((n, t) => n + t.end - t.start, 0);
    const focus = state.focus.filter((f) => f.date === d).reduce((n, f) => n + f.minutes, 0);
    const sport = state.workoutLogs.filter((l) => l.date === d).reduce((n, l) => n + l.minutes, 0);
    const life = timed
      .filter((t) => t.kind === "task" && t.done && t.task?.category !== "sport")
      .reduce((n, t) => n + t.end - t.start, 0);
    return { date: d, uni, focus, sport, life };
  });
}

// "Zeitbild": where the hours of the week went, stacked per day.
export function TimePicture({ state, today }: { state: PlannerState; today: string }) {
  const days = weekTime(state, today);
  const max = Math.max(240, ...days.map((d) => d.uni + d.focus + d.sport + d.life));
  const totals = timeKinds.map((k) => ({
    ...k,
    minutes: days.reduce((n, d) => n + d[k.key], 0),
  }));
  return (
    <View>
      <View style={[s.wrap, { gap: 14, marginBottom: 20 }]}>
        {totals.map((t) => (
          <View key={t.key} style={s.row}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.color }} />
            <Text style={s.micro}>
              {t.label} <Text style={{ color: C.ink, fontWeight: "700" }}>{hoursLabel(t.minutes)}</Text>
            </Text>
          </View>
        ))}
      </View>
      <View style={[s.row, { alignItems: "flex-end", gap: 10 }]}>
        {days.map((d) => (
          <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: "100%",
                maxWidth: 46,
                height: 150,
                justifyContent: "flex-end",
                backgroundColor: "#202127",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {timeKinds.map((k) =>
                d[k.key] ? (
                  <View
                    key={k.key}
                    style={{
                      height: ((d[k.key] / max) * 100 + "%") as DimensionValue,
                      backgroundColor: k.color,
                      borderTopWidth: 1,
                      borderTopColor: "#121316",
                    }}
                  />
                ) : null,
              )}
            </View>
            <Text style={[s.micro, d.date === today && { color: C.green, fontWeight: "700" }]}>
              {parseDate(d.date).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "")}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Bar({ value, color = C.green, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: "#2A2B32", borderRadius: 9, overflow: "hidden" }}>
      <View
        style={{
          width: (Math.min(1, Math.max(0, value)) * 100 + "%") as DimensionValue,
          height: "100%",
          backgroundColor: color,
          borderRadius: 9,
        }}
      />
    </View>
  );
}
