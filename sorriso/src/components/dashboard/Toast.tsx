"use client";

import { CircleCheck, CircleX, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { useT } from "@/i18n/provider";
import { cx } from "../ui";

type Toast = { id: number; tone: "success" | "error"; text: string; action?: { label: string; onClick: () => void } };
type ToastApi = { show: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

let counter = 0;

/**
 * Action feedback, announced through one persistent polite live region (a region added together
 * with its text is often not announced). Texts arrive already translated: the actions answer in
 * the staff member's language.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useT("dashboard");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = ++counter;
      setToasts((list) => [...list.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.action || toast.tone === "error" ? 9000 : 5000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <section
        aria-label={t("toast.region")}
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              "animate-slide-in pointer-events-auto flex items-start gap-3 rounded-xl bg-white p-3.5 text-sm shadow-pop ring-1",
              toast.tone === "error" ? "ring-red-200" : "ring-emerald-200",
            )}
          >
            {toast.tone === "error" ? (
              <CircleX size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
            ) : (
              <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
            )}
            <div className="flex-1">
              <p className="font-medium text-slate-800">{toast.text}</p>
              {toast.action ? (
                <button
                  type="button"
                  className="mt-1.5 font-semibold text-brand-700 hover:underline"
                  onClick={() => {
                    dismiss(toast.id);
                    toast.action!.onClick();
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-800" aria-label={t("toast.dismiss")}>
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  );
}
