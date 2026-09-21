import { NextResponse } from "next/server";
import { requireStaffAppReader } from "@/lib/admin-guard";
import { getStaffApplication } from "@/lib/staff-applications";
import { fetchDiscordUser, fetchGuildMember } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireStaffAppReader();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const app = await getStaffApplication(params.id);
  if (!app) return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });

  if (guard.allowedTypes !== null && !guard.allowedTypes.includes(app.applicationType)) {
    return NextResponse.json({ error: "Ingen adgang til denne type" }, { status: 403 });
  }

  const [user, member] = await Promise.all([
    fetchDiscordUser(app.discordId).catch(() => null),
    fetchGuildMember(app.discordId).catch(() => null),
  ]);

  return NextResponse.json({ application: app, user, member });
}
