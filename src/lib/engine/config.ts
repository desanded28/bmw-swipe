/**
 * Geometry and kinematics for a 90° cross-plane V8.
 *
 * Dimensions are in millimetres and are modelled on a modern BMW-style
 * 4.4 L twin-turbo V8 (N63/S63 family): 89 mm bore, 88.3 mm stroke,
 * 98 mm bore spacing, DOHC 32-valve heads, firing order 1-5-4-8-6-3-7-2.
 *
 * Coordinate system (engine frame):
 *   +Z = front of the engine (crank pulley), -Z = rear (flywheel)
 *   +Y = up
 *   Bank A (cylinders 1-4) leans toward -X, bank B (cylinders 5-8) toward +X.
 *
 * The crankshaft rotates clockwise when viewed from the front (+Z), which
 * is the normal direction of rotation for a production engine.
 */

export const DEG = Math.PI / 180;

export const ENGINE = {
  bore: 89,
  stroke: 88.3,
  rodLength: 143,
  boreSpacing: 98,
  bankAngle: 90,
  /** distance from piston pin centre to piston crown */
  compressionHeight: 30,
  /** how far apart the two rods on one crank pin sit (mm, along Z) */
  rodWidth: 21,
  mainJournalRadius: 35,
  crankPinRadius: 27.5,
  /** deck height: crank centre to block deck surface, along the bank axis */
  deckHeight: 0,
  displacementLitres: 0,
  valveMaxLift: 9.5,
  intakeValveDiameter: 34,
  exhaustValveDiameter: 29,
  intakeDuration: 250,
  exhaustDuration: 250,
  /** crank angle after firing TDC at which intake lift peaks */
  intakeCentre: 470,
  /** crank angle after firing TDC at which exhaust lift peaks */
  exhaustCentre: 250,
};

export const CRANK_RADIUS = ENGINE.stroke / 2;
ENGINE.deckHeight = CRANK_RADIUS + ENGINE.rodLength + ENGINE.compressionHeight + 1;
ENGINE.displacementLitres =
  (Math.PI * (ENGINE.bore / 2) ** 2 * ENGINE.stroke * 8) / 1_000_000;

/** Half the bank angle; each bank axis is tilted ±45° from vertical. */
export const HALF_BANK = (ENGINE.bankAngle / 2) * DEG;

export type BankId = "A" | "B";

export interface Bank {
  id: BankId;
  /** axis angle, measured from +Y toward +X (radians) */
  phi: number;
  /** unit vector of the cylinder axis in the engine frame */
  axis: { x: number; y: number };
  /** rotation of the bank group about Z so that local +Y = axis */
  rotationZ: number;
  /** +1 if local +X points into the V valley, -1 if it points outward */
  valleySign: 1 | -1;
  /** Z offset of this bank's cylinders (the two rods share a pin side by side) */
  zOffset: number;
  cylinders: number[];
}

export const BANKS: Record<BankId, Bank> = {
  A: {
    id: "A",
    phi: -HALF_BANK,
    axis: { x: Math.sin(-HALF_BANK), y: Math.cos(-HALF_BANK) },
    rotationZ: HALF_BANK,
    valleySign: 1,
    zOffset: (ENGINE.rodWidth + 1) / 2,
    cylinders: [1, 2, 3, 4],
  },
  B: {
    id: "B",
    phi: HALF_BANK,
    axis: { x: Math.sin(HALF_BANK), y: Math.cos(HALF_BANK) },
    rotationZ: -HALF_BANK,
    valleySign: -1,
    zOffset: -(ENGINE.rodWidth + 1) / 2,
    cylinders: [5, 6, 7, 8],
  },
};

/** Z position of each crank throw, front (index 0) to rear (index 3). */
export const THROW_Z = [1.5, 0.5, -0.5, -1.5].map((k) => k * ENGINE.boreSpacing);

/**
 * Crank-pin angles for each throw (radians, standard maths convention:
 * measured from +X toward +Y, in the crankshaft's own frame).
 *
 * Relative to throw 1 the pins sit at 0°, 270°, 90°, 180° – the cross-plane
 * arrangement. The absolute offset of 135° puts cylinder 1 exactly at TDC
 * when the crank angle is 0.
 */
export const THROW_ANGLES = [135, 45, 225, 315].map((d) => d * DEG);

export const FIRING_ORDER = [1, 5, 4, 8, 6, 3, 7, 2];

/** Crank angle (0–720°) at which each cylinder's power stroke begins. */
export const FIRE_ANGLE: Record<number, number> = {};
FIRING_ORDER.forEach((cyl, i) => {
  FIRE_ANGLE[cyl] = i * 90;
});

