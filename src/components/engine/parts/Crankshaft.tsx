"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { Part } from "../Part";
import { Mat } from "../materials";
import { CRANK_RADIUS, DEG, ENGINE, THROW_ANGLES, THROW_Z } from "@/lib/engine/config";
import { engineClock } from "@/lib/engine/store";
import { crankWebGeometry } from "@/lib/engine/geometry";

const PIN_LEN = 2 * ENGINE.rodWidth + 4;
const WEB_T = 16;
const WEB_OFFSET = PIN_LEN / 2 + WEB_T / 2;

/**
 * The whole rotating group: crank, flywheel and harmonic balancer.  The
 * group is spun about Z by the shared clock; everything inside is static.
 */
export function Crankshaft() {
  const spin = useRef<Group>(null);
  useFrame(() => {
    if (spin.current) spin.current.rotation.z = -engineClock.theta * DEG;
  });

  const webs = useMemo(
    () => THROW_ANGLES.map((a) => crankWebGeometry(a, CRANK_RADIUS, WEB_T)),
    [],
  );

  return (
    <group ref={spin}>
      <Part id="crankshaft">
        {/* main journal shaft, front to rear */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[ENGINE.mainJournalRadius, ENGINE.mainJournalRadius, 440, 40]} />
          <Mat kind="crankSteel" />
        </mesh>

        {THROW_ANGLES.map((a, i) => {
          const px = CRANK_RADIUS * Math.cos(a);
          const py = CRANK_RADIUS * Math.sin(a);
          const z = THROW_Z[i];
          return (
            <group key={i}>
              {/* crank pin */}
              <mesh position={[px, py, z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[ENGINE.crankPinRadius, ENGINE.crankPinRadius, PIN_LEN, 32]} />
                <Mat kind="steel" />
              </mesh>
              {/* webs / counterweights either side of the pin */}
              <mesh geometry={webs[i]} position={[0, 0, z + WEB_OFFSET]}>
                <Mat kind="crankSteel" />
              </mesh>
              <mesh geometry={webs[i]} position={[0, 0, z - WEB_OFFSET]}>
                <Mat kind="crankSteel" />
              </mesh>
            </group>
          );
        })}

        {/* rear flange */}
        <mesh position={[0, 0, -226]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[62, 62, 16, 40]} />
          <Mat kind="crankSteel" />
        </mesh>
        {/* front snout with timing sprocket */}
        <mesh position={[0, 0, 262]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[22, 22, 90, 24]} />
          <Mat kind="steel" />
        </mesh>
        <mesh position={[0, 0, 231]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[42, 42, 12, 30]} />
          <Mat kind="steel" />
        </mesh>
      </Part>

      <Part id="flywheel" explode={[0, 0, -220]}>
        <mesh position={[0, 0, -250]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[150, 150, 28, 72]} />
          <Mat kind="crankSteel" />
        </mesh>
        {/* starter ring gear */}
        <mesh position={[0, 0, -250]}>
          <torusGeometry args={[150, 7, 8, 96]} />
          <Mat kind="steel" />
        </mesh>
        {/* clutch face and bolt circle */}
        <mesh position={[0, 0, -265]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[125, 125, 4, 64]} />
          <Mat kind="steel" />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[45 * Math.cos(a), 45 * Math.sin(a), -237]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[6, 6, 6, 6]} />
              <Mat kind="steel" />
            </mesh>
          );
        })}
      </Part>

      <Part id="balancer" explode={[0, 0, 160]}>
        {/* hub */}
        <mesh position={[0, 0, 280]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[46, 46, 40, 40]} />
          <Mat kind="crankSteel" />
        </mesh>
        {/* rubber damping ring */}
        <mesh position={[0, 0, 280]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[54, 54, 36, 40]} />
          <Mat kind="rubber" />
        </mesh>
        {/* outer inertia ring with belt grooves */}
        <mesh position={[0, 0, 280]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[84, 84, 38, 56]} />
          <Mat kind="crankSteel" />
        </mesh>
        {[-12, -6, 0, 6, 12].map((dz) => (
          <mesh key={dz} position={[0, 0, 280 + dz]}>
            <torusGeometry args={[84, 1.6, 6, 56]} />
            <Mat kind="rubber" />
          </mesh>
        ))}
        {/* centre bolt */}
        <mesh position={[0, 0, 303]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[12, 12, 8, 6]} />
          <Mat kind="steel" />
        </mesh>
      </Part>
    </group>
  );
}
