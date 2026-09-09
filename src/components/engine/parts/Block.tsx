"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial, DoubleSide } from "three";
import { Part } from "../Part";
import { Mat } from "../materials";
import { BANKS, CYLINDERS, ENGINE, combustionIntensity, type BankId } from "@/lib/engine/config";
import { engineClock, useEngineStore } from "@/lib/engine/store";

const D = ENGINE.deckHeight;
const LINER_H = 168;

function CombustionFlash({ cylNumber, z }: { cylNumber: number; z: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const show = useEngineStore.getState().showGlow;
    const k = show ? combustionIntensity(engineClock.theta, cylNumber) : 0;
    m.visible = k > 0.01;
    const mat = m.material as MeshStandardMaterial;
    mat.opacity = 0.25 + 0.7 * k;
    mat.emissiveIntensity = 1.5 + 4 * k;
    m.scale.y = 0.5 + 1.2 * k;
  });
  return (
    <mesh ref={ref} position={[0, D - 4, z]} visible={false}>
      <cylinderGeometry args={[ENGINE.bore / 2 - 1, ENGINE.bore / 2 - 1, 14, 32]} />
      <meshStandardMaterial
        color="#ffb347"
        emissive="#ff6a00"
        emissiveIntensity={2}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </mesh>
  );
}

function BankBlock({ bankId }: { bankId: BankId }) {
  const bank = BANKS[bankId];
  const cyls = CYLINDERS.filter((c) => c.bank.id === bankId);
  return (
    <group rotation={[0, 0, bank.rotationZ]}>
      {/* bank casting */}
      <mesh position={[0, (D + 70) / 2, 0]}>
        <boxGeometry args={[160, D - 70, 440]} />
        <Mat kind="alloy" xrayable />
      </mesh>
      {/* cylinder liners (visible in X-ray) */}
      {cyls.map((c) => (
        <group key={c.number}>
          <mesh position={[0, D - LINER_H / 2, c.z]}>
            <cylinderGeometry args={[ENGINE.bore / 2 + 0.6, ENGINE.bore / 2 + 0.6, LINER_H, 48, 1, true]} />
            <Mat kind="liner" side={DoubleSide} />
          </mesh>
          <CombustionFlash cylNumber={c.number} z={c.z} />
        </group>
      ))}
    </group>
  );
}

export function Block() {
  return (
    <Part id="block">
      {/* crankcase */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[390, 150, 440]} />
        <Mat kind="alloy" xrayable />
      </mesh>
      {/* main bearing bulkheads (visible in X-ray) */}
      {[-196, -98, 0, 98, 196].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[150, 130, 22]} />
          <Mat kind="darkAlloy" xrayable />
        </mesh>
      ))}
      {/* valley floor between the banks */}
      <mesh position={[0, 175, 0]}>
        <boxGeometry args={[150, 26, 400]} />
        <Mat kind="alloy" xrayable />
      </mesh>
      {/* front timing cover and rear plate */}
      <mesh position={[0, 60, 231]}>
        <boxGeometry args={[400, 260, 18]} />
        <Mat kind="alloy" xrayable />
      </mesh>
      <mesh position={[0, 30, -226]}>
        <boxGeometry args={[400, 200, 8]} />
        <Mat kind="darkAlloy" xrayable />
      </mesh>
      <BankBlock bankId="A" />
      <BankBlock bankId="B" />
    </Part>
  );
}

export function OilPan() {
  return (
    <Part id="oilpan" explode={[0, -200, 0]}>
      <mesh position={[0, -105, 0]}>
        <boxGeometry args={[370, 70, 430]} />
        <Mat kind="darkAlloy" xrayable />
      </mesh>
      {/* deep sump at the rear */}
      <mesh position={[0, -175, -100]}>
        <boxGeometry args={[300, 72, 210]} />
        <Mat kind="darkAlloy" xrayable />
      </mesh>
      {/* drain plug */}
      <mesh position={[110, -205, -100]}>
        <cylinderGeometry args={[9, 9, 12, 6]} />
        <Mat kind="steel" />
      </mesh>
    </Part>
  );
}
