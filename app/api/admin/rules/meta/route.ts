import { NextRequest, NextResponse } from "next/server";
import { requireRulesEditor } from "@/lib/admin-guard";
import { updateMeta, type RulesMeta } from "@/lib/rules";

export const dynamic = "force-dynamic";

const META_KEYS: (keyof RulesMeta)[] = [
  "page_eyebrow",
  "page_title",
  "page_description",
];

// PUT: opdatér side-header (eyebrow/title/description).
export async function PUT(req: NextRequest) {
  const guard = await requireRulesEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ugyldigt input." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const patch: Partial<RulesMeta> = {};
  for (const k of META_KEYS) {
    if (typeof b[k] === "string") patch[k] = (b[k] as string).trim();
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Intet at gemme." }, { status: 400 });
  }
  await updateMeta(patch, guard.username ?? guard.discordId);
  return NextResponse.json({ ok: true });
}
