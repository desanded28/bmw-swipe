"use client";

import { BadgeCheck, Undo2 } from "lucide-react";
import { revokeAlbo, verifyAlbo } from "@/app/dashboard/actions/platform";
import { useT } from "@/i18n/provider";
import { useRunAction } from "../dashboard/useRunAction";
import { Button } from "../ui";

/** Confirm (or withdraw) a practitioner's Albo registration after checking the public register. */
export function AlboActions({ practitionerId, verified }: { practitionerId: string; verified: boolean }) {
  const t = useT("marketplace");
  const { run, pending } = useRunAction();
  return verified ? (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => revokeAlbo(practitionerId))}>
      <Undo2 size={14} aria-hidden /> {t("platform.alboQueue.revoke")}
    </Button>
  ) : (
    <Button size="sm" disabled={pending} onClick={() => run(() => verifyAlbo(practitionerId))}>
      <BadgeCheck size={14} aria-hidden /> {t("platform.alboQueue.verify")}
    </Button>
  );
}
