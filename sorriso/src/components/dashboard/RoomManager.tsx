"use client";

import { Armchair, Plus } from "lucide-react";
import { useState } from "react";
import { addRoom, updateRoom } from "@/app/dashboard/actions";
import { Button, Input, cx } from "../ui";
import { useRunAction } from "./AppointmentDrawer";

export function RoomManager({ locationId, rooms }: { locationId: string; rooms: { id: string; name: string; active: boolean }[] }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {rooms.map((r) => (
          <div key={r.id} className={cx("flex items-center gap-2 rounded-xl px-3 py-2 ring-1", r.active ? "bg-white ring-slate-200" : "bg-slate-50 text-slate-400 ring-slate-200")}>
            <Armchair size={15} />
            <input
              defaultValue={r.name}
              aria-label="Chair name"
              className="w-24 bg-transparent text-sm font-semibold outline-none"
              onBlur={(e) => e.target.value !== r.name && run(() => updateRoom(r.id, { name: e.target.value }))}
            />
            <button type="button" className="text-xs font-semibold text-slate-500 hover:text-ink" disabled={pending} onClick={() => run(() => updateRoom(r.id, { active: !r.active }))}>
              {r.active ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addRoom(locationId, name || `Chair ${rooms.length + 1}`), (r) => r.ok && setName(""));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Chair ${rooms.length + 1}`} className="max-w-48" />
        <Button type="submit" variant="secondary" disabled={pending}>
          <Plus size={15} /> Add chair
        </Button>
      </form>
    </div>
  );
}
