export interface RawTrim {
  model_id: string;
  model_make_id: string;
  model_name: string;
  model_trim: string;
  model_year: string;
  model_body: string;
  model_engine_cc: string | null;
  model_engine_cyl: string | null;
  model_engine_power_ps: string | null;
  model_engine_torque_nm: string | null;
  model_engine_fuel: string | null;
  model_drive: string | null;
  model_doors: string | null;
  model_transmission_type: string | null;
}

export interface NormalizedTrim {
  id: string;
  brand: string;
  name: string;
  trim: string;
  year: number;
  body: string;
  fuel: string;
  drive: string;
  doors: number;
  powerPs: number | null;
  engineCc: number | null;
  cylinders: number | null;
  torqueNm: number | null;
}

export type AttributeKey =
  | "brand"
  | "body"
  | "fuel"
  | "drive"
  | "doors"
  | "powerPs"
  | "torqueNm"
  | "engineCc"
  | "cylinders"
  | "year"
  | "name";

export interface CategoricalRound {
  type: "categorical";
  attribute: AttributeKey;
  label: string;
  options: string[];
}

export interface NumericRound {
  type: "numeric";
  attribute: AttributeKey;
  label: string;
  unit: string;
  median: number;
}

export type SwipeRound = CategoricalRound | NumericRound;

export interface SwipeState {
  remainingCars: NormalizedTrim[];
  completedAttributes: AttributeKey[];
  currentRound: SwipeRound | null;
  history: { attribute: AttributeKey; choice: string }[];
}
