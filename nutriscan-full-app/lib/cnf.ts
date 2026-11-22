import { Nutrition, NUTRIENT } from "./nutrition";

// Health Canada Canadian Nutrient File (2015 publication). Generic foods only: no barcodes.
const BASE = "https://food-nutrition.canada.ca/api/canadian-nutrient-file";
const DAY = 24 * 60 * 60 * 1000;

type CnfFood = { food_code: number | string; food_description: string };
let cache: { at: number; foods: CnfFood[] } | null = null;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`CNF request failed (${res.status})`);
  return res.json();
}

// The CNF API has no server-side search, so cache the full list (~5,700 rows) and filter here.
async function allFoods(): Promise<CnfFood[]> {
  if (cache && Date.now() - cache.at < DAY) return cache.foods;
  const foods = await getJson<CnfFood[]>("food/?lang=en&type=json");
  cache = { at: Date.now(), foods };
  return foods;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export async function searchCnf(query: string, limit = 10) {
  const [incl, excl] = norm(query).split(/\bnot\b/);
  const must = incl.split(/\s+/).filter((w) => w && w !== "and");
  const not = (excl ?? "").split(/\s+/).filter(Boolean);
  if (!must.length) return [];
  const foods = await allFoods();
  return foods
    .filter((f) => {
      const d = norm(f.food_description);
      return must.every((w) => d.includes(w)) && !not.some((w) => d.includes(w));
    })
    .slice(0, limit)
    .map((f) => ({ id: String(f.food_code), name: f.food_description }));
}

export async function getCnfFood(code: string): Promise<Nutrition | null> {
  const foods = await allFoods();
  const food = foods.find((f) => String(f.food_code) === code);
  if (!food) return null;
  const rows = await getJson<{ nutrient_name_id: number; nutrient_value: number }[]>(
    `nutrientamount/?id=${code}&lang=en&type=json`
  );
  const val = (n: number) => rows.find((r) => r.nutrient_name_id === n)?.nutrient_value;
  return {
    source: "CNF", id: code, name: food.food_description,
    per100g: {
      calories: val(NUTRIENT.calories), protein: val(NUTRIENT.protein),
      carbs: val(NUTRIENT.carbs), fat: val(NUTRIENT.fat), fiber: val(NUTRIENT.fiber),
      sugar: val(NUTRIENT.sugar), sodium: val(NUTRIENT.sodium),
    },
  };
}
