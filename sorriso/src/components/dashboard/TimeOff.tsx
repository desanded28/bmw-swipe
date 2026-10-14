import type { TimeOff } from "@/db/schema";
import { TimeOffItems } from "../care/TimeOffItems";

/**
 * Time off and closures (WP8). Self-contained props, frozen: the team, practitioner and offices
 * pages render these (critique 32). TimeOffForm blocks time and offers to rebook the visits a
 * block covers; TimeOffList shows the blocks with their affected visits and the same
 * "Rebook N patients" drawer.
 *
 * No "use client" here: TimeOffList takes a `label` function, so it renders on the server and
 * hands plain data to its client list. Nothing in this module touches the database.
 */
export { TimeOffForm, type TimeOffFormProps } from "../care/TimeOffForm";

export function TimeOffList({
  items,
  tz,
  label,
}: {
  items: (TimeOff & { label?: string })[];
  tz: string;
  /** Who or what is unavailable, shown before the reason (e.g. the chair's name). */
  label?: (t: TimeOff) => string;
}) {
  return (
    <TimeOffItems
      tz={tz}
      items={items.map((t) => ({
        id: t.id,
        startsAt: t.startsAt.toISOString(),
        endsAt: t.endsAt.toISOString(),
        label: label?.(t) ?? t.label ?? null,
        reason: t.reason,
      }))}
    />
  );
}
