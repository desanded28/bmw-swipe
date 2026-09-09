"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Grid, Lightformer, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { engineClock, useEngineStore, VIEWS } from "@/lib/engine/store";
import { Crankshaft } from "./parts/Crankshaft";
import { RotatingAssembly } from "./parts/RotatingAssembly";
import { Block, OilPan } from "./parts/Block";
import { Heads } from "./parts/Head";
import { ExhaustManifolds, IntakeManifold } from "./parts/Manifolds";

/** Advances the crank angle and publishes a throttled copy for the HUD. */
function Driver() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const { playing, rpm, timeScale, setHudTheta, hudTheta } = useEngineStore.getState();
    const step = Math.min(dt, 0.1);
    if (playing) {
      // rpm → degrees per second = rpm * 360 / 60
      engineClock.theta = (engineClock.theta + rpm * 6 * timeScale * step) % 720;
    }
    acc.current += step;
    if (acc.current > 0.06 && Math.abs(hudTheta - engineClock.theta) > 0.01) {
      acc.current = 0;
      setHudTheta(engineClock.theta);
    }
  });
  return null;
}

/** Flies the camera to a requested preset view. */
function CameraRig() {
  const viewRequest = useEngineStore((s) => s.viewRequest);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ pos: Vector3; target: Vector3; t: number } | null>(null);

  useEffect(() => {
    if (!viewRequest) return;
    goal.current = {
      pos: new Vector3(...viewRequest.view.position),
      target: new Vector3(...viewRequest.view.target),
      t: 0,
    };
  }, [viewRequest]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    g.t += dt;
    const k = 1 - Math.pow(0.001, dt);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.01 || g.t > 2.5) goal.current = null;
  });
  return null;
}

function Controls() {
  const autoRotate = useEngineStore((s) => s.autoRotate);
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      minDistance={2.5}
      maxDistance={45}
      target={VIEWS.iso.target}
    />
  );
}

export function EngineScene() {
  const setSelected = useEngineStore((s) => s.setSelected);
  return (
    <Canvas
      camera={{ position: VIEWS.iso.position, fov: 38, near: 0.05, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => setSelected(null)}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0f1118"]} />
      <fog attach="fog" args={["#0f1118", 30, 80]} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 10, 8]} intensity={1.6} />
      <directionalLight position={[-8, 4, -6]} intensity={0.5} color="#cfe0ff" />

      {/* studio-style environment built from light panels, no external assets */}
      <Environment resolution={256}>
        <Lightformer intensity={3} position={[0, 8, 0]} scale={[12, 12, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={2} position={[-10, 3, 4]} scale={[4, 8, 1]} rotation-y={Math.PI / 2} />
        <Lightformer intensity={1.5} position={[10, 2, -4]} scale={[4, 8, 1]} rotation-y={-Math.PI / 2} color="#dbe7ff" />
        <Lightformer intensity={0.6} position={[0, -6, 0]} scale={[12, 12, 1]} rotation-x={-Math.PI / 2} color="#8fb4ff" />
      </Environment>

      {/* the engine is modelled in millimetres; 1 scene unit = 100 mm */}
      <group scale={0.01} position={[0, -1.15, 0]}>
        <Crankshaft />
        <RotatingAssembly />
        <Block />
        <OilPan />
        <Heads />
        <IntakeManifold />
        <ExhaustManifolds />
      </group>

      <Grid
        position={[0, -3.45, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#262a36"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#1a7fd4"
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />

      <Driver />
      <CameraRig />
      <Controls />
    </Canvas>
  );
}
