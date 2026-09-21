import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { watch, stopWatch } from "@/lib/livescreen";

export const dynamic = "force-dynamic";

// POST { serverId, stop? }
//   stop !== true  → forny/start watch, returnér nyeste frame-URL
//   stop === true  → stop watch
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    serverId?: number | string;
    stop?: boolean;
  };
  const serverId = Number(body.serverId);
  if (!serverId) {
    return NextResponse.json({ error: "serverId mangler" }, { status: 400 });
  }

  if (body.stop) {
    await stopWatch(serverId);
    return NextResponse.json({ ok: true });
  }

  try {
    const r = await watch(serverId, guard.discordId, guard.username);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "Kunne ikke nå spilserveren" }, { status: 502 });
  }
}
