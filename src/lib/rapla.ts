// Parser for the DHBW Rapla HTML week view. Rapla offers no iCal export for
// these links, so events are positioned by rebuilding the table grid
// (rowspan/colspan) and mapping each block to its day column.

export type UniEvent = {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  persons: string[];
  rooms: string[];
  kind: "lecture" | "exam" | "info";
};

const allowedHost = "rapla.dhbw.de";

export function validRaplaUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === allowedHost &&
      /^\/rapla\/(internal_calendar|calendar)$/.test(url.pathname) &&
      !!url.searchParams.get("key")
    );
  } catch {
    return false;
  }
}

export function raplaWeeksUrl(base: string, from: string, weeks: number) {
  const url = new URL(base.trim());
  const [year, month, day] = from.split("-");
  url.pathname = "/rapla/internal_calendar";
  url.searchParams.set("day", String(Number(day)));
  url.searchParams.set("month", String(Number(month)));
  url.searchParams.set("year", year);
  url.searchParams.set("pages", String(Math.min(20, Math.max(1, weeks))));
  return url.toString();
}

function decode(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function attr(attrs: string, name: string) {
  const match = new RegExp(name + '="?(\\d+)"?').exec(attrs);
  return match ? Number(match[1]) : 1;
}

function classify(title: string): UniEvent["kind"] {
  if (/klausur|prüfung|exam|testat/i.test(title)) return "exam";
  if (/keine vorlesung|infotag|feiertag|frei\b/i.test(title)) return "info";
  return "lecture";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function parseRapla(html: string, from: string): UniEvent[] {
  const events: UniEvent[] = [];
  let year = Number(from.slice(0, 4));
  let lastMonth = Number(from.slice(5, 7));
  const tables = html.match(/<table class="week_table">[\s\S]*?<\/table>/g) || [];
  for (const table of tables) {
    const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    const occupied: boolean[][] = [];
    const days: { start: number; end: number; date: string }[] = [];
    rows.forEach((row, r) => {
      occupied[r] ??= [];
      let c = 0;
      const cells = row.matchAll(
        /<(td|th)([^>]*)>([\s\S]*?)<\/(?:td|th)>/g,
      );
      for (const [, , attrs, content] of cells) {
        while (occupied[r][c]) c++;
        const colspan = attr(attrs, "colspan");
        const rowspan = attr(attrs, "rowspan");
        for (let y = r; y < r + rowspan; y++) {
          occupied[y] ??= [];
          for (let x = c; x < c + colspan; x++) occupied[y][x] = true;
        }
        if (attrs.includes("week_header")) {
          const m = /(\d{1,2})\.(\d{1,2})\./.exec(decode(content));
          if (m) {
            const month = Number(m[2]);
            if (month < lastMonth - 6) year++;
            lastMonth = month;
            days.push({
              start: c,
              end: c + colspan,
              date: year + "-" + pad(month) + "-" + pad(Number(m[1])),
            });
          }
        } else if (attrs.includes("week_block")) {
          const day = days.find((d) => c >= d.start && c < d.end);
          const head = /<a[^>]*>([\s\S]*?)<\/a>/.exec(content);
          const parts = head ? head[1].split(/<br\s*\/?>/i) : [];
          const time = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(
            decode(parts[0] || ""),
          );
          const title = decode(parts.slice(1).join(" "));
          if (day && time && title) {
            const persons = [
              ...content.matchAll(/<span class="person">([\s\S]*?)<\/span>/g),
            ].map((x) => decode(x[1]));
            const rooms = [
              ...content.matchAll(
                /<span class="resource">([\s\S]*?)<\/span>/g,
              ),
            ]
              .map((x) => decode(x[1]))
              .filter((x) => !/^STG-/.test(x));
            const start = pad(Number(time[1])) + ":" + time[2];
            const end = pad(Number(time[3])) + ":" + time[4];
            events.push({
              id: "uni-" + day.date + "-" + start + "-" + slug(title),
              date: day.date,
              start,
              end,
              title,
              persons,
              rooms,
              kind: classify(title),
            });
          }
        }
        c += colspan;
      }
    });
  }
  const seen = new Set<string>();
  return events
    .filter((e) => !seen.has(e.id) && !!seen.add(e.id))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, "-")
    .slice(0, 40);
}

export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
