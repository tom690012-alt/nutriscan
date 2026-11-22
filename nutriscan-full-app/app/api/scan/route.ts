import { NextRequest, NextResponse } from "next/server";
import { searchCnf, getCnfFood } from "@/lib/cnf";
import { searchFdc } from "@/lib/fdc";
import { scale, sum, Nutrition } from "@/lib/nutrition";
import { analyzeImage, readScanImage } from "@/lib/vision";

export const maxDuration = 60;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["is_food", "items"],
  properties: {
    is_food: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "search_term", "grams", "confidence"],
        properties: {
          name: { type: "string", description: "Friendly name, e.g. 'Grilled chicken breast'" },
          search_term: { type: "string", description: "1-3 plain words for a food database, e.g. 'chicken breast grilled'" },
          grams: { type: "number", description: "Estimated portion weight in grams" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
};

type DetectedFood = {
  is_food: boolean;
  items: { name: string; search_term: string; grams: number; confidence: string }[];
};

function detect(dataUrl: string) {
  return analyzeImage<DetectedFood>(dataUrl, "food_scan", schema,
    "You identify foods in photos for a nutrition app. List each distinct food or drink separately and estimate its portion weight in grams from visual cues (plate size, utensils, packaging). Do not estimate calories or nutrients. If the image has no food, set is_food to false and items to [].",
    "What foods are in this photo?");
}

// Canadian Nutrient File first, then USDA as a fallback.
async function match(term: string): Promise<Nutrition | null> {
  try {
    const hit = (await searchCnf(term, 1))[0];
    if (hit) { const f = await getCnfFood(hit.id); if (f) return f; }
  } catch {}
  try { return (await searchFdc(term, 1))[0] ?? null; } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const image = await readScanImage(req);
    if ("error" in image) return NextResponse.json({ error: image.error }, { status: image.status });
    const found = await detect(image.dataUrl);
    if (!found.is_food || !found.items.length)
      return NextResponse.json({ error: "We couldn’t spot any food in that photo. Try a closer, well-lit shot." }, { status: 422 });

    const items = await Promise.all(
      found.items.slice(0, 8).map(async (it) => {
        const m = await match(it.search_term);
        return {
          name: it.name, grams: it.grams, confidence: it.confidence,
          match: m ? { source: m.source, id: m.id, name: m.name, per100g: m.per100g } : null,
          nutrition: m ? scale(m.per100g, it.grams) : null, // null = no database match; never invented
        };
      })
    );
    return NextResponse.json({
      items,
      total: sum(items.flatMap((i) => (i.nutrition ? [i.nutrition] : []))),
      disclaimer: "Values estimated from photographs may not be exact.",
    });
  } catch {
    return NextResponse.json({ error: "Analysis failed. Please try again in a moment." }, { status: 502 });
  }
}
