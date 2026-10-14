function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * "Add to Google Calendar" link (safe to use in client components).
 *
 * The event carries a title, the time and the address only. It never carries the patient's manage
 * link (/a/<token>): a calendar entry is synced to Google, shared with family calendars and shown on
 * lock screens, and the link would let anyone who sees it cancel or move the visit. Callers pass a
 * discreet title (the practice, not the treatment).
 */
export function googleCalendarUrl(e: { title: string; start: Date; end: Date; location?: string }): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
