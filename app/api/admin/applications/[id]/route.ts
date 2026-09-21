import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-guard";
import { getApplication } from "@/lib/applications";
import { fetchDiscordUser, fetchGuildMember } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireStaff();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const app = await getApplication(params.id);
  if (!app) return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });

  // Hent Discord-profil + medlem parallelt
  const [user, member] = await Promise.all([
    fetchDiscordUser(app.discordId).catch(() => null),
    fetchGuildMember(app.discordId).catch(() => null),
  ]);

  return NextResponse.json({ application: app, user, member });
}
