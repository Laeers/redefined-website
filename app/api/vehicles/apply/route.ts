import { NextRequest, NextResponse } from "next/server";
import { requireVehicleOwner, buildApplyPrompt } from "@/lib/vehicle-tuning";
import { enqueueJob, readJob, newJobId, spoolReady } from "@/lib/claude-remote";

export const dynamic = "force-dynamic";

// GET ?id=... : status på et apply-job. Uden id: er worker'en klar?
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

// POST: kun owner — sæt et Claude-job i kø der anvender dokumentet på filerne.
export async function POST() {
  const guard = await requireVehicleOwner();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  if (!spoolReady()) {
    return NextResponse.json(
      { error: "Claude-worker ikke klar (/opt/claude-remote)." },
      { status: 503 }
    );
  }
  const by = guard.username ?? guard.discordId;
  const id = newJobId();
  await enqueueJob({
    id,
    prompt: buildApplyPrompt(by),
    continue: false,
    submittedBy: `biltuner:${by}`,
    meta: { kind: "vehicle-apply" },
  });
  return NextResponse.json({ id });
}
