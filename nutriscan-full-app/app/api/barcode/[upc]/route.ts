import { NextResponse } from "next/server";
import { lookupUpc } from "@/lib/fdc";

export async function GET(_: Request, { params }: { params: Promise<{ upc: string }> }) {
  const { upc } = await params;
  if (!/^\d{8,14}$/.test(upc)) return NextResponse.json({ error: "That doesn’t look like a valid barcode." }, { status: 400 });
  try {
    const food = await lookupUpc(upc);
    if (!food) return NextResponse.json({ error: "Product not found in the USDA database. Try scanning the Nutrition Facts label instead." }, { status: 404 });
    return NextResponse.json(food);
  } catch (e) {
    return NextResponse.json({ error: "Barcode lookup is unavailable right now." }, { status: 502 });
  }
}
