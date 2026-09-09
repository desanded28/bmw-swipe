"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Group, Mesh, MeshStandardMaterial, Color } from "three";
import { useEngineStore, type PartId } from "@/lib/engine/store";

type Vec3 = [number, number, number];

interface ExplodeGroupProps {
  /** displacement (in the parent's units) applied at full explode */
  explode?: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  children: ReactNode;
}

interface PartProps extends ExplodeGroupProps {
  id: PartId;
}

/** Smoothly moves a group toward `position + explode * explodeFactor`. */
function useExplode(ref: React.RefObject<Group | null>, position: Vec3, explode: Vec3) {
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const f = useEngineStore.getState().explode;
    const tx = position[0] + explode[0] * f;
    const ty = position[1] + explode[1] * f;
    const tz = position[2] + explode[2] * f;
    g.position.x += (tx - g.position.x) * 0.12;
    g.position.y += (ty - g.position.y) * 0.12;
    g.position.z += (tz - g.position.z) * 0.12;
  });
}

/** A plain group that takes part in the exploded view but is not itself selectable. */
export function ExplodeGroup({
  explode = [0, 0, 0],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  children,
}: ExplodeGroupProps) {
  const ref = useRef<Group>(null);
  useExplode(ref, position, explode);
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  );
}

const HIGHLIGHT = new Color("#1a7fd4");
const NONE = new Color("#000000");

/**
 * Wraps a logical engine part: handles visibility, hover/selection
 * highlighting and the exploded-view offset.
 */
export function Part({
  id,
  explode = [0, 0, 0],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  children,
}: PartProps) {
  const ref = useRef<Group>(null);
  const visible = useEngineStore((s) => s.visible[id]);
  const active = useEngineStore((s) => s.selected === id);
  const hoveredHere = useRef(false);
  const setHovered = useEngineStore((s) => s.setHovered);
  const setSelected = useEngineStore((s) => s.setSelected);

  useExplode(ref, position, explode);

  const applyHighlight = (on: boolean) => {
    ref.current?.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        const m = (obj as Mesh).material as MeshStandardMaterial;
        if (m && m.isMeshStandardMaterial) {
          m.emissive.copy(on ? HIGHLIGHT : NONE);
          m.emissiveIntensity = on ? 0.45 : 1;
        }
      }
    });
  };

  useEffect(() => {
    applyHighlight(active || hoveredHere.current);
  }, [active, visible]);

  if (!visible) return null;

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoveredHere.current = true;
    setHovered(id);
    applyHighlight(true);
    document.body.style.cursor = "pointer";
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoveredHere.current = false;
    setHovered(null);
    applyHighlight(useEngineStore.getState().selected === id);
    document.body.style.cursor = "auto";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelected(useEngineStore.getState().selected === id ? null : id);
  };

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={onClick}
    >
      {children}
    </group>
  );
}
