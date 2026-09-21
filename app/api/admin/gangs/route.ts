import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getGangSummaries } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const gangs = await getGangSummaries();
  return NextResponse.json({ gangs });
}
