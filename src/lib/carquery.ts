import { RawTrim, NormalizedTrim } from "./types";

let cached: NormalizedTrim[] | null = null;

// Special cars not in CarQuery — supercars, race cars, legends
const SPECIAL_CARS: NormalizedTrim[] = [
  // BMW Supercars
  { id: "sc-m1-1981", brand: "BMW", name: "M1", trim: "Supercar (3.5L 6cyl)", year: 1981, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 277, engineCc: 3453, cylinders: 6, torqueNm: 330 },
  { id: "sc-i8-2015", brand: "BMW", name: "i8", trim: "Plug-in Hybrid Coupe (1.5L 3cyl Turbo + Electric)", year: 2015, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 357, engineCc: 1499, cylinders: 3, torqueNm: 570 },
  { id: "sc-i8-2019", brand: "BMW", name: "i8", trim: "Roadster (1.5L 3cyl Turbo + Electric)", year: 2019, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 369, engineCc: 1499, cylinders: 3, torqueNm: 570 },
  { id: "sc-z8-2002", brand: "BMW", name: "Z8", trim: "Roadster (5.0L V8)", year: 2002, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 400, engineCc: 4941, cylinders: 8, torqueNm: 500 },
  { id: "sc-m8-2020", brand: "BMW", name: "M8 Competition", trim: "Coupe (4.4L V8 Twin-Turbo)", year: 2020, body: "Supercar", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 617, engineCc: 4395, cylinders: 8, torqueNm: 750 },
  { id: "sc-m8-conv-2020", brand: "BMW", name: "M8 Competition", trim: "Convertible (4.4L V8 Twin-Turbo)", year: 2020, body: "Supercar", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 617, engineCc: 4395, cylinders: 8, torqueNm: 750 },
  { id: "sc-3csl-2023", brand: "BMW", name: "3.0 CSL", trim: "Hommage (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 560, engineCc: 2993, cylinders: 6, torqueNm: 550 },
  { id: "sc-xm-2023", brand: "BMW", name: "XM", trim: "Label Red (4.4L V8 + Electric)", year: 2023, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 4, powerPs: 738, engineCc: 4395, cylinders: 8, torqueNm: 1000 },
  { id: "sc-m2-2023", brand: "BMW", name: "M2", trim: "Coupe (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 453, engineCc: 2993, cylinders: 6, torqueNm: 550 },
  // BMW Race Cars
  { id: "rc-m3-gtr-2001", brand: "BMW", name: "M3 GTR", trim: "Race (4.0L V8)", year: 2001, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 444, engineCc: 3997, cylinders: 8, torqueNm: 480 },
  { id: "rc-v12-lmr-1999", brand: "BMW", name: "V12 LMR", trim: "Le Mans Prototype (6.0L V12)", year: 1999, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 580, engineCc: 5990, cylinders: 12, torqueNm: 600 },
  { id: "rc-m1-procar-1979", brand: "BMW", name: "M1 Procar", trim: "Race Series (3.5L 6cyl)", year: 1979, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 470, engineCc: 3453, cylinders: 6, torqueNm: 400 },
  { id: "rc-320-rally-1977", brand: "BMW", name: "320i Group 5", trim: "Rally / Touring Car", year: 1977, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 300, engineCc: 1990, cylinders: 4, torqueNm: 280 },
  { id: "rc-m6-gt3-2022", brand: "BMW", name: "M4 GT3", trim: "Race (3.0L 6cyl Twin-Turbo)", year: 2022, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 590, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "rc-m8-gte-2018", brand: "BMW", name: "M8 GTE", trim: "WEC Race Car (4.0L V8 Turbo)", year: 2018, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 500, engineCc: 3981, cylinders: 8, torqueNm: 650 },
  { id: "rc-lmdh-2023", brand: "BMW", name: "M Hybrid V8", trim: "LMDh Prototype (4.0L V8 + Electric)", year: 2023, body: "Race Car", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 640, engineCc: 3981, cylinders: 8, torqueNm: 700 },
  { id: "sc-csl-hommage-2015", brand: "BMW", name: "3.0 CSL Hommage", trim: "Concept (3.0L 6cyl Twin-Turbo)", year: 2015, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 600, engineCc: 2979, cylinders: 6, torqueNm: 500 },

  // Porsche Supercars
  { id: "sc-918-2015", brand: "Porsche", name: "918 Spyder", trim: "Hybrid Hypercar (4.6L V8 + Electric)", year: 2015, body: "Supercar", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 887, engineCc: 4593, cylinders: 8, torqueNm: 1280 },
  { id: "sc-carrera-gt-2005", brand: "Porsche", name: "Carrera GT", trim: "V10 Supercar (5.7L V10)", year: 2005, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 612, engineCc: 5733, cylinders: 10, torqueNm: 590 },
  { id: "sc-gt2rs-2018", brand: "Porsche", name: "911 GT2 RS", trim: "Track Weapon (3.8L Flat-6 Twin-Turbo)", year: 2018, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 700, engineCc: 3800, cylinders: 6, torqueNm: 750 },
  { id: "sc-gt3rs-2023", brand: "Porsche", name: "911 GT3 RS", trim: "Naturally Aspirated (4.0L Flat-6)", year: 2023, body: "Supercar", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 525, engineCc: 3996, cylinders: 6, torqueNm: 465 },
  // Porsche Race Cars
  { id: "rc-919-2017", brand: "Porsche", name: "919 Hybrid", trim: "LMP1 Le Mans (2.0L V4 Turbo + Electric)", year: 2017, body: "Race Car", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 900, engineCc: 1998, cylinders: 4, torqueNm: 800 },
  { id: "rc-963-2023", brand: "Porsche", name: "963", trim: "LMDh Prototype (4.6L V8 + Electric)", year: 2023, body: "Race Car", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 680, engineCc: 4593, cylinders: 8, torqueNm: 700 },
  { id: "rc-911-rsr-2020", brand: "Porsche", name: "911 RSR", trim: "GTE Race Car (4.2L Flat-6)", year: 2020, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 515, engineCc: 4194, cylinders: 6, torqueNm: 480 },
  { id: "rc-935-2019", brand: "Porsche", name: "935", trim: "Club Sport (3.8L Flat-6 Twin-Turbo)", year: 2019, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 700, engineCc: 3800, cylinders: 6, torqueNm: 750 },

  // Audi Supercars
  { id: "sc-r8-v10-2020", brand: "Audi", name: "R8 V10 Performance", trim: "Supercar (5.2L V10)", year: 2020, body: "Supercar", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 620, engineCc: 5204, cylinders: 10, torqueNm: 580 },
  { id: "sc-r8-gt-2012", brand: "Audi", name: "R8 GT", trim: "Lightweight (5.2L V10)", year: 2012, body: "Supercar", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 560, engineCc: 5204, cylinders: 10, torqueNm: 540 },
  { id: "sc-etron-gt-rs-2022", brand: "Audi", name: "RS e-tron GT", trim: "Electric GT (Dual Motor)", year: 2022, body: "Supercar", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 646, engineCc: 0, cylinders: 0, torqueNm: 830 },
  // Audi Race Cars
  { id: "rc-r18-2016", brand: "Audi", name: "R18 e-tron quattro", trim: "LMP1 Le Mans (4.0L V6 TDI + Electric)", year: 2016, body: "Race Car", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 870, engineCc: 3993, cylinders: 6, torqueNm: 900 },
  { id: "rc-r8-lms-2022", brand: "Audi", name: "R8 LMS GT3", trim: "GT3 Race (5.2L V10)", year: 2022, body: "Race Car", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 585, engineCc: 5204, cylinders: 10, torqueNm: 550 },
  { id: "rc-s1-hoonitron-2022", brand: "Audi", name: "S1 Hoonitron", trim: "Electric Rally (Dual Motor)", year: 2022, body: "Race Car", fuel: "Electric", drive: "AWD", doors: 2, powerPs: 680, engineCc: 0, cylinders: 0, torqueNm: 1000 },
  { id: "rc-90-quattro-imsa-1989", brand: "Audi", name: "90 quattro IMSA GTO", trim: "IMSA Race (2.1L 5cyl Turbo)", year: 1989, body: "Race Car", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 720, engineCc: 2110, cylinders: 5, torqueNm: 650 },
];

const BRAND_MAP: Record<string, string> = {
  bmw: "BMW",
  audi: "Audi",
  porsche: "Porsche",
};

export async function fetchAllTrims(): Promise<NormalizedTrim[]> {
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

// Keep backward compat alias
export const fetchBMWTrims = fetchAllTrims;

function normalizeTrim(raw: RawTrim): NormalizedTrim {
  const makeId = (raw.model_make_id || "").toLowerCase();
  return {
    id: raw.model_id + "-" + raw.model_year + "-" + (raw.model_trim || "base"),
    brand: BRAND_MAP[makeId] || raw.model_make_id || "Unknown",
    name: raw.model_name,
    trim: raw.model_trim || "",
    year: parseInt(raw.model_year) || 0,
    body: normalizeBody(raw.model_body, raw.model_trim, raw.model_name, makeId),
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

function normalizeBody(body: string | null, trim: string | null, name: string | null, make: string): string {
  const t = (trim || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (t.includes("convertible") || t.includes("cabriolet") || t.includes("spyder") || t.includes("roadster")) return "Convertible";
  if (t.includes("coupe") || n.includes("coupe")) return "Coupe";
  if (t.includes("wagon") || t.includes("sports wagon") || t.includes("avant")) return "Wagon";
  if (t.includes("hatchback") || n.includes("gran turismo") || n.includes("sportback")) return "Hatchback";

  // Brand-specific roadsters/convertibles
  if (n === "z4" || n === "boxster" || n === "tt roadster") return "Convertible";

  const b = (body || "").toLowerCase();
  if (b.includes("suv") || b.includes("sport utility")) return "SUV";
  if (b.includes("two seater")) return "Convertible";
  if (b.includes("small station")) return "Wagon";

  // BMW M cars that are coupes
  if (make === "bmw" && (n === "m4" || n === "m6" || n === "m2")) return "Coupe";

  // Porsche models
  if (make === "porsche") {
    if (n.includes("cayenne") || n.includes("macan")) return "SUV";
    if (n.includes("panamera")) return "Sedan";
    if (n.includes("911") || n.includes("cayman") || n.includes("718")) return "Coupe";
    if (n.includes("taycan")) return "Sedan";
  }

  // Audi models
  if (make === "audi") {
    if (n.includes("q3") || n.includes("q5") || n.includes("q7") || n.includes("q8") || n.includes("e-tron")) return "SUV";
    if (n.includes("tt")) return "Coupe";
    if (n.includes("r8")) return "Coupe";
    if (n.includes("a5") || n.includes("s5") || n.includes("rs5")) {
      if (t.includes("sportback")) return "Hatchback";
      return "Coupe";
    }
  }

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
