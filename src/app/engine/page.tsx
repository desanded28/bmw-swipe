import type { Metadata } from "next";
import EngineViewer from "@/components/engine/EngineViewer";

export const metadata: Metadata = {
  title: "Interactive V8 Engine",
  description:
    "An interactive 3D cross-plane V8 with real slider-crank kinematics: orbit, explode, X-ray, and follow the four-stroke cycle cylinder by cylinder.",
};

export default function EnginePage() {
  return <EngineViewer />;
}
