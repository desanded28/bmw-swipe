import { create } from "zustand";

export type PartId =
  | "crankshaft"
  | "piston"
  | "conrod"
  | "block"
  | "oilpan"
  | "head"
  | "valvetrain"
  | "camshaft"
  | "valvecover"
  | "ignition"
  | "intake"
  | "exhaust"
  | "flywheel"
  | "balancer";

export const PART_IDS: PartId[] = [
  "crankshaft",
  "piston",
  "conrod",
  "block",
  "oilpan",
  "head",
  "valvetrain",
  "camshaft",
  "valvecover",
  "ignition",
  "intake",
  "exhaust",
  "flywheel",
  "balancer",
];

/**
 * Mutable, frame-rate driven clock shared between the render loop and the
 * parts. Kept outside React state so the 60 Hz updates don't re-render.
 * `theta` is the crank angle in degrees over the full 720° four-stroke cycle.
 */
export const engineClock = { theta: 0 };

export interface ViewPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export const VIEWS: Record<string, ViewPreset> = {
  iso: { position: [10.5, 6.5, 12.5], target: [0, 0.3, 0] },
  front: { position: [0, 2.5, 17], target: [0, 0.3, 0] },
  side: { position: [17, 3, 0], target: [0, 0.3, 0] },
  top: { position: [0.01, 18, 0.01], target: [0, 0.3, 0] },
  rear: { position: [0, 2.5, -17], target: [0, 0.3, 0] },
  underside: { position: [7, -10, 10], target: [0, -0.5, 0] },
};

interface EngineState {
  rpm: number;
  playing: boolean;
  /** 1 = real time; the engine is far too fast to follow at 1:1, so default to slow motion */
  timeScale: number;
  explode: number;
  xray: boolean;
  autoRotate: boolean;
  showGlow: boolean;
  visible: Record<PartId, boolean>;
  hovered: PartId | null;
  selected: PartId | null;
  /** throttled copy of engineClock.theta for the HUD */
  hudTheta: number;
  viewRequest: { view: ViewPreset; nonce: number } | null;

  setRpm: (rpm: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setTimeScale: (v: number) => void;
  setExplode: (v: number) => void;
  setXray: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  setShowGlow: (v: boolean) => void;
  setVisible: (id: PartId, v: boolean) => void;
  showAll: () => void;
  setHovered: (id: PartId | null) => void;
  setSelected: (id: PartId | null) => void;
  setHudTheta: (t: number) => void;
  setTheta: (t: number) => void;
  requestView: (view: ViewPreset) => void;
  applyPreset: (preset: "assembled" | "internals" | "xray" | "exploded") => void;
}

const allVisible = (): Record<PartId, boolean> =>
  Object.fromEntries(PART_IDS.map((id) => [id, true])) as Record<PartId, boolean>;

export const useEngineStore = create<EngineState>((set, get) => ({
  rpm: 1200,
  playing: true,
  timeScale: 0.02,
  explode: 0,
  xray: false,
  autoRotate: false,
  showGlow: true,
  visible: allVisible(),
  hovered: null,
  selected: null,
  hudTheta: 0,
  viewRequest: null,

  setRpm: (rpm) => set({ rpm }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set({ playing: !get().playing }),
  setTimeScale: (timeScale) => set({ timeScale }),
  setExplode: (explode) => set({ explode }),
  setXray: (xray) => set({ xray }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setShowGlow: (showGlow) => set({ showGlow }),
  setVisible: (id, v) => set({ visible: { ...get().visible, [id]: v } }),
  showAll: () => set({ visible: allVisible() }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setHudTheta: (hudTheta) => set({ hudTheta }),
  setTheta: (t) => {
    engineClock.theta = ((t % 720) + 720) % 720;
    set({ hudTheta: engineClock.theta });
  },
  requestView: (view) =>
    set({ viewRequest: { view, nonce: (get().viewRequest?.nonce ?? 0) + 1 } }),
  applyPreset: (preset) => {
    switch (preset) {
      case "assembled":
        set({ visible: allVisible(), xray: false, explode: 0 });
        break;
      case "internals":
        set({
          visible: {
            ...allVisible(),
            block: false,
            oilpan: false,
            head: false,
            valvecover: false,
            intake: false,
            exhaust: false,
          },
          xray: false,
          explode: 0,
        });
        break;
      case "xray":
        set({ visible: allVisible(), xray: true, explode: 0 });
        break;
      case "exploded":
        set({ visible: allVisible(), xray: false, explode: 1 });
        break;
    }
  },
}));
