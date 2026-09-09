"use client";

import dynamic from "next/dynamic";
import { ControlPanel, CycleBar, Header, InfoPanel, useHotkeys, useMobilePanel } from "./Hud";

const EngineScene = dynamic(() => import("./EngineScene").then((m) => m.EngineScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
      Building engine…
    </div>
  ),
});

export default function EngineViewer() {
  useHotkeys();
  const [mobilePanel, setMobilePanel] = useMobilePanel();

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0f1118]">
      <div className="absolute inset-0">
        <EngineScene />
      </div>

      {/* overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <Header />
          <div className="pointer-events-auto flex gap-1.5 md:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel(mobilePanel === "controls" ? null : "controls")}
              className={`rounded-lg border border-white/[0.08] bg-[#0f1118]/80 px-2.5 py-1.5 text-xs backdrop-blur-md ${mobilePanel === "controls" ? "text-white" : "text-gray-300"}`}
            >
              Controls
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel(mobilePanel === "info" ? null : "info")}
              className={`rounded-lg border border-white/[0.08] bg-[#0f1118]/80 px-2.5 py-1.5 text-xs backdrop-blur-md ${mobilePanel === "info" ? "text-white" : "text-gray-300"}`}
            >
              Info
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-start justify-between gap-3 py-3">
          <div
            className={`max-h-full overflow-y-auto ${mobilePanel === "controls" ? "block" : "hidden"} md:block`}
          >
            <ControlPanel />
          </div>
          <div
            className={`max-h-full overflow-y-auto ${mobilePanel === "info" ? "block" : "hidden"} md:block`}
          >
            <InfoPanel />
          </div>
        </div>

        <CycleBar />
      </div>
    </div>
  );
}
