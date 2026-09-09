"use client";

import { useMemo } from "react";
import { Part } from "../Part";
import { Mat } from "../materials";
import { BANKS, CYLINDERS, ENGINE, type BankId } from "@/lib/engine/config";
import { pipeGeometry } from "@/lib/engine/geometry";

const D = ENGINE.deckHeight;

/** Rotate a bank-frame point into the engine frame. */
function toWorld(bankId: BankId, lx: number, ly: number): [number, number] {
  const rot = BANKS[bankId].rotationZ;
  return [lx * Math.cos(rot) - ly * Math.sin(rot), lx * Math.sin(rot) + ly * Math.cos(rot)];
}

const PLENUM_Y = 372;

export function IntakeManifold() {
  const runners = useMemo(
    () =>
      CYLINDERS.map((c) => {
        const v = c.bank.valleySign;
        const [px, py] = toWorld(c.bank.id, v * 96, D + 52);
        const [dx, dy] = toWorld(c.bank.id, v, 0);
        const sx = Math.sign(px);
        return pipeGeometry(
          [
            [px - dx * 8, py - dy * 8, c.z],
            [px + dx * 34, py + dy * 34, c.z],
            [sx * 92, 318, c.z],
            [sx * 70, PLENUM_Y - 20, c.z],
          ],
          21,
          28,
        );
      }),
    [],
  );

  return (
    <Part id="intake" explode={[0, 260, 0]}>
      {/* plenum */}
      <mesh position={[0, PLENUM_Y, 0]}>
        <boxGeometry args={[240, 76, 380]} />
        <Mat kind="blackPlastic" xrayable />
      </mesh>
      <mesh position={[0, PLENUM_Y + 40, 0]}>
        <boxGeometry args={[200, 10, 340]} />
        <Mat kind="blackPlastic" xrayable />
      </mesh>
      {runners.map((g, i) => (
        <mesh key={i} geometry={g}>
          <Mat kind="blackPlastic" xrayable />
        </mesh>
      ))}
      {/* throttle body at the front of the plenum */}
      <mesh position={[0, PLENUM_Y, 214]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[40, 40, 48, 32]} />
        <Mat kind="alloy" xrayable />
      </mesh>
      <mesh position={[0, PLENUM_Y, 214]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[36, 36, 50, 32, 1, true]} />
        <Mat kind="rubber" xrayable />
      </mesh>
      {/* throttle blade */}
      <mesh position={[0, PLENUM_Y, 214]} rotation={[Math.PI / 2, 0, 0.35]}>
        <cylinderGeometry args={[34, 34, 2, 32]} />
        <Mat kind="steel" xrayable />
      </mesh>
      {/* inlet duct */}
      <mesh position={[0, PLENUM_Y, 262]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[38, 44, 50, 32]} />
        <Mat kind="rubber" xrayable />
      </mesh>
    </Part>
  );
}

const COLLECTOR_Y = -58;
const COLLECTOR_X = 340;

function BankExhaust({ bankId }: { bankId: BankId }) {
  const bank = BANKS[bankId];
  const sx = bankId === "A" ? -1 : 1;
  const runners = useMemo(
    () =>
      CYLINDERS.filter((c) => c.bank.id === bankId).map((c) => {
        const v = bank.valleySign;
        const [px, py] = toWorld(bankId, -v * 96, D + 45);
        const [dx, dy] = toWorld(bankId, -v, 0);
        return pipeGeometry(
          [
            [px - dx * 8, py - dy * 8, c.z],
            [px + dx * 55, py + dy * 55, c.z],
            [sx * 322, 40, c.z],
            [sx * COLLECTOR_X, COLLECTOR_Y + 30, c.z * 0.9 - 30],
          ],
          19,
          28,
        );
      }),
    [bank.valleySign, bankId, sx],
  );
  const explode: [number, number, number] = [sx * 220, -40, 0];
  return (
    <Part id="exhaust" explode={explode}>
      {runners.map((g, i) => (
        <mesh key={i} geometry={g}>
          <Mat kind="exhaust" xrayable />
        </mesh>
      ))}
      {/* collector */}
      <mesh position={[sx * COLLECTOR_X, COLLECTOR_Y, -30]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[36, 36, 420, 32]} />
        <Mat kind="exhaust" xrayable />
      </mesh>
      {/* downpipe flange */}
      <mesh position={[sx * COLLECTOR_X, COLLECTOR_Y, -246]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[48, 48, 12, 32]} />
        <Mat kind="exhaust" xrayable />
      </mesh>
    </Part>
  );
}

export function ExhaustManifolds() {
  return (
    <>
      <BankExhaust bankId="A" />
      <BankExhaust bankId="B" />
    </>
  );
}
