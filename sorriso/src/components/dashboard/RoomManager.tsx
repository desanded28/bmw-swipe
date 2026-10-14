"use client";

import { Armchair, Plus } from "lucide-react";
import { useState } from "react";
import { addRoom, updateRoom } from "@/app/dashboard/actions/locations";
import { useT } from "@/i18n/provider";
import { Button, Input, cx } from "../ui";
import { useRunAction } from "./useRunAction";

/**
 * The chairs of one office: rename (on blur), disable or enable, add. Accessibility is described
 * per office (the location form): a dental chair suitable for wheelchair transfer is one of its
 * features.
 */
export function RoomManager({ locationId, rooms }: { locationId: string; rooms: { id: string; name: string; active: boolean }[] }) {
  const t = useT("catalog");
  const { run, pending } = useRunAction();
  const [name, setName] = useState("");
  const next = t("rooms.newName", { n: rooms.length + 1 });
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {rooms.map((r) => (
          <li key={r.id} className={cx("flex items-center gap-2 rounded-xl px-3 py-2 ring-1", r.active ? "bg-white ring-slate-200" : "bg-slate-50 text-slate-500 ring-slate-200")}>
            <Armchair size={15} aria-hidden />
            <input
              defaultValue={r.name}
              aria-label={t("rooms.name")}
              maxLength={60}
              className="w-24 rounded bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              onBlur={(e) => e.target.value !== r.name && run(() => updateRoom(r.id, { name: e.target.value }))}
            />
            <button
              type="button"
              className="rounded text-xs font-semibold text-slate-600 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600"
              disabled={pending}
              aria-label={r.active ? t("rooms.disableLabel", { chair: r.name }) : t("rooms.enableLabel", { chair: r.name })}
              onClick={() => run(() => updateRoom(r.id, { active: !r.active }))}
            >
              {r.active ? t("rooms.disable") : t("rooms.enable")}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addRoom(locationId, name || next), (res) => res.ok && setName(""));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={next} aria-label={t("rooms.name")} maxLength={60} className="max-w-48" />
        <Button type="submit" variant="secondary" disabled={pending}>
          <Plus size={15} aria-hidden /> {t("rooms.add")}
        </Button>
      </form>
    </div>
  );
}
