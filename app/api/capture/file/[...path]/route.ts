import { NextRequest, NextResponse } from "next/server";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveSafe, mimeForExt } from "@/lib/capture-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET /api/capture/file/<sti> ───────────────────────────────────────────
// Serverer en tidligere uploadet capture-fil fra den persistente upload-mappe.
// Bruges som public URL i Discord-embeds (Discord henter direkte herfra).
//
// Filerne er ikke-hemmelige bevis-billeder/-klip med uforudsigelige (random)
// navne — ingen yderligere auth, så Discord/browsere kan loade dem.
export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const abs = resolveSafe(params.path ?? []);
  if (!abs) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  let info;
  try {
    info = await stat(abs);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!info.isFile()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ext = path.extname(abs).replace(/^\./, "");
  const data = await readFile(abs);

  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": mimeForExt(ext),
      "Content-Length": String(info.size),
      // Random-navngivne, uforanderlige filer → cache aggressivt.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
