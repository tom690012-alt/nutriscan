import { Nutrition, NUTRIENT } from "./nutrition";

// USDA FoodData Central. Branded Foods carry the UPC/GTIN, so this powers barcode lookup.
const BASE = "https://api.nal.usda.gov/fdc/v1";

type FdcNutrient = { nutrientNumber?: string; value?: number };
type FdcFood = {
  fdcId: number; description: string; brandOwner?: string; gtinUpc?: string;
  ingredients?: string; servingSize?: number; servingSizeUnit?: string;
  foodNutrients?: FdcNutrient[];
};

async function search(query: string, dataType: string, pageSize: number): Promise<FdcFood[]> {
  const key = process.env.FDC_API_KEY;
  if (!key) throw new Error("FDC_API_KEY is not set");
  const url = `${BASE}/foods/search?api_key=${key}&query=${encodeURIComponent(query)}&dataType=${dataType}&pageSize=${pageSize}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FDC request failed (${res.status})`);
  return (await res.json()).foods ?? [];
}

function map(f: FdcFood): Nutrition {
  const val = (n: number) => f.foodNutrients?.find((x) => x.nutrientNumber === String(n))?.value;
  return {
    source: "FDC", id: String(f.fdcId), name: f.description, brand: f.brandOwner,
    upc: f.gtinUpc, ingredients: f.ingredients,
    servingSize: f.servingSize ? { amount: f.servingSize, unit: f.servingSizeUnit ?? "g" } : undefined,
    per100g: {
      calories: val(NUTRIENT.calories), protein: val(NUTRIENT.protein), carbs: val(NUTRIENT.carbs),
      fat: val(NUTRIENT.fat), fiber: val(NUTRIENT.fiber), sugar: val(NUTRIENT.sugar), sodium: val(NUTRIENT.sodium),
    },
  };
}

export async function searchFdc(query: string, limit = 10) {
  return (await search(query, "Branded,Foundation,SR Legacy", limit)).map(map);
}

export async function lookupUpc(upc: string): Promise<Nutrition | null> {
  const digits = upc.replace(/\D/g, "");
  const strip = (s?: string) => (s ?? "").replace(/^0+/, "");
  const hits = await search(digits, "Branded", 10);
  const match = hits.find((f) => strip(f.gtinUpc) === strip(digits));
  return match ? map(match) : null;
}
