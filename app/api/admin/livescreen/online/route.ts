import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getOnline } from "@/lib/livescreen";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const players = await getOnline();
    return NextResponse.json({ players });
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke nå spilserveren", players: [] },
      { status: 502 },
    );
  }
}
