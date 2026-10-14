"use client";

import { useState } from "react";
import { checkAdvertising } from "@/lib/compliance/advertising";
import { Input, Textarea } from "../ui";
import { FindingsPreview } from "./Highlighted";

/**
 * A text field for something the practice publishes (a fund note, directions to an office) with
 * the health-advertising check (Law 145/2018) run while typing: matches are highlighted under the
 * field, red for wording the save will refuse, amber for a warning. The save action runs the same
 * check on the server. Takes the props Field hands its control (id, aria-describedby).
 */
export function AdCheckedText({
  multiline = false,
  defaultValue,
  rows,
  ...props
}: {
  name: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  maxLength?: number;
  rows?: number;
  defaultValue?: string | null;
  multiline?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const findings = checkAdvertising(value);
  const previewId = props.id ? `${props.id}-ads` : undefined;
  const describedBy = [props["aria-describedby"], findings.length ? previewId : null].filter(Boolean).join(" ") || undefined;
  const common = { ...props, value, "aria-describedby": describedBy, "aria-invalid": findings.some((f) => f.severity === "block") ? (true as const) : props["aria-invalid"] };
  return (
    <>
      {multiline ? <Textarea {...common} rows={rows} onChange={(e) => setValue(e.target.value)} /> : <Input {...common} onChange={(e) => setValue(e.target.value)} />}
      <FindingsPreview id={previewId} text={value} findings={findings} />
    </>
  );
}
