import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-guard";
import { setApplicationStatus } from "@/lib/applications-admin";
import { getApplication } from "@/lib/applications";
import { addRole, sendDM, fetchDiscordUser, avatarUrl } from "@/lib/discord";
import { WHITELIST_AWAITING_INTERVIEW_ROLE_ID } from "@/lib/auth";
import {
  sendLog,
  sendWhitelistPublicLine,
  buildApplicationTranscript,
  LOG_COLORS,
  clip as logClip,
} from "@/lib/log-webhook";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireStaff();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { note?: string } = {};
  try {
    body = (await req.json()) as { note?: string };
  } catch {
    /* ok */
  }
  const note = (body.note ?? "").trim() || null;

  const existing = await getApplication(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: "Kun afventende ansøgninger kan indkaldes til samtale." },
      { status: 409 }
    );
  }

  const updated = await setApplicationStatus(params.id, "awaiting_interview", note);
  if (!updated) {
    return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
  }

  let roleAdded = false;
  try {
    await addRole(params.id, WHITELIST_AWAITING_INTERVIEW_ROLE_ID);
    roleAdded = true;
  } catch (e) {
    console.error("[admin/interview] addRole fejlede", e);
  }

  let dmSent = false;
  try {
    dmSent = await sendDM(
      params.id,
      "Du er blevet **indkaldt til en snak** om din whitelist-ansøgning.\n\n" +
        "En staffer vil kontakte dig på Discord, så I kan tage en kort samtale. " +
        "Når samtalen er overstået, får du besked her, hvis du er godkendt til serveren."
    );
  } catch (e) {
    console.error("[admin/interview] DM fejlede", e);
  }

  try {
    await sendWhitelistPublicLine(params.id, "interview_invited");
  } catch (e) {
    console.error("[admin/interview] offentlig status fejlede", e);
  }

  try {
    const applicantUser = await fetchDiscordUser(params.id).catch(() => null);
    const applicantAvatar = applicantUser?.avatarUrl ?? avatarUrl(params.id, null);
    await sendLog({
      embeds: [
        {
          title: "Whitelist · indkaldt til samtale",
          color: LOG_COLORS.pending,
          author: {
            name: `${updated.username} (${params.id})`,
            icon_url: applicantAvatar,
          },
          thumbnail: { url: applicantAvatar },
          description:
            `<@${params.id}> er **indkaldt til samtale** af <@${guard.discordId}>.` +
            (note ? `\n\n**Note:** ${logClip(note, 800)}` : ""),
          fields: [
            { name: "Ansøger", value: `<@${params.id}>`, inline: true },
            { name: "Behandlet af", value: `<@${guard.discordId}>`, inline: true },
            { name: "Nr.", value: `#${updated.revision}`, inline: true },
            { name: "Rolle tildelt", value: roleAdded ? "Ja" : "Nej (fejl)", inline: true },
            { name: "DM sendt", value: dmSent ? "Ja" : "Nej (fejl)", inline: true },
          ],
          footer: { text: "redefinedrp.dk · whitelist" },
          timestamp: new Date().toISOString(),
        },
      ],
      files: [
        {
          filename: `wl-${params.id}-samtale.txt`,
          content: buildApplicationTranscript(updated),
        },
      ],
    });
  } catch (e) {
    console.error("[admin/interview] log fejlede", e);
  }

  return NextResponse.json({
    ok: true,
    application: updated,
    roleAdded,
    dmSent,
  });
}
