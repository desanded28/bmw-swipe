"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { simulateReply } from "@/app/dashboard/actions";
import { Button, Field, Input, Select } from "../ui";
import { useRunAction } from "./AppointmentDrawer";

export function ReplySimulator({ patients }: { patients: { phone: string; label: string }[] }) {
  const { run, pending } = useRunAction();
  const [phone, setPhone] = useState(patients[0]?.phone ?? "");
  const [body, setBody] = useState("SI");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => simulateReply(phone, body, channel));
      }}
    >
      <Field label="Patient with an upcoming visit">
        <Select value={phone} onChange={(e) => setPhone(e.target.value)}>
          {patients.map((p) => (
            <option key={p.phone} value={p.phone}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Field label="Their reply">
          <Input value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Via">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as "sms" | "whatsapp")}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["SI", "NO", "👍", "Posso spostarlo?", "Arrivo 10 minuti in ritardo"].map((t) => (
          <button key={t} type="button" onClick={() => setBody(t)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold hover:bg-slate-200">
            {t}
          </button>
        ))}
      </div>
      <Button type="submit" disabled={pending || !phone}>
        <Send size={15} /> Simulate reply
      </Button>
    </form>
  );
}
