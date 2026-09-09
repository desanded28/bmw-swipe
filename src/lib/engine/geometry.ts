import {
  CatmullRomCurve3,
  Curve,
  ExtrudeGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Andrew's monotone-chain convex hull (counter-clockwise). */
export function convexHull(points: Vector2[]): Vector2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Vector2, a: Vector2, b: Vector2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vector2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Vector2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function circlePoints(cx: number, cy: number, r: number, n = 24, a0 = 0, a1 = Math.PI * 2) {
  const out: Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(new Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return out;
}

/** Extrude a 2-D polygon along +Z, centred on z = 0. */
export function extrudePolygon(poly: Vector2[], depth: number, bevel = 0): ExtrudeGeometry {
  const shape = new Shape(poly);
  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Crankshaft web / counterweight for a throw whose pin sits at `pinAngle`.
 * The outline is the convex hull of the pin boss, the main journal boss and
 * a large counterweight arc on the opposite side of the pin.
 */
export function crankWebGeometry(
  pinAngle: number,
  crankRadius: number,
  thickness: number,
): ExtrudeGeometry {
  const pts: Vector2[] = [];
  const px = crankRadius * Math.cos(pinAngle);
  const py = crankRadius * Math.sin(pinAngle);
  pts.push(...circlePoints(px, py, 38, 24));
  pts.push(...circlePoints(0, 0, 44, 24));
  const opp = pinAngle + Math.PI;
  pts.push(...circlePoints(0, 0, 92, 20, opp - 1.15, opp + 1.15));
  return extrudePolygon(convexHull(pts), thickness, 1.5);
}

/** Cam lobe: base circle plus a rounded nose along +Y. */
export function camLobeGeometry(baseRadius: number, lift: number, thickness: number) {
  const pts: Vector2[] = [];
  pts.push(...circlePoints(0, 0, baseRadius, 32));
  const noseR = baseRadius * 0.55;
  pts.push(...circlePoints(0, baseRadius + lift - noseR, noseR, 20));
  return extrudePolygon(convexHull(pts), thickness, 0.6);
}

class HelixCurve extends Curve<Vector3> {
  constructor(
    private radius: number,
    private height: number,
    private turns: number,
  ) {
    super();
  }
  getPoint(t: number, target = new Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.radius * Math.cos(a), t * this.height, this.radius * Math.sin(a));
  }
}

/** Coil spring standing on y = 0, rising to y = height. */
export function springGeometry(radius: number, height: number, turns: number, wire: number) {
  return new TubeGeometry(new HelixCurve(radius, height, turns), turns * 24, wire, 8, false);
}

/** Smooth pipe through the given points. */
export function pipeGeometry(points: [number, number, number][], radius: number, segments = 32) {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(...p)),
    false,
    "centripetal",
  );
  return new TubeGeometry(curve, segments, radius, 14, false);
}
