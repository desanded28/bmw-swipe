import { RawTrim, NormalizedTrim } from "./types";

let cached: NormalizedTrim[] | null = null;

// BMW supercars, race cars, and performance legends not in CarQuery
const SPECIAL_CARS: NormalizedTrim[] = [
  // Supercars
  { id: "sc-m1-1981", name: "M1", trim: "Supercar (3.5L 6cyl)", year: 1981, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 277, engineCc: 3453, cylinders: 6, torqueNm: 330 },
  { id: "sc-i8-2015", name: "i8", trim: "Plug-in Hybrid Coupe (1.5L 3cyl Turbo + Electric)", year: 2015, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 357, engineCc: 1499, cylinders: 3, torqueNm: 570 },
  { id: "sc-i8-2019", name: "i8", trim: "Roadster (1.5L 3cyl Turbo + Electric)", year: 2019, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 369, engineCc: 1499, cylinders: 3, torqueNm: 570 },
  { id: "sc-z8-2002", name: "Z8", trim: "Roadster (5.0L V8)", year: 2002, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 400, engineCc: 4941, cylinders: 8, torqueNm: 500 },
  { id: "sc-m8-2020", name: "M8 Competition", trim: "Coupe (4.4L V8 Twin-Turbo)", year: 2020, body: "Supercar", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 617, engineCc: 4395, cylinders: 8, torqueNm: 750 },
  { id: "sc-m8-conv-2020", name: "M8 Competition", trim: "Convertible (4.4L V8 Twin-Turbo)", year: 2020, body: "Supercar", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 617, engineCc: 4395, cylinders: 8, torqueNm: 750 },
  { id: "sc-3csl-2023", name: "3.0 CSL", trim: "Hommage (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 560, engineCc: 2993, cylinders: 6, torqueNm: 550 },
  { id: "sc-xm-2023", name: "XM", trim: "Label Red (4.4L V8 + Electric)", year: 2023, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 4, powerPs: 738, engineCc: 4395, cylinders: 8, torqueNm: 1000 },
  { id: "sc-m2-2023", name: "M2", trim: "Coupe (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 453, engineCc: 2993, cylinders: 6, torqueNm: 550 },
  // Race / Rally cars
  { id: "rc-m3-gtr-2001", name: "M3 GTR", trim: "Race (4.0L V8)", year: 2001, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 444, engineCc: 3997, cylinders: 8, torqueNm: 480 },
  { id: "rc-v12-lmr-1999", name: "V12 LMR", trim: "Le Mans Prototype (6.0L V12)", year: 1999, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 580, engineCc: 5990, cylinders: 12, torqueNm: 600 },
  { id: "rc-m1-procar-1979", name: "M1 Procar", trim: "Race Series (3.5L 6cyl)", year: 1979, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 470, engineCc: 3453, cylinders: 6, torqueNm: 400 },
  { id: "rc-320-rally-1977", name: "320i Group 5", trim: "Rally / Touring Car", year: 1977, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 300, engineCc: 1990, cylinders: 4, torqueNm: 280 },
  { id: "rc-m6-gt3-2022", name: "M4 GT3", trim: "Race (3.0L 6cyl Twin-Turbo)", year: 2022, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 590, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "rc-m8-gte-2018", name: "M8 GTE", trim: "WEC Race Car (4.0L V8 Turbo)", year: 2018, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 500, engineCc: 3981, cylinders: 8, torqueNm: 650 },
  { id: "rc-lmdh-2023", name: "M Hybrid V8", trim: "LMDh Prototype (4.0L V8 + Electric)", year: 2023, body: "Race Car", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 640, engineCc: 3981, cylinders: 8, torqueNm: 700 },
  { id: "sc-csl-hommage-2015", name: "3.0 CSL Hommage", trim: "Concept (3.0L 6cyl Twin-Turbo)", year: 2015, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 600, engineCc: 2979, cylinders: 6, torqueNm: 500 },
];

export async function fetchBMWTrims(): Promise<NormalizedTrim[]> {
  if (cached) return cached;

  const res = await fetch("/api/cars");
  const data = await res.json();
  const trims: RawTrim[] = data.Trims || [];

  const apiCars = trims
    .map(normalizeTrim)
    .filter((t) => t.powerPs !== null && t.powerPs > 0);

  cached = [...apiCars, ...SPECIAL_CARS];
  return cached;
}

function normalizeTrim(raw: RawTrim): NormalizedTrim {
  return {
    id: raw.model_id + "-" + raw.model_year + "-" + (raw.model_trim || "base"),
    name: raw.model_name,
    trim: raw.model_trim || "",
    year: parseInt(raw.model_year) || 0,
    body: normalizeBody(raw.model_body, raw.model_trim, raw.model_name),
    fuel: normalizeFuel(raw.model_engine_fuel),
    drive: normalizeDrive(raw.model_drive),
    doors: parseInt(raw.model_doors || "4") || 4,
    powerPs: psToHp(parseNum(raw.model_engine_power_ps)),
    engineCc: parseNum(raw.model_engine_cc),
    cylinders: parseNum(raw.model_engine_cyl),
    torqueNm: parseNum(raw.model_engine_torque_nm),
  };
}

function parseNum(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function psToHp(ps: number | null): number | null {
  if (ps === null) return null;
  return Math.round(ps * 0.9863);
}

function normalizeBody(body: string | null, trim: string | null, name: string | null): string {
  const t = (trim || "").toLowerCase();
  const n = (name || "").toLowerCase();

  // Check trim string first — most accurate source
  if (t.includes("convertible") || t.includes("cabriolet")) return "Convertible";
  if (t.includes("coupe") || n.includes("coupe")) return "Coupe";
  if (t.includes("wagon") || t.includes("sports wagon")) return "Wagon";
  if (t.includes("hatchback") || n.includes("gran turismo")) return "Hatchback";

  // Z4 is always a roadster/convertible
  if (n === "z4") return "Convertible";

  // Check raw body category
  const b = (body || "").toLowerCase();
  if (b.includes("suv") || b.includes("sport utility")) return "SUV";
  if (b.includes("two seater")) return "Convertible";
  if (b.includes("small station")) return "Wagon";

  // Check model name for M cars that are coupes
  if (n === "m4" || n === "m6" || n === "m2") return "Coupe";

  // Sedan is the fallback for compact/midsize/large
  return "Sedan";
}

function normalizeFuel(fuel: string | null): string {
  if (!fuel) return "Other";
  const f = fuel.toLowerCase();
  if (f.includes("electric") && f.includes("hybrid")) return "Hybrid";
  if (f.includes("plug-in")) return "Hybrid";
  if (f.includes("electric")) return "Electric";
  if (f.includes("diesel")) return "Diesel";
  if (
    f.includes("gasoline") ||
    f.includes("petrol") ||
    f.includes("premium")
  )
    return "Petrol";
  if (f.includes("flex")) return "Petrol";
  return "Other";
}

function normalizeDrive(drive: string | null): string {
  if (!drive) return "Other";
  const d = drive.toLowerCase();
  if (d.includes("rear")) return "RWD";
  if (d.includes("all") || d.includes("4wd") || d.includes("awd")) return "AWD";
  if (d.includes("front")) return "FWD";
  return "Other";
}
