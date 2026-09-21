import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getGangMembers } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { job: string } }
) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const job = decodeURIComponent(params.job);
  const data = await getGangMembers(job);
  if (!data) {
    return NextResponse.json({ error: "Ukendt bande." }, { status: 404 });
  }
  return NextResponse.json(data);
}
