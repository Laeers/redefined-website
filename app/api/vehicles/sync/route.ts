import { NextRequest, NextResponse } from "next/server";
import { requireVehicleOwner, buildSyncPrompt } from "@/lib/vehicle-tuning";
import { enqueueJob, readJob, newJobId, spoolReady } from "@/lib/claude-remote";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireVehicleOwner();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const job = await readJob(id, true);
    if (!job) return NextResponse.json({ error: "Ukendt job" }, { status: 404 });
    return NextResponse.json(job);
  }
  return NextResponse.json({ ready: spoolReady() });
}

// Owner: genlæs configs + handling → opdater dokumentet (fanger nye biler).
export async function POST() {
  const guard = await requireVehicleOwner();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  if (!spoolReady()) {
    return NextResponse.json({ error: "Claude-worker ikke klar." }, { status: 503 });
  }
  const by = guard.username ?? guard.discordId;
  const id = newJobId();
  await enqueueJob({
    id,
    prompt: buildSyncPrompt(by),
    continue: false,
    submittedBy: `biltuner-sync:${by}`,
    meta: { kind: "vehicle-sync" },
  });
  return NextResponse.json({ id });
}
