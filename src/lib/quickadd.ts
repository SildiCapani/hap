import { dateKey, parseDate, shiftDay, type Category, type Repeat } from "./planner.ts";

// Turns "morgen 10 uhr DB lernen 2h" into a task draft. Everything that is
// recognised as date, time, duration or repetition is removed from the title.
export type Draft = {
  title: string;
  date: string;
  time: string;
  duration: number;
  category: Category;
  icon: string;
  repeat: Repeat;
};

const weekdays: Record<string, number> = {
  so: 0, sonntag: 0,
  mo: 1, montag: 1,
  di: 2, dienstag: 2,
  mi: 3, mittwoch: 3,
  do: 4, donnerstag: 4,
  fr: 5, freitag: 5,
  sa: 6, samstag: 6,
};

const keywords: [RegExp, Category, string][] = [
  [/\b(gym|training|trainieren|laufen|joggen|push|pull|legs|beine|brust|rücken|workout|sport|fitness|schwimmen|radfahren|boxen|yoga|mobility)\b/i, "sport", "dumbbell"],
  [/\b(lernen|uni|vorlesung|klausur|übung|uebung|abgabe|hausarbeit|projekt|seminar|tutorium|code|programmieren|lesen|bachelor|praxis|bericht|wiederholen)\b/i, "uni", "graduation"],
  [/\b(essen|kochen|einkaufen|frühstück|mittag|abendessen|meal ?prep|mensa)\b/i, "food", "utensils"],
];

const pad = (n: number) => String(n).padStart(2, "0");

export function parseQuick(input: string, today = dateKey(), now = new Date()): Draft | null {
  let text = " " + input.trim().replace(/\s+/g, " ") + " ";
  const take = (re: RegExp) => {
    const m = re.exec(text);
    if (m) text = text.replace(m[0], " ");
    return m;
  };
  let date = today;
  let repeat: Repeat = "none";
  let explicitDate = false;

  if (take(/\s(täglich|jeden tag)\s/i)) repeat = "daily";
  else if (take(/\s(werktags|mo\s?-\s?fr)\s/i)) repeat = "weekdays";
  const weekly = take(/\s(jeden|jede|wöchentlich am)\s(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\s/i);
  if (weekly) repeat = "weekly";

  if (take(/\sübermorgen\s/i)) {
    date = shiftDay(today, 2);
    explicitDate = true;
  } else if (take(/\smorgen\s/i)) {
    date = shiftDay(today, 1);
    explicitDate = true;
  } else if (take(/\sheute\s/i)) explicitDate = true;

  const dm = take(/\s(\d{1,2})\.(\d{1,2})\.(\d{2,4})?\s/);
  if (dm) {
    const year = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : Number(today.slice(0, 4));
    let candidate = year + "-" + pad(Number(dm[2])) + "-" + pad(Number(dm[1]));
    if (!dm[3] && candidate < today) candidate = year + 1 + candidate.slice(4);
    if (dateKey(parseDate(candidate)) === candidate) {
      date = candidate;
      explicitDate = true;
    }
  }
  const wd = weekly
    ? [weekly[0], weekly[2]]
    : !explicitDate &&
      // Short names like "so" or "do" are common words, so they need "am" or a dot.
      (take(/\s(?:am\s)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\s/i) ||
        take(/\sam\s(mo|di|mi|do|fr|sa|so)\.?\s/i) ||
        take(/\s(mo|di|mi|do|fr|sa|so)\.\s/i));
  if (wd) {
    const target = weekdays[wd[1].toLowerCase()];
    const current = parseDate(today).getDay();
    let diff = (target - current + 7) % 7;
    if (diff === 0 && !weekly) diff = 7;
    date = shiftDay(today, diff);
  }

  let duration = 0;
  const hm = take(/\s(\d+(?:[.,]\d+)?)\s?(h|std|stunden?)\s/i);
  if (hm) duration = Math.round(Number(hm[1].replace(",", ".")) * 60);
  const mm = take(/\s(\d+)\s?(min|minuten|m)\s/i);
  if (mm) duration += Number(mm[1]);

  let time = "";
  const t =
    take(/\s(?:um\s)?([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s?uhr)?\s/i) ||
    take(/\s(?:um\s)?([01]?\d|2[0-3])\s?uhr\s/i) ||
    take(/\sum\s([01]?\d|2[0-3])\s/i);
  if (t) time = pad(Number(t[1])) + ":" + (t[2] && /^\d\d$/.test(t[2]) ? t[2] : "00");

  const title = text.replace(/\s+/g, " ").trim().replace(/^(ich muss|noch)\s/i, "");
  if (!title) return null;
  const match = keywords.find(([re]) => re.test(title));
  const category: Category = match ? match[1] : "life";
  if (!duration) duration = category === "sport" ? 60 : category === "uni" ? 60 : 30;
  if (!time) {
    // Without a time, use the next full hour today or 09:00 on other days.
    const next = Math.min(22, now.getHours() + 1);
    time = date === today ? pad(next) + ":00" : "09:00";
  }
  return {
    title: title[0].toUpperCase() + title.slice(1),
    date,
    time,
    duration: Math.min(1440, duration),
    category,
    icon: match ? match[2] : "sparkles",
    repeat,
  };
}
