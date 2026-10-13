/**
 * Deterministic English date labels. Intl's long formats differ between Node
 * and browsers ("Tuesday 13 October" vs "Tuesday, 13 October"), which breaks
 * hydration for client components rendered on the server. Numeric Intl parts
 * (en-CA dates, h23 times) are stable and still used for time-zone math.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type DayStyle = "long" | "medium" | "weekday" | "short" | "wd";

/** Format a YYYY-MM-DD calendar date. */
export function fmtDay(date: string, style: DayStyle = "weekday"): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekday = WEEKDAYS[wd];
  const month = MONTHS[m - 1];
  switch (style) {
    case "long":
      return `${weekday} ${d} ${month} ${y}`;
    case "medium":
      return `${weekday} ${d} ${month}`;
    case "weekday":
      return `${weekday.slice(0, 3)} ${d} ${month.slice(0, 3)}`;
    case "short":
      return `${d} ${month.slice(0, 3)}`;
    case "wd":
      return weekday.slice(0, 3);
  }
}

export function zonedDate(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}

export function zonedTime(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}

/** e.g. "Wednesday 14 October at 08:30" */
export function fmtWhen(iso: string | Date, tz: string, style: DayStyle = "medium"): string {
  return `${fmtDay(zonedDate(iso, tz), style)} at ${zonedTime(iso, tz)}`;
}
