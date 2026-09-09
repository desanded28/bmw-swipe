"use client";

import { useEngineStore } from "@/lib/engine/store";

export type MaterialKind =
  | "alloy"
  | "darkAlloy"
  | "steel"
  | "crankSteel"
  | "piston"
  | "liner"
  | "blackPlastic"
  | "exhaust"
  | "rubber"
  | "ceramic"
  | "copper";

const PRESETS: Record<MaterialKind, { color: string; metalness: number; roughness: number }> = {
  alloy: { color: "#c3c7ce", metalness: 0.85, roughness: 0.42 },
  darkAlloy: { color: "#8f949c", metalness: 0.85, roughness: 0.5 },
  steel: { color: "#aeb3ba", metalness: 0.95, roughness: 0.32 },
  crankSteel: { color: "#7d8188", metalness: 0.9, roughness: 0.45 },
  piston: { color: "#d9dce1", metalness: 0.9, roughness: 0.25 },
  liner: { color: "#4b4f56", metalness: 0.9, roughness: 0.35 },
  blackPlastic: { color: "#1d2028", metalness: 0.15, roughness: 0.7 },
  exhaust: { color: "#605a55", metalness: 0.65, roughness: 0.68 },
  rubber: { color: "#15161a", metalness: 0.05, roughness: 0.9 },
  ceramic: { color: "#ececec", metalness: 0.0, roughness: 0.6 },
  copper: { color: "#b87333", metalness: 0.9, roughness: 0.35 },
};

interface MatProps {
  kind: MaterialKind;
  /** when true the material becomes translucent in X-ray mode */
  xrayable?: boolean;
  color?: string;
  side?: 0 | 1 | 2;
}

/**
 * A standard PBR material with an optional X-ray (ghosted) mode.  The
 * material is re-created when the mode changes so three.js picks up the
 * new transparency settings cleanly.
 */
export function Mat({ kind, xrayable = false, color, side }: MatProps) {
  const xray = useEngineStore((s) => s.xray);
  const ghost = xrayable && xray;
  const p = PRESETS[kind];
  return (
    <meshStandardMaterial
      key={ghost ? "ghost" : "solid"}
      color={color ?? p.color}
      metalness={ghost ? 0.2 : p.metalness}
      roughness={ghost ? 0.6 : p.roughness}
      transparent={ghost}
      opacity={ghost ? 0.13 : 1}
      depthWrite={!ghost}
      side={side}
    />
  );
}
