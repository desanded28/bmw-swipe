"use client";

import { CircleCheck, CircleX, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cx } from "../ui";

type Toast = { id: number; tone: "success" | "error"; text: string; action?: { label: string; onClick: () => void } };
type ToastApi = { show: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++counter;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.action ? 9000 : 5000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              "animate-slide-in pointer-events-auto flex items-start gap-3 rounded-xl bg-white p-3.5 text-sm shadow-pop ring-1",
              t.tone === "error" ? "ring-red-200" : "ring-emerald-200",
            )}
          >
            {t.tone === "error" ? (
              <CircleX size={18} className="mt-0.5 shrink-0 text-red-600" />
            ) : (
              <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            )}
            <div className="flex-1">
              <p className="font-medium text-slate-800">{t.text}</p>
              {t.action ? (
                <button
                  type="button"
                  className="mt-1.5 font-semibold text-brand-700 hover:underline"
                  onClick={() => {
                    dismiss(t.id);
                    t.action!.onClick();
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
