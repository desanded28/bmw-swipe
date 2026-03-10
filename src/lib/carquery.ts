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

  // === 2023-2025 Models (not in CarQuery API) ===

  // BMW 2023
  { id: "new-bmw-i4-m50-2023", brand: "BMW", name: "i4 M50", trim: "Electric Gran Coupe (Dual Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 544, engineCc: 0, cylinders: 0, torqueNm: 795 },
  { id: "new-bmw-i4-edrive40-2023", brand: "BMW", name: "i4 eDrive40", trim: "Electric Gran Coupe (Single Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "RWD", doors: 4, powerPs: 340, engineCc: 0, cylinders: 0, torqueNm: 430 },
  { id: "new-bmw-ix-xdrive50-2023", brand: "BMW", name: "iX xDrive50", trim: "Electric SUV (Dual Motor)", year: 2023, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 523, engineCc: 0, cylinders: 0, torqueNm: 765 },
  { id: "new-bmw-ix-m60-2023", brand: "BMW", name: "iX M60", trim: "Electric SUV (Dual Motor)", year: 2023, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 619, engineCc: 0, cylinders: 0, torqueNm: 1100 },
  { id: "new-bmw-i7-xdrive60-2023", brand: "BMW", name: "i7 xDrive60", trim: "Electric Sedan (Dual Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 544, engineCc: 0, cylinders: 0, torqueNm: 745 },
  { id: "new-bmw-x1-2023", brand: "BMW", name: "X1", trim: "xDrive28i (2.0L 4cyl Turbo)", year: 2023, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 241, engineCc: 1998, cylinders: 4, torqueNm: 400 },
  { id: "new-bmw-x5-2023", brand: "BMW", name: "X5", trim: "xDrive40i (3.0L 6cyl Turbo)", year: 2023, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 375, engineCc: 2998, cylinders: 6, torqueNm: 520 },
  { id: "new-bmw-x7-2023", brand: "BMW", name: "X7", trim: "xDrive40i (3.0L 6cyl Turbo)", year: 2023, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 375, engineCc: 2998, cylinders: 6, torqueNm: 520 },
  { id: "new-bmw-m3-2023", brand: "BMW", name: "M3", trim: "Competition (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Sedan", fuel: "Petrol", drive: "RWD", doors: 4, powerPs: 510, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "new-bmw-m3-touring-2023", brand: "BMW", name: "M3 Touring", trim: "Competition xDrive (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Wagon", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 510, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "new-bmw-m4-2023", brand: "BMW", name: "M4", trim: "Competition (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 510, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "new-bmw-m4-csl-2023", brand: "BMW", name: "M4 CSL", trim: "Lightweight (3.0L 6cyl Twin-Turbo)", year: 2023, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 550, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "new-bmw-330i-2023", brand: "BMW", name: "3 Series", trim: "330i (2.0L 4cyl Turbo)", year: 2023, body: "Sedan", fuel: "Petrol", drive: "RWD", doors: 4, powerPs: 255, engineCc: 1998, cylinders: 4, torqueNm: 400 },
  { id: "new-bmw-m340i-2023", brand: "BMW", name: "3 Series", trim: "M340i xDrive (3.0L 6cyl Turbo)", year: 2023, body: "Sedan", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 382, engineCc: 2998, cylinders: 6, torqueNm: 500 },

  // BMW 2024
  { id: "new-bmw-m2-2024", brand: "BMW", name: "M2", trim: "Coupe (3.0L 6cyl Twin-Turbo)", year: 2024, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 473, engineCc: 2993, cylinders: 6, torqueNm: 550 },
  { id: "new-bmw-m4-2024", brand: "BMW", name: "M4", trim: "Competition xDrive (3.0L 6cyl Twin-Turbo)", year: 2024, body: "Coupe", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 523, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "new-bmw-i5-m60-2024", brand: "BMW", name: "i5 M60", trim: "Electric Sedan (Dual Motor)", year: 2024, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 601, engineCc: 0, cylinders: 0, torqueNm: 820 },
  { id: "new-bmw-i5-edrive40-2024", brand: "BMW", name: "i5 eDrive40", trim: "Electric Sedan (Single Motor)", year: 2024, body: "Sedan", fuel: "Electric", drive: "RWD", doors: 4, powerPs: 340, engineCc: 0, cylinders: 0, torqueNm: 430 },
  { id: "new-bmw-x5-m60i-2024", brand: "BMW", name: "X5", trim: "M60i xDrive (4.4L V8 Twin-Turbo)", year: 2024, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 530, engineCc: 4395, cylinders: 8, torqueNm: 750 },
  { id: "new-bmw-x6-m60i-2024", brand: "BMW", name: "X6", trim: "M60i xDrive (4.4L V8 Twin-Turbo)", year: 2024, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 530, engineCc: 4395, cylinders: 8, torqueNm: 750 },
  { id: "new-bmw-ix2-2024", brand: "BMW", name: "iX2 xDrive30", trim: "Electric Coupe SUV (Dual Motor)", year: 2024, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 313, engineCc: 0, cylinders: 0, torqueNm: 494 },
  { id: "new-bmw-5series-2024", brand: "BMW", name: "5 Series", trim: "530i xDrive (2.0L 4cyl Turbo)", year: 2024, body: "Sedan", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 255, engineCc: 1998, cylinders: 4, torqueNm: 400 },
  { id: "new-bmw-m5-2024", brand: "BMW", name: "M5", trim: "PHEV (4.4L V8 Twin-Turbo + Electric)", year: 2024, body: "Sedan", fuel: "Hybrid", drive: "AWD", doors: 4, powerPs: 717, engineCc: 4395, cylinders: 8, torqueNm: 1000 },

  // BMW 2025
  { id: "new-bmw-m2-cs-2025", brand: "BMW", name: "M2 CS", trim: "Coupe (3.0L 6cyl Twin-Turbo)", year: 2025, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 550, engineCc: 2993, cylinders: 6, torqueNm: 650 },
  { id: "new-bmw-ix3-2025", brand: "BMW", name: "iX3", trim: "Electric SUV (Dual Motor)", year: 2025, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 394, engineCc: 0, cylinders: 0, torqueNm: 640 },
  { id: "new-bmw-x3-2025", brand: "BMW", name: "X3", trim: "30 xDrive (2.0L 4cyl Turbo Mild Hybrid)", year: 2025, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 258, engineCc: 1998, cylinders: 4, torqueNm: 400 },
  { id: "new-bmw-x3-m50-2025", brand: "BMW", name: "X3 M50", trim: "xDrive (3.0L 6cyl Turbo Mild Hybrid)", year: 2025, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 398, engineCc: 2998, cylinders: 6, torqueNm: 580 },

  // Porsche 2023-2025
  { id: "new-porsche-taycan-2023", brand: "Porsche", name: "Taycan", trim: "Turbo S (Dual Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 761, engineCc: 0, cylinders: 0, torqueNm: 1050 },
  { id: "new-porsche-taycan-4s-2023", brand: "Porsche", name: "Taycan", trim: "4S (Dual Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 530, engineCc: 0, cylinders: 0, torqueNm: 640 },
  { id: "new-porsche-taycan-ct-2023", brand: "Porsche", name: "Taycan Cross Turismo", trim: "4S (Dual Motor)", year: 2023, body: "Wagon", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 490, engineCc: 0, cylinders: 0, torqueNm: 640 },
  { id: "new-porsche-cayenne-2024", brand: "Porsche", name: "Cayenne", trim: "Coupe (3.0L V6 Turbo)", year: 2024, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 353, engineCc: 2995, cylinders: 6, torqueNm: 500 },
  { id: "new-porsche-cayenne-turbo-gt-2024", brand: "Porsche", name: "Cayenne Turbo GT", trim: "Coupe (4.0L V8 Twin-Turbo)", year: 2024, body: "SUV", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 659, engineCc: 3996, cylinders: 8, torqueNm: 850 },
  { id: "new-porsche-macan-ev-2024", brand: "Porsche", name: "Macan Electric", trim: "4 (Dual Motor)", year: 2024, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 408, engineCc: 0, cylinders: 0, torqueNm: 650 },
  { id: "new-porsche-macan-turbo-ev-2024", brand: "Porsche", name: "Macan Turbo Electric", trim: "Turbo (Dual Motor)", year: 2024, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 639, engineCc: 0, cylinders: 0, torqueNm: 1130 },
  { id: "new-porsche-911-992-2024", brand: "Porsche", name: "911", trim: "Carrera (3.0L Flat-6 Twin-Turbo)", year: 2024, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 394, engineCc: 2981, cylinders: 6, torqueNm: 450 },
  { id: "new-porsche-911-turbo-s-2024", brand: "Porsche", name: "911 Turbo S", trim: "Coupe (3.7L Flat-6 Twin-Turbo)", year: 2024, body: "Coupe", fuel: "Petrol", drive: "AWD", doors: 2, powerPs: 650, engineCc: 3745, cylinders: 6, torqueNm: 800 },
  { id: "new-porsche-718-cayman-gt4rs-2024", brand: "Porsche", name: "718 Cayman GT4 RS", trim: "Coupe (4.0L Flat-6)", year: 2024, body: "Coupe", fuel: "Petrol", drive: "RWD", doors: 2, powerPs: 500, engineCc: 3996, cylinders: 6, torqueNm: 450 },
  { id: "new-porsche-panamera-2024", brand: "Porsche", name: "Panamera", trim: "Turbo S E-Hybrid (4.0L V8 + Electric)", year: 2024, body: "Sedan", fuel: "Hybrid", drive: "AWD", doors: 4, powerPs: 748, engineCc: 3996, cylinders: 8, torqueNm: 1000 },
  { id: "new-porsche-taycan-2025", brand: "Porsche", name: "Taycan", trim: "Turbo S (Dual Motor, Updated)", year: 2025, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 952, engineCc: 0, cylinders: 0, torqueNm: 1110 },
  { id: "new-porsche-911-hybrid-2025", brand: "Porsche", name: "911 Carrera GTS", trim: "T-Hybrid (3.6L Flat-6 Turbo + Electric)", year: 2025, body: "Coupe", fuel: "Hybrid", drive: "AWD", doors: 2, powerPs: 541, engineCc: 3600, cylinders: 6, torqueNm: 610 },

  // Audi 2023-2025
  { id: "new-audi-etron-gt-2023", brand: "Audi", name: "e-tron GT", trim: "quattro (Dual Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 476, engineCc: 0, cylinders: 0, torqueNm: 630 },
  { id: "new-audi-rs-etron-gt-2023", brand: "Audi", name: "RS e-tron GT", trim: "Performance (Dual Motor)", year: 2023, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 646, engineCc: 0, cylinders: 0, torqueNm: 830 },
  { id: "new-audi-q8-etron-2023", brand: "Audi", name: "Q8 e-tron", trim: "55 quattro (Dual Motor)", year: 2023, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 408, engineCc: 0, cylinders: 0, torqueNm: 664 },
  { id: "new-audi-q4-etron-2023", brand: "Audi", name: "Q4 e-tron", trim: "50 quattro (Dual Motor)", year: 2023, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 299, engineCc: 0, cylinders: 0, torqueNm: 460 },
  { id: "new-audi-rs3-2023", brand: "Audi", name: "RS 3", trim: "Sedan (2.5L 5cyl Turbo)", year: 2023, body: "Sedan", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 401, engineCc: 2480, cylinders: 5, torqueNm: 500 },
  { id: "new-audi-rs6-avant-2024", brand: "Audi", name: "RS 6 Avant", trim: "Performance (4.0L V8 Twin-Turbo)", year: 2024, body: "Wagon", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 630, engineCc: 3996, cylinders: 8, torqueNm: 850 },
  { id: "new-audi-rs7-2024", brand: "Audi", name: "RS 7", trim: "Performance (4.0L V8 Twin-Turbo)", year: 2024, body: "Sedan", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 630, engineCc: 3996, cylinders: 8, torqueNm: 850 },
  { id: "new-audi-q6-etron-2024", brand: "Audi", name: "Q6 e-tron", trim: "quattro (Dual Motor)", year: 2024, body: "SUV", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 382, engineCc: 0, cylinders: 0, torqueNm: 560 },
  { id: "new-audi-a5-2025", brand: "Audi", name: "A5", trim: "Sedan (2.0L 4cyl Turbo MHEV)", year: 2025, body: "Sedan", fuel: "Petrol", drive: "FWD", doors: 4, powerPs: 204, engineCc: 1984, cylinders: 4, torqueNm: 340 },
  { id: "new-audi-s5-2025", brand: "Audi", name: "S5", trim: "Sedan (3.0L V6 Turbo MHEV)", year: 2025, body: "Sedan", fuel: "Petrol", drive: "AWD", doors: 4, powerPs: 367, engineCc: 2995, cylinders: 6, torqueNm: 550 },
  { id: "new-audi-rs-etron-gt-2025", brand: "Audi", name: "RS e-tron GT", trim: "Performance (Tri Motor)", year: 2025, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 925, engineCc: 0, cylinders: 0, torqueNm: 1027 },
  { id: "new-audi-a6-etron-2025", brand: "Audi", name: "A6 e-tron", trim: "quattro (Dual Motor)", year: 2025, body: "Sedan", fuel: "Electric", drive: "AWD", doors: 4, powerPs: 462, engineCc: 0, cylinders: 0, torqueNm: 580 },
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
