import { NextRequest, NextResponse } from "next/server";
import { scale, type Nutrition } from "@/lib/nutrition";
import { analyzeImage, readScanImage } from "@/lib/vision";

export const maxDuration = 60;
const num = { type: ["number", "null"] };
const schema = { type: "object", additionalProperties: false, required: ["found", "name", "serving_g", "per_serving", "ingredients", "allergens"],
  properties: { found: { type: "boolean" }, name: { type: "string" }, serving_g: num, ingredients: { type: ["string", "null"] }, allergens: { type: "array", items: { type: "string" } },
    per_serving: { type: "object", additionalProperties: false, required: ["calories","protein","carbs","fat","fiber","sugar","sodium"],
      properties: { calories: num, protein: num, carbs: num, fat: num, fiber: num, sugar: num, sodium: num } } } };

type ReadLabel = {
  found: boolean;
  name: string;
  serving_g: number | null;
  per_serving: Record<keyof Nutrition["per100g"], number | null>;
  ingredients: string | null;
  allergens: string[];
};

export async function POST(req: NextRequest) {
  try {
    const image = await readScanImage(req);
    if ("error" in image) return NextResponse.json({ error: image.error }, { status: image.status });
    const label = await analyzeImage<ReadLabel>(image.dataUrl, "label", schema,
      "Read a Nutrition Facts table exactly as printed (per serving; sodium in mg). Use null for anything not visible. Never guess.",
      "Read this label.");
    if (!label.found || label.serving_g === null || label.serving_g <= 0) return NextResponse.json({ error: "Couldn’t read a Nutrition Facts table with a serving weight in grams. Try a flat, well-lit shot." }, { status: 422 });
    const nutrients = Object.fromEntries(Object.entries(label.per_serving).filter(([, value]) => typeof value === "number"));
    const per100g = scale(nutrients, 10000 / label.serving_g);
    return NextResponse.json({ source: "LABEL", name: label.name, ingredients: label.ingredients, allergens: label.allergens, servingSize: { amount: label.serving_g, unit: "g" }, per100g });
  } catch { return NextResponse.json({ error: "Label reading failed. Please try again." }, { status: 502 }); }
}
