import type { PartId } from "./store";

export interface PartInfo {
  name: string;
  short: string;
  description: string;
  specs: [string, string][];
}

export const PART_INFO: Record<PartId, PartInfo> = {
  crankshaft: {
    name: "Crankshaft",
    short: "Cross-plane, forged steel",
    description:
      "Converts the reciprocating motion of the pistons into rotation. A cross-plane V8 crank has four throws set 90° apart, so viewed end-on the pins form a cross. Each pin carries two connecting rods, one from each bank. The large counterweights balance the rocking couple that the cross-plane layout creates. It turns clockwise when viewed from the front and drives the camshafts through a timing chain at half crank speed.",
    specs: [
      ["Stroke", "88.3 mm (crank radius 44.15 mm)"],
      ["Throws", "4, at 0° / 270° / 90° / 180°"],
      ["Main bearings", "5"],
      ["Rotation", "Clockwise from the front"],
    ],
  },
  piston: {
    name: "Piston",
    short: "Forged aluminium, 89 mm bore",
    description:
      "Seals the combustion chamber and transmits gas pressure to the connecting rod through the wrist pin. Three rings sit in the crown: two compression rings that seal gas and one oil-control ring that scrapes oil back down the bore. The motion is not sinusoidal: because the rod is finite in length the piston moves faster near TDC than near BDC, which is exactly what the model reproduces.",
    specs: [
      ["Bore", "89.0 mm"],
      ["Compression height", "30 mm"],
      ["Rings", "2 compression + 1 oil control"],
      ["Mean speed @ 6000 rpm", "17.7 m/s"],
    ],
  },
  conrod: {
    name: "Connecting rod",
    short: "Forged steel I-beam",
    description:
      "Links the piston to the crank pin. The big end wraps around the crank pin on a plain bearing shell and the small end carries the wrist pin. Two rods share each crank pin side by side, which is why the two banks are offset a few millimetres along the crank. The rod angle you see swinging back and forth is the source of piston side-thrust on the cylinder wall.",
    specs: [
      ["Centre-to-centre", "143 mm"],
      ["Rod ratio (L/r)", "3.24"],
      ["Big-end width", "21 mm"],
    ],
  },
  block: {
    name: "Cylinder block",
    short: "Aluminium 90° V",
    description:
      "The main casting. The two banks sit at 90° to each other, which is the natural angle for a V8 because it lets the cross-plane crank fire evenly every 90° of rotation. The crankcase below the banks carries the five main bearings, and the front timing cover encloses the chain drive to the camshafts. Enable X-ray to see the pistons moving inside the bores.",
    specs: [
      ["Bank angle", "90°"],
      ["Bore spacing", "98 mm"],
      ["Displacement", "4.4 L (4395 cc)"],
      ["Deck height", "218 mm"],
    ],
  },
  oilpan: {
    name: "Oil pan",
    short: "Sump and oil reservoir",
    description:
      "Bolts to the bottom of the crankcase and holds the engine oil. The deep section at the rear is the sump where the oil pump pickup sits. Baffles inside stop the oil sloshing away from the pickup under cornering.",
    specs: [["Capacity", "≈ 8.5 L"]],
  },
  head: {
    name: "Cylinder head",
    short: "Aluminium DOHC, 4 valves per cylinder",
    description:
      "Closes the top of the cylinders and houses the combustion chambers, valves, camshafts and spark plugs. Each cylinder has a pent-roof chamber with two intake valves on the valley side and two exhaust valves on the outer side. The intake ports face into the V and the exhaust ports face outward.",
    specs: [
      ["Valves", "32 (4 per cylinder)"],
      ["Layout", "DOHC, chain driven"],
      ["Chamber", "Pent-roof, central plug"],
    ],
  },
  valvetrain: {
    name: "Valves and springs",
    short: "Poppet valves, bucket tappets",
    description:
      "Each cylinder has two intake valves (larger, on the valley side) and two exhaust valves. The cam lobe presses directly on a bucket tappet on top of the valve stem; the spring closes the valve again. Watch a single cylinder through its cycle: the exhaust valves open near the end of the power stroke, the intake valves open just before TDC, and both are briefly open together at overlap.",
    specs: [
      ["Intake valve", "34 mm"],
      ["Exhaust valve", "29 mm"],
      ["Max lift", "9.5 mm"],
      ["Duration", "≈ 250° crank"],
    ],
  },
  camshaft: {
    name: "Camshafts",
    short: "Two per bank, half crank speed",
    description:
      "Four camshafts in total: an intake and an exhaust cam per bank. They turn at exactly half crankshaft speed because each valve opens once per two crank revolutions. The lobes are phased so that each cylinder's valves open in step with the firing order, which you can see by comparing lobe positions along one shaft.",
    specs: [
      ["Count", "4 (DOHC)"],
      ["Speed", "0.5 × crank"],
      ["Lobes", "32"],
    ],
  },
  valvecover: {
    name: "Valve cover",
    short: "Seals the top of the head",
    description:
      "Covers the camshafts and valvetrain and keeps the oil in. The ignition coils mount through it directly onto the spark plugs.",
    specs: [["Material", "Magnesium / composite"]],
  },
  ignition: {
    name: "Spark plugs and coils",
    short: "Coil-on-plug ignition",
    description:
      "One pencil coil sits on each spark plug in the centre of the combustion chamber. The plugs fire at 90° intervals in the order 1-5-4-8-6-3-7-2. The orange flash in the chamber (visible in X-ray) is drawn shortly after each plug fires.",
    specs: [
      ["Firing order", "1-5-4-8-6-3-7-2"],
      ["Interval", "90° crank"],
    ],
  },
  intake: {
    name: "Intake manifold",
    short: "Plenum with eight runners",
    description:
      "Air enters through the throttle body at the front into a plenum in the valley, then splits into eight equal-length runners feeding the intake ports on the inside of each head. Runner length is tuned so the pressure wave from the closing valve arrives back at the port as it opens again, boosting cylinder filling at the target rpm.",
    specs: [
      ["Runners", "8"],
      ["Throttle body", "≈ 80 mm"],
    ],
  },
  exhaust: {
    name: "Exhaust manifolds",
    short: "4-into-1 per bank",
    description:
      "Each bank has a manifold collecting four exhaust ports into one downpipe. Because the cross-plane crank fires unevenly within each bank (two cylinders fire 90° apart, then a 270° gap), the pulses in each manifold are irregular. That uneven pulse train is the source of the classic V8 burble.",
    specs: [
      ["Pulse spacing per bank", "180-90-180-270°"],
      ["Runner diameter", "≈ 38 mm"],
    ],
  },
  flywheel: {
    name: "Flywheel",
    short: "Smooths crank speed, starter ring gear",
    description:
      "Bolted to the rear crank flange. Its inertia carries the crank between power strokes, and the toothed ring around its rim is engaged by the starter motor. The clutch or torque converter bolts to its rear face.",
    specs: [
      ["Diameter", "≈ 300 mm"],
      ["Ring gear", "Starter drive"],
    ],
  },
  balancer: {
    name: "Harmonic balancer",
    short: "Torsional damper and belt pulley",
    description:
      "Mounted on the front crank snout. An inner hub and an outer ring are bonded by a rubber layer that absorbs torsional vibration of the crankshaft. The grooves on the outer ring drive the accessory belt for the alternator, water pump and air-con compressor.",
    specs: [["Type", "Elastomer torsional damper"]],
  },
};
