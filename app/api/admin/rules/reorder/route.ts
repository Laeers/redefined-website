import { NextRequest, NextResponse } from "next/server";
import { requireRulesEditor } from "@/lib/admin-guard";
import { reorderSections } from "@/lib/rules";

export const dynamic = "force-dynamic";

// POST { ids: number[] } — ny rækkefølge for sektionerne.
export async function POST(req: NextRequest) {
  const guard = await requireRulesEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const body = await req.json().catch(() => null);
  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) {
    return NextResponse.json({ error: "Ugyldig rækkefølge." }, { status: 400 });
  }
  await reorderSections(ids as number[], guard.username ?? guard.discordId);
  return NextResponse.json({ ok: true });
}
