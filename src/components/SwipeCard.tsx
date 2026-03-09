"use client";

import { useRef, useState, useCallback } from "react";
import CarImage from "@/components/CarImage";

interface SwipeCardProps {
  label: string;
  value: number;
  unit: string;
  sampleModel?: string;
  sampleBrand?: string;
  onSwipe: (direction: "more" | "less") => void;
}

export default function SwipeCard({
  label,
  value,
  unit,
  sampleModel,
  sampleBrand,
  onSwipe,
}: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animClass, setAnimClass] = useState("animate-card-enter");
  const startX = useRef(0);
  const threshold = 80;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (animClass === "swipe-left" || animClass === "swipe-right") return;
      setIsDragging(true);
      startX.current = e.clientX;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [animClass]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setDragX(e.clientX - startX.current);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(dragX) > threshold) {
      const dir = dragX > 0 ? "more" : "less";
      setAnimClass(dir === "more" ? "swipe-right" : "swipe-left");
      setTimeout(() => onSwipe(dir), 300);
    } else {
      setDragX(0);
    }
  }, [isDragging, dragX, onSwipe]);

  const triggerSwipe = (dir: "more" | "less") => {
    setAnimClass(dir === "more" ? "swipe-right" : "swipe-left");
    setTimeout(() => onSwipe(dir), 300);
  };

  const rotation = isDragging ? dragX * 0.06 : 0;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 300);

  const formatValue = (v: number, u: string) => {
    if (u === "cc") return `${v.toLocaleString()} cc`;
    if (u === "hp") return `${v} hp`;
    if (u === "cyl") return `${v} cyl`;
    if (u === "Nm") return `${v} Nm`;
    return `${v}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={cardRef}
        className={`relative w-full max-w-sm cursor-grab select-none overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] ${animClass}`}
        style={{
          transform: isDragging
            ? `translateX(${dragX}px) rotate(${rotation}deg)`
            : undefined,
          opacity: isDragging ? opacity : undefined,
          touchAction: "none",
          transition: isDragging ? "none" : "transform 0.2s, opacity 0.2s",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Direction hints */}
        <div
          className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition-opacity"
          style={{
            opacity:
              isDragging && dragX < -20
                ? Math.min(1, Math.abs(dragX) / threshold)
                : 0,
          }}
        >
          LESS
        </div>
        <div
          className="pointer-events-none absolute right-4 top-4 z-10 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400 transition-opacity"
          style={{
            opacity:
              isDragging && dragX > 20
                ? Math.min(1, dragX / threshold)
                : 0,
          }}
        >
          MORE
        </div>

        {/* Car image */}
        {sampleModel && (
          <div className="h-36 overflow-hidden">
            <CarImage modelName={sampleModel} brand={sampleBrand} dim />
          </div>
        )}

        <div className="flex flex-col items-center gap-2 px-8 pb-8 pt-5">
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="text-5xl font-semibold tracking-tight text-white">
            {formatValue(value, unit)}
          </p>

          <div className="mt-4 flex w-full items-center justify-between text-xs text-gray-500">
            <span>← Less</span>
            <span>More →</span>
          </div>
        </div>
      </div>

      {/* Buttons with icons */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => triggerSwipe("less")}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200"
          aria-label="Less"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-xs text-gray-500">or swipe</span>
        <button
          onClick={() => triggerSwipe("more")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a7fd4] text-white hover:bg-[#1570bd]"
          aria-label="More"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
