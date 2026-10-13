"use client";

import { Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { newApiKey, revokeApiKey } from "@/app/dashboard/actions";
import { Button, Input } from "../ui";
import { useRunAction } from "./AppointmentDrawer";

export function ApiKeys({ keys }: { keys: { id: string; name: string; prefix: string; lastUsed: string | null; revoked: boolean }[] }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {keys.length === 0 ? <li className="p-3 text-sm text-slate-500">No API keys yet.</li> : null}
        {keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 p-3 text-sm">
            <KeyRound size={15} className="text-slate-400" />
            <div className="flex-1">
              <p className="font-semibold">{k.name}</p>
              <p className="text-xs text-slate-500">
                <code>{k.prefix}…</code> · {k.revoked ? "revoked" : k.lastUsed ? `last used ${k.lastUsed}` : "never used"}
              </p>
            </div>
            {!k.revoked ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm("Revoke this key? Integrations using it will stop working.") && run(() => revokeApiKey(k.id))}>
                Revoke
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {secret ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          <p className="font-semibold text-amber-900">Copy your new key now — it won&apos;t be shown again.</p>
          <div className="mt-2 flex gap-2">
            <code className="flex-1 break-all rounded bg-white p-2 text-xs">{secret}</code>
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(secret)}>
              <Copy size={14} />
            </Button>
          </div>
        </div>
      ) : null}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => newApiKey(name),
            (r) => {
              if (r.ok) {
                setSecret((r.data as { secret: string }).secret);
                setName("");
              }
            },
          );
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Practice software sync" className="max-w-xs" />
        <Button type="submit" variant="secondary" disabled={pending}>
          Create key
        </Button>
      </form>
    </div>
  );
}
