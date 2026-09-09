"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CYLINDERS,
  ENGINE,
  FIRING_ORDER,
  FIRE_ANGLE,
  STROKE_COLORS,
  cyclePhase,
  meanPistonSpeed,
  strokeAt,
  type Stroke,
} from "@/lib/engine/config";
import { PART_IDS, useEngineStore, VIEWS, type PartId } from "@/lib/engine/store";
import { PART_INFO } from "@/lib/engine/partInfo";

const panel =
  "pointer-events-auto rounded-xl border border-white/[0.08] bg-[#0f1118]/85 backdrop-blur-md shadow-lg";
const label = "text-[11px] uppercase tracking-wider text-gray-500";
const btn =
  "rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/[0.08] active:bg-white/[0.12]";
const btnActive = "border-[#1a7fd4]/60 bg-[#1a7fd4]/20 text-white";

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#1a7fd4]"
    />
  );
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-gray-300">
      <span>{children}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-[#1a7fd4]" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${on ? "left-0.5 translate-x-3" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

export function ControlPanel() {
  const s = useEngineStore();
  const rpmLabel = s.rpm < 1000 ? `${s.rpm}` : `${(s.rpm / 1000).toFixed(1)}k`;

  return (
    <div className={`${panel} flex w-72 flex-col gap-3 p-3.5`}>
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className={label}>Playback</span>
          <button
            type="button"
            onClick={s.togglePlaying}
            className={`${btn} min-w-16`}
          >
            {s.playing ? "❚❚ Pause" : "▶ Play"}
          </button>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>Engine speed</span>
            <span className="tabular-nums text-white">{rpmLabel} rpm</span>
          </div>
          <Slider value={s.rpm} min={600} max={7200} step={50} onChange={s.setRpm} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>Slow motion</span>
            <span className="tabular-nums text-white">1 / {Math.round(1 / s.timeScale)}</span>
          </div>
          <Slider
            value={Math.log10(s.timeScale)}
            min={-3}
            max={0}
            step={0.01}
            onChange={(v) => s.setTimeScale(Math.pow(10, v))}
          />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>Crank angle</span>
            <span className="tabular-nums text-white">{s.hudTheta.toFixed(0)}° / 720°</span>
          </div>
          <Slider
            value={s.hudTheta}
            min={0}
            max={719}
            step={1}
            onChange={(v) => {
              s.setPlaying(false);
              s.setTheta(v);
            }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <span className={label}>View</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={btn} onClick={() => s.applyPreset("assembled")}>Assembled</button>
          <button type="button" className={btn} onClick={() => s.applyPreset("internals")}>Internals</button>
          <button type="button" className={`${btn} ${s.xray ? btnActive : ""}`} onClick={() => s.applyPreset("xray")}>X-ray</button>
          <button type="button" className={btn} onClick={() => s.applyPreset("exploded")}>Exploded</button>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>Explode</span>
            <span className="tabular-nums text-white">{Math.round(s.explode * 100)}%</span>
          </div>
          <Slider value={s.explode} min={0} max={1} step={0.01} onChange={s.setExplode} />
        </div>
        <Toggle on={s.xray} onChange={s.setXray}>X-ray castings</Toggle>
        <Toggle on={s.showGlow} onChange={s.setShowGlow}>Combustion flash</Toggle>
        <Toggle on={s.autoRotate} onChange={s.setAutoRotate}>Auto-rotate</Toggle>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(VIEWS).map(([name, view]) => (
            <button key={name} type="button" className={btn} onClick={() => s.requestView(view)}>
              {name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={label}>Parts</span>
          <button type="button" className="text-xs text-[#1a7fd4] hover:underline" onClick={s.showAll}>
            Show all
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {PART_IDS.map((id) => (
            <label key={id} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-300">
              <input
                type="checkbox"
                checked={s.visible[id]}
                onChange={(e) => s.setVisible(id, e.target.checked)}
                className="accent-[#1a7fd4]"
              />
              <span className="truncate">{PART_INFO[id].name}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

export function InfoPanel() {
  const selected = useEngineStore((s) => s.selected);
  const hovered = useEngineStore((s) => s.hovered);
  const setSelected = useEngineStore((s) => s.setSelected);
  const id: PartId | null = selected ?? hovered;

  if (!id) {
    return (
      <div className={`${panel} w-72 p-4`}>
        <span className={label}>Engine</span>
        <h2 className="mt-1 text-base font-semibold text-white">4.4 L 90° V8</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Naturally aspirated DOHC 32-valve V8 with a cross-plane crankshaft.
          Bore and stroke follow BMW&apos;s 4.4 L V8 family; the intake sits in the
          valley and the exhaust runs outboard in the conventional layout.
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <Spec k="Displacement" v={`${ENGINE.displacementLitres.toFixed(2)} L`} />
          <Spec k="Bore × stroke" v={`${ENGINE.bore} × ${ENGINE.stroke} mm`} />
          <Spec k="Bank angle" v={`${ENGINE.bankAngle}°`} />
          <Spec k="Rod length" v={`${ENGINE.rodLength} mm`} />
          <Spec k="Firing order" v={FIRING_ORDER.join("-")} />
          <Spec k="Valves" v="32, DOHC" />
        </dl>
        <p className="mt-3 text-[11px] text-gray-500">
          Drag to orbit · scroll to zoom · click a part for details
        </p>
      </div>
    );
  }

  const info = PART_INFO[id];
  return (
    <div className={`${panel} w-72 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={label}>{selected ? "Selected" : "Hovering"}</span>
          <h2 className="mt-0.5 text-base font-semibold text-white">{info.name}</h2>
          <p className="text-xs text-[#1a7fd4]">{info.short}</p>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-md px-1.5 text-gray-500 hover:bg-white/10 hover:text-white"
            aria-label="Deselect"
          >
            ✕
          </button>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-300">{info.description}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {info.specs.map(([k, v]) => (
          <Spec key={k} k={k} v={v} />
        ))}
      </dl>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-200">{v}</dd>
    </>
  );
}

const STROKE_LABEL: Record<Stroke, string> = {
  intake: "Intake",
  compression: "Compress",
  power: "Power",
  exhaust: "Exhaust",
};

export function CycleBar() {
  const theta = useEngineStore((s) => s.hudTheta);
  const rpm = useEngineStore((s) => s.rpm);
  // the cylinder whose power stroke started most recently
  const firingIndex = Math.floor(((theta % 720) + 720) % 720 / 90) % 8;
  const byNumber = [...CYLINDERS].sort((a, b) => a.number - b.number);

  return (
    <div className={`${panel} flex flex-col gap-2 px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-400">
        <span>
          Crank <span className="tabular-nums text-white">{theta.toFixed(0)}°</span>
        </span>
        <span>
          Cam <span className="tabular-nums text-white">{(theta / 2).toFixed(0)}°</span>
        </span>
        <span>
          Mean piston speed{" "}
          <span className="tabular-nums text-white">{meanPistonSpeed(rpm).toFixed(1)} m/s</span>
        </span>
        <span className="flex items-center gap-1">
          Firing order
          <span className="ml-1 flex gap-0.5 font-mono">
            {FIRING_ORDER.map((c, i) => (
              <span
                key={c}
                className={`rounded px-1 tabular-nums ${
                  i === firingIndex ? "bg-[#f97316] text-black" : "text-gray-300"
                }`}
              >
                {c}
              </span>
            ))}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {byNumber.map((c) => {
          const stroke = strokeAt(theta, c.number);
          const phase = cyclePhase(theta, c.number);
          const within = (phase % 180) / 180;
          return (
            <div
              key={c.number}
              className="relative overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5"
              title={`Cylinder ${c.number}: ${stroke}, fires at ${FIRE_ANGLE[c.number]}°`}
            >
              <div
                className="absolute inset-y-0 left-0 opacity-25"
                style={{ width: `${within * 100}%`, background: STROKE_COLORS[stroke] }}
              />
              <div className="relative flex items-baseline justify-between">
                <span className="text-xs font-semibold text-white">#{c.number}</span>
                <span className="text-[10px] text-gray-500">{c.bank.id}</span>
              </div>
              <div className="relative text-[11px]" style={{ color: STROKE_COLORS[stroke] }}>
                {STROKE_LABEL[stroke]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Header() {
  return (
    <div className="pointer-events-auto flex items-center gap-3">
      <Link
        href="/"
        className="rounded-lg border border-white/[0.08] bg-[#0f1118]/80 px-2.5 py-1.5 text-xs text-gray-300 backdrop-blur-md hover:bg-white/[0.08]"
      >
        ← Car Swipe
      </Link>
      <div className="rounded-lg bg-[#0f1118]/80 px-3 py-1.5 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-white">Interactive V8</h1>
        <p className="text-[11px] text-gray-500">Cross-plane 90° V8 · real slider-crank kinematics</p>
      </div>
    </div>
  );
}

/** Space toggles playback; arrow keys step the crank when paused. */
export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const s = useEngineStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        s.togglePlaying();
      } else if (e.code === "ArrowRight") {
        s.setPlaying(false);
        s.setTheta(s.hudTheta + (e.shiftKey ? 45 : 5));
      } else if (e.code === "ArrowLeft") {
        s.setPlaying(false);
        s.setTheta(s.hudTheta - (e.shiftKey ? 45 : 5));
      } else if (e.key === "x") {
        s.setXray(!s.xray);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Small-screen drawer switch; on md+ both panels are always shown. */
export function useMobilePanel() {
  return useState<"controls" | "info" | null>(null);
}
