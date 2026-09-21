import { NextRequest, NextResponse } from "next/server";
import {
  requireVehicleOwner,
  listAccess,
  addAccess,
  removeAccess,
} from "@/lib/vehicle-tuning";

export const dynamic = "force-dynamic";

// Kun owner (admin-rolle) kan se/ændre hvem der har redigerings-adgang.
export async function GET() {
  const guard = await requireVehicleOwner();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  return NextResponse.json({ access: await listAccess() });
}

export async function POST(req: NextRequest) {
  const guard = await requireVehicleOwner();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  let body: { discord_id?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig anmodning" }, { status: 400 });
  }
  const id = (body.discord_id ?? "").trim();
  if (!/^\d{15,21}$/.test(id)) {
    return NextResponse.json({ error: "Ugyldigt Discord-ID" }, { status: 400 });
  }
  await addAccess(id, (body.label ?? "").trim() || null, guard.username ?? guard.discordId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireVehicleOwner();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const id = req.nextUrl.searchParams.get("discord_id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Mangler discord_id" }, { status: 400 });
  await removeAccess(id);
  return NextResponse.json({ ok: true });
}
