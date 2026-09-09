"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { Part } from "../Part";
import { Mat } from "../materials";
import {
  BANKS,
  ENGINE,
  sliderCrank,
  type BankId,
  type CylinderRef,
  CYLINDERS,
} from "@/lib/engine/config";
import { engineClock } from "@/lib/engine/store";

const PISTON_R = ENGINE.bore / 2 - 0.4;
const PISTON_TOP = ENGINE.compressionHeight;
const PISTON_BOTTOM = -26;
const ROD_L = ENGINE.rodLength;
const EXPLODE_DIST = 75;

/** One piston, drawn in the bank frame (local +Y = cylinder axis). */
function Piston({ cyl }: { cyl: CylinderRef }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const { s } = sliderCrank(engineClock.theta, cyl);
    ref.current.position.y = s;
  });
  const bodyH = PISTON_TOP - PISTON_BOTTOM;
  return (
    <group ref={ref} position={[0, 0, cyl.z]}>
      {/* crown + skirt */}
      <mesh position={[0, (PISTON_TOP + PISTON_BOTTOM) / 2, 0]}>
        <cylinderGeometry args={[PISTON_R, PISTON_R, bodyH, 48]} />
        <Mat kind="piston" />
      </mesh>
      {/* ring grooves: two compression rings and one oil-control ring */}
      {[PISTON_TOP - 5, PISTON_TOP - 10, PISTON_TOP - 16].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[PISTON_R - 0.2, i === 2 ? 1.6 : 1.0, 6, 64]} />
          <Mat kind="liner" />
        </mesh>
      ))}
      {/* wrist pin, running across the bore */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[11, 11, 62, 24]} />
        <Mat kind="steel" />
      </mesh>
    </group>
  );
}

/** One connecting rod, drawn in the engine frame. */
function ConRod({ cyl }: { cyl: CylinderRef }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const { pin, rodAngle } = sliderCrank(engineClock.theta, cyl);
    ref.current.position.set(pin.x, pin.y, cyl.z);
    ref.current.rotation.z = rodAngle;
  });
  const w = ENGINE.rodWidth;
  const shaftLen = ROD_L - 40 - 18;
  return (
    <group ref={ref}>
      {/* big end */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[40, 40, w, 32]} />
        <Mat kind="steel" />
      </mesh>
      {/* cap bolts */}
      {[-32, 32].map((x) => (
        <mesh key={x} position={[x, -12, 0]}>
          <cylinderGeometry args={[4.5, 4.5, 40, 8]} />
          <Mat kind="crankSteel" />
        </mesh>
      ))}
      {/* I-beam shaft */}
      <mesh position={[0, 40 + shaftLen / 2, 0]}>
        <boxGeometry args={[26, shaftLen, w * 0.55]} />
        <Mat kind="steel" />
      </mesh>
      <mesh position={[0, 40 + shaftLen / 2, 0]}>
        <boxGeometry args={[14, shaftLen, w * 0.8]} />
        <Mat kind="steel" />
      </mesh>
      {/* small end */}
      <mesh position={[0, ROD_L, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[19, 19, w, 24]} />
        <Mat kind="steel" />
      </mesh>
    </group>
  );
}

/** Pistons and rods for both banks. */
export function RotatingAssembly() {
  return (
    <>
      {(["A", "B"] as BankId[]).map((bankId) => {
        const bank = BANKS[bankId];
        const cyls = CYLINDERS.filter((c) => c.bank.id === bankId);
        const ex: [number, number, number] = [
          bank.axis.x * EXPLODE_DIST,
          bank.axis.y * EXPLODE_DIST,
          0,
        ];
        return (
          <group key={bankId}>
            <Part id="piston" explode={[0, EXPLODE_DIST, 0]} rotation={[0, 0, bank.rotationZ]}>
              {cyls.map((c) => (
                <Piston key={c.number} cyl={c} />
              ))}
            </Part>
            <Part id="conrod" explode={ex}>
              {cyls.map((c) => (
                <ConRod key={c.number} cyl={c} />
              ))}
            </Part>
          </group>
        );
      })}
    </>
  );
}
