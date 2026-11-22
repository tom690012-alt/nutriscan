import { NextRequest, NextResponse } from "next/server";
import { scale } from "@/lib/nutrition";
const num = { type: ["number", "null"] };
const schema = { type: "object", additionalProperties: false, required: ["found", "name", "serving_g", "per_serving", "ingredients", "allergens"],
  properties: { found: { type: "boolean" }, name: { type: "string" }, serving_g: num, ingredients: { type: ["string", "null"] }, allergens: { type: "array", items: { type: "string" } },
    per_serving: { type: "object", additionalProperties: false, required: ["calories","protein","carbs","fat","fiber","sugar","sodium"],
      properties: { calories: num, protein: num, carbs: num, fat: num, fiber: num, sugar: num, sodium: num } } } };

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Label reader isn’t configured yet." }, { status: 500 });
  const file = (await req.formData()).get("image");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "Please upload an image." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "That image is over 8 MB." }, { status: 413 });
  try {
    const url = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o",
        response_format: { type: "json_schema", json_schema: { name: "label", strict: true, schema } },
        messages: [{ role: "system", content: "Read a Canadian Nutrition Facts table exactly as printed (per serving; sodium in mg). Use null for anything not visible. Never guess." },
          { role: "user", content: [{ type: "text", text: "Read this label." }, { type: "image_url", image_url: { url } }] }] }) });
    if (!res.ok) throw new Error();
    const d = JSON.parse((await res.json()).choices[0].message.content);
    if (!d.found || !(d.serving_g > 0)) return NextResponse.json({ error: "Couldn’t read a Nutrition Facts table. Try a flat, well-lit shot." }, { status: 422 });
    const per100g = scale(Object.fromEntries(Object.entries(d.per_serving).filter(([, v]) => typeof v === "number")) as any, 10000 / d.serving_g);
    return NextResponse.json({ source: "LABEL", name: d.name, ingredients: d.ingredients, allergens: d.allergens, servingSize: { amount: d.serving_g, unit: "g" }, per100g });
  } catch { return NextResponse.json({ error: "Label reading failed. Please try again." }, { status: 502 }); }
}
