// Shared shape. All values are per 100 g.
export type Nutrition = {
  source: "CNF" | "FDC";
  id: string;
  name: string;
  brand?: string;
  upc?: string;
  ingredients?: string;
  servingSize?: { amount: number; unit: string };
  per100g: {
    calories?: number; protein?: number; carbs?: number; fat?: number;
    fiber?: number; sugar?: number; sodium?: number; // sodium in mg
  };
};

// CNF and FDC share these nutrient numbers.
export const NUTRIENT = {
  calories: 208, protein: 203, fat: 204, carbs: 205,
  fiber: 291, sugar: 269, sodium: 307,
} as const;

// Scale per-100 g values to a portion in grams (also used client-side when a user edits a serving).
export function scale(per100g: Nutrition["per100g"], grams: number): Nutrition["per100g"] {
  const f = grams / 100;
  const out: Nutrition["per100g"] = {};
  for (const [k, v] of Object.entries(per100g)) {
    if (typeof v === "number") out[k as keyof Nutrition["per100g"]] = Math.round(v * f * 10) / 10;
  }
  return out;
}

export function sum(items: Nutrition["per100g"][]): Nutrition["per100g"] {
  const out: Record<string, number> = {};
  for (const it of items)
    for (const [k, v] of Object.entries(it)) if (typeof v === "number") out[k] = Math.round(((out[k] ?? 0) + v) * 10) / 10;
  return out;
}
