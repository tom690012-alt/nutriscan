import { NextResponse } from "next/server";
import { getCnfFood } from "@/lib/cnf";
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const f = await getCnfFood(code);
    return f ? NextResponse.json(f) : NextResponse.json({ error: "Food not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Canadian Nutrient File is unavailable right now." }, { status: 502 }); }
}
