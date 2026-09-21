import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getCompanySummaries } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const companies = await getCompanySummaries();
  return NextResponse.json({ companies });
}
