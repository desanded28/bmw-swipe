"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { ExplodeGroup, Part } from "../Part";
import { Mat } from "../materials";
import {
  BANKS,
  CYLINDERS,
  DEG,
  ENGINE,
  FIRE_ANGLE,
  exhaustLift,
  intakeLift,
  type BankId,
  type CylinderRef,
} from "@/lib/engine/config";
import { engineClock } from "@/lib/engine/store";
import { camLobeGeometry, springGeometry } from "@/lib/engine/geometry";

const D = ENGINE.deckHeight;
const HEAD_H = 120;
const VALVE_SEAT_Y = D + 4;
const STEM_LEN = 112;
const SPRING_SEAT_Y = D + 50;
const SPRING_H = 56;
const VALVE_X = 24;
const VALVE_DZ = 20;
const CAM_Y = D + 142;
const CAM_BASE_R = 16;
const COVER_TOP = D + 178;

type ValveKind = "intake" | "exhaust";

interface ValveSpec {
  kind: ValveKind;
  x: number;
  z: number;
  cyl: CylinderRef;
}

function valvesForBank(bankId: BankId): ValveSpec[] {
  const v = BANKS[bankId].valleySign;
  const out: ValveSpec[] = [];
  for (const cyl of CYLINDERS.filter((c) => c.bank.id === bankId)) {
    for (const dz of [-VALVE_DZ, VALVE_DZ]) {
      out.push({ kind: "intake", x: v * VALVE_X, z: cyl.z + dz, cyl });
      out.push({ kind: "exhaust", x: -v * VALVE_X, z: cyl.z + dz, cyl });
    }
  }
  return out;
}

function Valve({ spec, spring }: { spec: ValveSpec; spring: ReturnType<typeof springGeometry> }) {
  const valve = useRef<Group>(null);
  const coil = useRef<Group>(null);
  useFrame(() => {
    const lift =
      spec.kind === "intake"
        ? intakeLift(engineClock.theta, spec.cyl.number)
        : exhaustLift(engineClock.theta, spec.cyl.number);
    if (valve.current) valve.current.position.y = VALVE_SEAT_Y - lift;
    if (coil.current) coil.current.scale.y = (SPRING_H - lift) / SPRING_H;
  });
  const headR = (spec.kind === "intake" ? ENGINE.intakeValveDiameter : ENGINE.exhaustValveDiameter) / 2;
  return (
    <group>
      <group ref={valve} position={[spec.x, VALVE_SEAT_Y, spec.z]}>
        {/* valve head */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[headR, headR - 3, 3, 32]} />
          <Mat kind="steel" />
        </mesh>
        {/* stem */}
        <mesh position={[0, 2 + STEM_LEN / 2, 0]}>
          <cylinderGeometry args={[3.2, 3.2, STEM_LEN, 12]} />
          <Mat kind="steel" />
        </mesh>
        {/* spring retainer */}
        <mesh position={[0, 103, 0]}>
          <cylinderGeometry args={[14, 12, 4, 20]} />
          <Mat kind="steel" />
        </mesh>
        {/* bucket tappet the cam lobe pushes on */}
        <mesh position={[0, 2 + STEM_LEN + 6, 0]}>
          <cylinderGeometry args={[15, 15, 12, 24, 1]} />
          <Mat kind="steel" />
        </mesh>
      </group>
      {/* spring: seated on the head, compressed from the top */}
      <group ref={coil} position={[spec.x, SPRING_SEAT_Y, spec.z]}>
        <mesh geometry={spring}>
          <Mat kind="crankSteel" />
        </mesh>
      </group>
    </group>
  );
}

