import { NextRequest, NextResponse } from "next/server";
import { requireRulesEditor } from "@/lib/admin-guard";
import { updateSection, deleteSection, type SectionInput } from "@/lib/rules";

export const dynamic = "force-dynamic";

function parseSection(body: unknown): SectionInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const input: SectionInput = {
    slug: str(b.slug),
    nav_label: str(b.nav_label).trim(),
    eyebrow: str(b.eyebrow).trim(),
    title: str(b.title).trim(),
    body: str(b.body),
    is_published: b.is_published !== false,
  };
  if (!input.title && !input.nav_label) return null;
  return input;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRulesEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ugyldigt id." }, { status: 400 });
  }
  const input = parseSection(await req.json().catch(() => null));
  if (!input) {
    return NextResponse.json(
      { error: "Sektionen mangler en titel." },
      { status: 400 }
    );
  }
  await updateSection(id, input, guard.username ?? guard.discordId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRulesEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ugyldigt id." }, { status: 400 });
  }
  await deleteSection(id);
  return NextResponse.json({ ok: true });
}
