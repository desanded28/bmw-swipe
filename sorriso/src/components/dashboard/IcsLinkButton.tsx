"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { rotateIcsToken } from "@/app/dashboard/actions/ics";
import { Button } from "../ui";
import { useRunAction } from "./useRunAction";

/** Generates a personal calendar-feed URL and shows it once (only its hash is stored). */
export function IcsLinkButton({ practitionerId, hasLink }: { practitionerId: string; hasLink: boolean }) {
  const { run, pending } = useRunAction();
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {url ? (
        <div className="flex gap-2">
          <code className="block flex-1 break-all rounded-lg bg-slate-100 p-3 text-xs">{url}</code>
          <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(url)} aria-label="Copy">
            <Copy size={14} />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{hasLink ? "A feed link exists. Generate a new one to see it again (the old one stops working)." : "No feed link yet."}</p>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (hasLink && !window.confirm("Generate a new link? The current one will stop working.")) return;
          run(
            () => rotateIcsToken(practitionerId),
            (r) => r.ok && setUrl((r.data as { url: string }).url),
          );
        }}
      >
        {hasLink ? "Generate new link" : "Generate link"}
      </Button>
    </div>
  );
}
