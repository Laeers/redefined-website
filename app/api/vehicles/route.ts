import { NextRequest, NextResponse } from "next/server";
import {
  requireVehicleEditor,
  getOverview,
  updateRow,
} from "@/lib/vehicle-tuning";

export const dynamic = "force-dynamic";

// GET: hele overblikket (vehicleshop + politi + ambulance) — for editors + owner.
export async function GET() {
  const guard = await requireVehicleEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const rows = await getOverview();
  return NextResponse.json({ rows, isOwner: guard.isOwner, me: guard.discordId });
}

// PATCH: redigér en bils ønskede pris og/eller topfart (skriver til kladden).
export async function PATCH(req: NextRequest) {
  const guard = await requireVehicleEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { model?: string; price?: unknown; target_kmh?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig anmodning" }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) return NextResponse.json({ error: "Mangler model" }, { status: 400 });

  const toIntOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const price = toIntOrNull(body.price);
  const kmh = toIntOrNull(body.target_kmh);
  if (kmh !== null && (kmh < 30 || kmh > 500)) {
    return NextResponse.json({ error: "Topfart skal være 30–500 km/t" }, { status: 400 });
  }

  await updateRow(model, price, kmh, guard.username ?? guard.discordId);
  return NextResponse.json({ ok: true });
}
