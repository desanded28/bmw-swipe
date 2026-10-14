"use client";

import { segmentsOf, type TextSpan } from "@/lib/health-terms";

type Marked = { span: TextSpan; severity: string };

/**
 * A text with its findings marked (health-term flagger, advertising check): red for what blocks
 * or holds, amber for warnings. Plain text only: nothing is parsed as markup.
 */
export function Highlighted({ text, findings }: { text: string; findings: readonly Marked[] }) {
  return (
    <>
      {segmentsOf(text, findings).map((s, i) =>
        s.finding ? (
          <mark
            key={i}
            className={
              s.finding.severity === "warn" ? "rounded bg-amber-100 px-0.5 text-amber-950" : "rounded bg-red-100 px-0.5 font-semibold text-red-900"
            }
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** A boxed copy of the text with the findings marked, under the field it checks. */
export function FindingsPreview({ text, findings, id }: { text: string; findings: readonly Marked[]; id?: string }) {
  if (!findings.length) return null;
  return (
    <p id={id} className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
      <Highlighted text={text} findings={findings} />
    </p>
  );
}
