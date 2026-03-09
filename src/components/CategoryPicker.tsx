"use client";

import { useState } from "react";
import CarImage from "./CarImage";

const OPTION_DESC: Record<string, string> = {
  Sedan: "Classic 4-door car",
  SUV: "Tall, spacious, off-road ready",
  Coupe: "Sporty 2-door, low & fast",
  Convertible: "Open-top, roof comes off",
  Wagon: "Sedan with extra cargo space",
  Hatchback: "Compact with a rear hatch",
  Supercar: "Top-tier speed & engineering",
  "Race Car": "Built for the track",
  Petrol: "Standard gasoline engine",
  Diesel: "More torque, better fuel economy",
  Electric: "Fully battery-powered",
  Hybrid: "Electric + gasoline combined",
  RWD: "Rear-Wheel Drive — sporty feel",
  AWD: "All-Wheel Drive — grips any road",
  FWD: "Front-Wheel Drive — fuel efficient",
  "2": "Two doors — sportier",
  "4": "Four doors — practical",
  "5": "Five doors — hatchback style",
};

const BODY_STYLE_MODELS: Record<string, string> = {
  Sedan: "5 Series",
  SUV: "X5",
  Coupe: "4 Series",
  Convertible: "Z4",
  Wagon: "3 Series (E46)",
  Hatchback: "1 Series",
  Supercar: "M1 (car)",
  "Race Car": "V12 LMR",
};

interface CategoryPickerProps {
  label: string;
  options: string[];
  attribute?: string;
  showImages?: boolean;
  onConfirm: (selected: string[]) => void;
}

export default function CategoryPicker({
  label,
  options,
  attribute,
  showImages = false,
  onConfirm,
}: CategoryPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const isBodyStyle = attribute === "body";

  const toggle = (option: string) => {
    setSelected((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    );
  };

  return (
    <div className="animate-card-enter flex w-full max-w-sm flex-col items-center gap-6">
      <p className="text-sm font-medium text-gray-400">{label}</p>

      <div className="grid w-full grid-cols-2 gap-3">
        {options.map((option) => {
          const isActive = selected.includes(option);
          const desc = OPTION_DESC[option];
          const showPhoto = showImages || isBodyStyle;
          const modelName = showImages ? option : BODY_STYLE_MODELS[option];

          return (
            <button
              key={option}
              onClick={() => toggle(option)}
              className={`overflow-hidden rounded-xl border text-left transition-colors ${
                isActive
                  ? "border-[#1a7fd4]/40 bg-[#1a7fd4]/15 text-white"
                  : "border-white/[0.08] bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
              } ${showPhoto ? "flex flex-col" : ""}`}
            >
              {showPhoto && modelName ? (
                <div className="relative">
                  <div className="h-24 w-full">
                    <CarImage modelName={modelName} className="rounded-none" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
                    <div className="text-sm font-medium text-white">{option}</div>
                    {desc && (
                      <div className="text-[11px] text-gray-300 leading-snug">{desc}</div>
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a7fd4]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
              ) : desc ? (
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{option}</div>
                    <div className="mt-0.5 text-xs text-gray-500 leading-snug">{desc}</div>
                  </div>
                  {isActive && (
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a7fd4]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-4">
                  <span className="text-sm font-medium">{option}</span>
                  {isActive && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a7fd4]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onConfirm(selected)}
        disabled={selected.length === 0}
        className="w-full rounded-xl bg-[#1a7fd4] py-3 text-sm font-medium text-white shadow-md hover:bg-[#1570bd] disabled:opacity-40 disabled:hover:bg-[#1a7fd4]"
      >
        Confirm ({selected.length})
      </button>
    </div>
  );
}
