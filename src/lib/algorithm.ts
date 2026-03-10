import { NormalizedTrim, SwipeRound, AttributeKey } from "./types";

interface AttributeConfig {
  key: AttributeKey;
  type: "categorical" | "numeric";
  label: string;
  unit?: string;
}

// Categorical rounds go first (one-time), then numeric rounds repeat as needed
const CATEGORICAL_ATTRS: AttributeConfig[] = [
  { key: "brand", type: "categorical", label: "Which brand?" },
  { key: "body", type: "categorical", label: "What body style?" },
  { key: "fuel", type: "categorical", label: "What fuel type?" },
  { key: "drive", type: "categorical", label: "What drivetrain?" },
  { key: "doors", type: "categorical", label: "How many doors?" },
];

const NUMERIC_ATTRS: AttributeConfig[] = [
  { key: "powerPs", type: "numeric", label: "How much power?", unit: "hp" },
  { key: "torqueNm", type: "numeric", label: "How much torque?", unit: "Nm" },
  { key: "engineCc", type: "numeric", label: "What engine size?", unit: "cc" },
  { key: "cylinders", type: "numeric", label: "How many cylinders?", unit: "cyl" },
  { key: "year", type: "numeric", label: "How new?", unit: "" },
];

/**
 * Get the next round. Completed attributes (answered or skipped) are never reused.
 * If many distinct models remain after all attributes, offer a model name picker.
 */
export function getNextRound(
  cars: NormalizedTrim[],
  completedAttributes: AttributeKey[],
): SwipeRound | null {
  if (cars.length <= 3) return null;

  // Phase 1: remaining categorical rounds
  for (const attr of CATEGORICAL_ATTRS) {
    if (completedAttributes.includes(attr.key)) continue;
    const values = cars.map((c) => String(c[attr.key as keyof NormalizedTrim]));
    const unique = [...new Set(values)].filter((v) => v !== "Other");
    if (unique.length <= 1) continue;

    return {
      type: "categorical",
      attribute: attr.key,
      label: attr.label,
      options: unique.sort(),
    };
  }

  // Phase 2: remaining numeric attributes
  for (const attr of NUMERIC_ATTRS) {
    if (completedAttributes.includes(attr.key)) continue;
    const values = cars
      .map((c) => c[attr.key as keyof NormalizedTrim] as number | null)
      .filter((v): v is number => v !== null);
    if (values.length < 2) continue;

    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const above = values.filter((v) => v >= median).length;
    const below = values.filter((v) => v < median).length;
    if (above === 0 || below === 0) continue;

    return {
      type: "numeric",
      attribute: attr.key,
      label: attr.label,
      unit: attr.unit || "",
      median,
    };
  }

  // Phase 3: if still >3, offer model name picker
  const modelNames = [...new Set(cars.map((c) => c.name))].sort();
  if (modelNames.length > 1) {
    return {
      type: "categorical",
      attribute: "name" as AttributeKey,
      label: "Which model?",
      options: modelNames,
    };
  }

  return null;
}

export function applyNumericChoice(
  cars: NormalizedTrim[],
  attribute: AttributeKey,
  direction: "more" | "less",
  median: number
): NormalizedTrim[] {
  return cars.filter((c) => {
    const val = c[attribute as keyof NormalizedTrim] as number | null;
    if (val === null) return true;
    return direction === "more" ? val >= median : val < median;
  });
}

export function applyCategoricalChoice(
  cars: NormalizedTrim[],
  attribute: AttributeKey,
  selected: string[]
): NormalizedTrim[] {
  if (attribute === ("name" as AttributeKey)) {
    return cars.filter((c) => selected.includes(c.name));
  }
  return cars.filter((c) => {
    const val = String(c[attribute as keyof NormalizedTrim]);
    return selected.includes(val) || val === "Other";
  });
}
