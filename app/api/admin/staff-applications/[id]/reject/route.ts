import { NextResponse } from "next/server";
import { requireStaffAppReader } from "@/lib/admin-guard";
import { setStaffApplicationStatus } from "@/lib/staff-applications-admin";
import { getStaffApplication } from "@/lib/staff-applications";

export const dynamic = "force-dynamic";

/**
 * Markér staff-ansøgning som afvist. Der sendes IKKE DM, og der
 * broadcastes ikke noget — staff kontakter selv ansøgeren.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireStaffAppReader();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  if (guard.allowedTypes !== null) {
    const app = await getStaffApplication(params.id);
    if (app && !guard.allowedTypes.includes(app.applicationType)) {
      return NextResponse.json({ error: "Ingen adgang til denne type" }, { status: 403 });
    }
  }

  let body: { note?: string } = {};
  try {
    body = (await req.json()) as { note?: string };
  } catch {
    /* tom body ok */
  }
  const note = (body.note ?? "").trim() || null;

  const updated = await setStaffApplicationStatus(params.id, "rejected", note);
  if (!updated) {
    return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, application: updated });
}
