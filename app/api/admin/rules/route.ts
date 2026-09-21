import { NextRequest, NextResponse } from "next/server";
import { requireRulesEditor } from "@/lib/admin-guard";
import {
  getAllSections,
  getRulesMeta,
  createSection,
  type SectionInput,
} from "@/lib/rules";

export const dynamic = "force-dynamic";

// GET: hele regelsættet (inkl. upublicerede) + side-header til admin-editoren.
export async function GET() {
  const guard = await requireRulesEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const [sections, meta] = await Promise.all([getAllSections(), getRulesMeta()]);
  return NextResponse.json({ sections, meta });
}

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

// POST: opret ny sektion (tilføjes nederst).
export async function POST(req: NextRequest) {
  const guard = await requireRulesEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const input = parseSection(await req.json().catch(() => null));
  if (!input) {
    return NextResponse.json(
      { error: "Sektionen mangler en titel." },
      { status: 400 }
    );
  }
  const id = await createSection(input, guard.username ?? guard.discordId);
  return NextResponse.json({ ok: true, id });
}