function Camshaft({
  bankId,
  kind,
  valves,
}: {
  bankId: BankId;
  kind: ValveKind;
  valves: ValveSpec[];
}) {
  const ref = useRef<Group>(null);
  const lobe = useMemo(() => camLobeGeometry(CAM_BASE_R, ENGINE.valveMaxLift, 12), []);
  const v = BANKS[bankId].valleySign;
  const x = kind === "intake" ? v * VALVE_X : -v * VALVE_X;
  const centre = kind === "intake" ? ENGINE.intakeCentre : ENGINE.exhaustCentre;

  useFrame(() => {
    // camshafts turn at half crank speed, same direction as the crank
    if (ref.current) ref.current.rotation.z = (-engineClock.theta / 2) * DEG;
  });

  return (
    <group ref={ref} position={[x, CAM_Y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[12.5, 12.5, 440, 24]} />
        <Mat kind="crankSteel" />
      </mesh>
      {valves
        .filter((s) => s.kind === kind)
        .map((s, i) => {
          // phase the lobe so its nose points at the bucket when lift peaks
          const offset = (180 + (FIRE_ANGLE[s.cyl.number] + centre) / 2) * DEG;
          return (
            <mesh key={i} geometry={lobe} position={[0, 0, s.z]} rotation={[0, 0, offset]}>
              <Mat kind="steel" />
            </mesh>
          );
        })}
      {/* cam sprocket, inside the timing cover */}
      <mesh position={[0, 0, 226]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[42, 42, 8, 36]} />
        <Mat kind="steel" />
      </mesh>
    </group>
  );
}

function Ignition({ bankId }: { bankId: BankId }) {
  const cyls = CYLINDERS.filter((c) => c.bank.id === bankId);
  return (
    <group>
      {cyls.map((c) => (
        <group key={c.number} position={[0, 0, c.z]}>
          {/* plug thread and hex */}
          <mesh position={[0, D + 70, 0]}>
            <cylinderGeometry args={[7, 7, 30, 6]} />
            <Mat kind="steel" />
          </mesh>
          {/* ceramic insulator */}
          <mesh position={[0, D + 108, 0]}>
            <cylinderGeometry args={[5, 5.5, 46, 16]} />
            <Mat kind="ceramic" />
          </mesh>
          {/* pencil coil down the plug well */}
          <mesh position={[0, (D + 131 + COVER_TOP) / 2, 0]}>
            <cylinderGeometry args={[9, 9, COVER_TOP - (D + 131), 16]} />
            <Mat kind="blackPlastic" />
          </mesh>
          {/* coil body on the cover */}
          <mesh position={[0, COVER_TOP + 22, 0]}>
            <boxGeometry args={[30, 44, 30]} />
            <Mat kind="blackPlastic" />
          </mesh>
          <mesh position={[0, COVER_TOP + 34, 22]}>
            <boxGeometry args={[16, 12, 18]} />
            <Mat kind="rubber" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BankHead({ bankId }: { bankId: BankId }) {
  const bank = BANKS[bankId];
  const v = bank.valleySign;
  const valves = useMemo(() => valvesForBank(bankId), [bankId]);
  const spring = useMemo(() => springGeometry(12.5, SPRING_H, 6, 2.1), []);
  const cyls = CYLINDERS.filter((c) => c.bank.id === bankId);

  return (
    <ExplodeGroup explode={[0, 170, 0]} rotation={[0, 0, bank.rotationZ]}>
      <Part id="head">
        {/* head casting */}
        <mesh position={[v * 6, D + HEAD_H / 2, 0]}>
          <boxGeometry args={[180, HEAD_H, 440]} />
          <Mat kind="alloy" xrayable />
        </mesh>
        {/* intake port bosses (valley side) and exhaust flanges (outer side) */}
        {cyls.map((c) => (
          <group key={c.number}>
            <mesh position={[v * 100, D + 52, c.z]}>
              <boxGeometry args={[12, 46, 44]} />
              <Mat kind="darkAlloy" xrayable />
            </mesh>
            <mesh position={[-v * 90, D + 45, c.z]}>
              <boxGeometry args={[12, 42, 40]} />
              <Mat kind="darkAlloy" xrayable />
            </mesh>
          </group>
        ))}
      </Part>

      <Part id="valvetrain">
        {valves.map((s, i) => (
          <Valve key={i} spec={s} spring={spring} />
        ))}
      </Part>

      <Part id="camshaft" explode={[0, 60, 0]}>
        <Camshaft bankId={bankId} kind="intake" valves={valves} />
        <Camshaft bankId={bankId} kind="exhaust" valves={valves} />
      </Part>

      <Part id="ignition" explode={[0, 110, 0]}>
        <Ignition bankId={bankId} />
      </Part>

      <Part id="valvecover" explode={[0, 130, 0]}>
        <mesh position={[v * 4, D + 149, 0]}>
          <boxGeometry args={[150, 58, 432]} />
          <Mat kind="blackPlastic" xrayable />
        </mesh>
        <mesh position={[v * 4, COVER_TOP + 4, 0]}>
          <boxGeometry args={[110, 8, 410]} />
          <Mat kind="blackPlastic" xrayable />
        </mesh>
        {bankId === "B" && (
          <mesh position={[-v * 40, COVER_TOP + 10, 150]}>
            <cylinderGeometry args={[22, 22, 12, 24]} />
            <Mat kind="blackPlastic" xrayable />
          </mesh>
        )}
      </Part>
    </ExplodeGroup>
  );
}

export function Heads() {
  return (
    <>
      <BankHead bankId="A" />
      <BankHead bankId="B" />
    </>
  );
}
