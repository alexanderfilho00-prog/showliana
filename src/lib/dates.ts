// Civil-date helpers. Every date in Showliana is a plain "YYYY-MM-DD" string and
// every time is "HH:mm", read in America/Sao_Paulo. Dates without a time never
// go through a Date object at local midnight, so they can't drift a day.

export const TZ = "America/Sao_Paulo";
export const LOCALE = "pt-BR";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function nowParts(d = new Date()) {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(d)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    hour: Number(p.hour),
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export const todayISO = () => nowParts().date;

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function addMonths(iso: string, n: number) {
  const d = toUTC(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fromUTC(d);
}

export function diffDays(a: string, b: string) {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000);
}

/** 0 = domingo */
export const weekday = (iso: string) => toUTC(iso).getUTCDay();

/** Weeks start on Sunday, like Brazilian paper calendars. */
export const startOfWeek = (iso: string) => addDays(iso, -weekday(iso));

export const startOfMonth = (iso: string) => iso.slice(0, 8) + "01";

export function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minToTime(min: number) {
  const m = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...opts });

const fLong = fmt({ weekday: "long", day: "numeric", month: "long" });
const fWeekdayShort = fmt({ weekday: "short" });
const fDayMonth = fmt({ day: "numeric", month: "short" });
const fMonthYear = fmt({ month: "long", year: "numeric" });
const fWeekdayLong = fmt({ weekday: "long" });

const clean = (s: string) => s.replace(/\./g, "");

export const formatLong = (iso: string) => fLong.format(toUTC(iso));
export const formatWeekdayShort = (iso: string) => clean(fWeekdayShort.format(toUTC(iso)));
export const formatWeekdayLong = (iso: string) => fWeekdayLong.format(toUTC(iso));
export const formatDayMonth = (iso: string) => clean(fDayMonth.format(toUTC(iso)));
export const formatMonthYear = (iso: string) => fMonthYear.format(toUTC(iso));
export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

export function formatRelative(iso: string, today = todayISO()) {
  const d = diffDays(iso, today);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d > 1 && d < 7) return formatWeekdayLong(iso);
  return formatDayMonth(iso);
}

export function formatTime(t: string) {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function greeting(hour = nowParts().hour) {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}
