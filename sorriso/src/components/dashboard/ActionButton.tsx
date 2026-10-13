"use client";

import { LoaderCircle } from "lucide-react";
import type { ActionResult } from "@/app/dashboard/actions";
import { Button } from "../ui";
import { useRunAction } from "./AppointmentDrawer";

/** A button bound to a server action (with arguments pre-bound on the server). */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  confirm?: string;
}) {
  const { run, pending } = useRunAction();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        run(action);
      }}
    >
      {pending ? <LoaderCircle size={14} className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