export interface CylinderRef {
  number: number;
  bank: Bank;
  throwIndex: number;
  /** Z position of this cylinder's bore centre (engine frame) */
  z: number;
}

export const CYLINDERS: CylinderRef[] = [];
(["A", "B"] as BankId[]).forEach((bankId) => {
  const bank = BANKS[bankId];
  bank.cylinders.forEach((number, throwIndex) => {
    CYLINDERS.push({
      number,
      bank,
      throwIndex,
      z: THROW_Z[throwIndex] + bank.zOffset,
    });
  });
});

export function cylinderByNumber(n: number): CylinderRef {
  return CYLINDERS.find((c) => c.number === n)!;
}

/** Angle of crank pin `throwIndex` in the engine frame for crank angle theta (degrees). */
export function pinAngle(thetaDeg: number, throwIndex: number): number {
  // clockwise rotation viewed from the front = negative maths angle
  return -thetaDeg * DEG + THROW_ANGLES[throwIndex];
}

export interface SliderCrankState {
  /** crank-pin centre, engine frame */
  pin: { x: number; y: number };
  /** distance of the piston pin from the crank centre along the bank axis */
  s: number;
  /** piston pin centre, engine frame */
  pistonPin: { x: number; y: number };
  /** rod angle in the engine frame (radians, rotation about Z applied to a +Y-pointing rod) */
  rodAngle: number;
}

/**
 * Exact slider-crank solution.  The piston pin is constrained to the bank
 * axis, the big end to the crank pin circle, and the rod length is fixed:
 *   |s·u − p| = L   ⇒   s = p·u + sqrt(L² − r² + (p·u)²)
 */
export function sliderCrank(thetaDeg: number, cyl: CylinderRef): SliderCrankState {
  const beta = pinAngle(thetaDeg, cyl.throwIndex);
  const r = CRANK_RADIUS;
  const pin = { x: r * Math.cos(beta), y: r * Math.sin(beta) };
  const u = cyl.bank.axis;
  const pu = pin.x * u.x + pin.y * u.y;
  const L = ENGINE.rodLength;
  const s = pu + Math.sqrt(L * L - r * r + pu * pu);
  const pistonPin = { x: s * u.x, y: s * u.y };
  const rodAngle = Math.atan2(pistonPin.y - pin.y, pistonPin.x - pin.x) - Math.PI / 2;
  return { pin, s, pistonPin, rodAngle };
}

export type Stroke = "power" | "exhaust" | "intake" | "compression";

export const STROKE_ORDER: Stroke[] = ["power", "exhaust", "intake", "compression"];

export const STROKE_COLORS: Record<Stroke, string> = {
  intake: "#3b82f6",
  compression: "#eab308",
  power: "#f97316",
  exhaust: "#9ca3af",
};

/** Crank degrees since this cylinder last fired (0–720). */
export function cyclePhase(thetaDeg: number, cylNumber: number): number {
  return (((thetaDeg - FIRE_ANGLE[cylNumber]) % 720) + 720) % 720;
}

export function strokeAt(thetaDeg: number, cylNumber: number): Stroke {
  const phase = cyclePhase(thetaDeg, cylNumber);
  return STROKE_ORDER[Math.floor(phase / 180)];
}

/** Smooth cam-like lift profile: 0 outside the window, peak of 1 at `centre`. */
function liftProfile(phase: number, centre: number, duration: number): number {
  let d = phase - centre;
  d = ((d + 360) % 720) - 360;
  const half = duration / 2;
  if (Math.abs(d) >= half) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * d) / half));
}

export function intakeLift(thetaDeg: number, cylNumber: number): number {
  const phase = cyclePhase(thetaDeg, cylNumber);
  return ENGINE.valveMaxLift * liftProfile(phase, ENGINE.intakeCentre, ENGINE.intakeDuration);
}

export function exhaustLift(thetaDeg: number, cylNumber: number): number {
  const phase = cyclePhase(thetaDeg, cylNumber);
  return ENGINE.valveMaxLift * liftProfile(phase, ENGINE.exhaustCentre, ENGINE.exhaustDuration);
}

/** 0–1 combustion intensity, peaking shortly after firing TDC. */
export function combustionIntensity(thetaDeg: number, cylNumber: number): number {
  const phase = cyclePhase(thetaDeg, cylNumber);
  if (phase > 60) return 0;
  // fast rise, slower decay
  if (phase < 12) return phase / 12;
  return 1 - (phase - 12) / 48;
}

/** Mean piston speed in m/s at a given rpm. */
export function meanPistonSpeed(rpm: number): number {
  return (2 * ENGINE.stroke * rpm) / 60 / 1000;
}
