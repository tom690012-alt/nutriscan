import { NextRequest, NextResponse } from "next/server";
import { searchCnf } from "@/lib/cnf";
import { searchFdc } from "@/lib/fdc";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ error: "Enter at least 2 characters." }, { status: 400 });
  const [cnf, fdc] = await Promise.allSettled([searchCnf(q), searchFdc(q)]);
  return NextResponse.json({
    canadian: cnf.status === "fulfilled" ? cnf.value : [],
    usda: fdc.status === "fulfilled" ? fdc.value : [],
    errors: [cnf, fdc].flatMap((r) => (r.status === "rejected" ? [String(r.reason)] : [])),
  });
}
