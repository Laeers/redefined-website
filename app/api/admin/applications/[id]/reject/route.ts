import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-guard";
import { setApplicationStatus } from "@/lib/applications-admin";
import { getApplication } from "@/lib/applications";
import { removeRole, sendDM, fetchDiscordUser, avatarUrl } from "@/lib/discord";
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

  const updated = await setApplicationStatus(params.id, "rejected", note);
  if (!updated) {
    return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
  }

  if (existing.status === "awaiting_interview") {
    try {
      await removeRole(params.id, WHITELIST_AWAITING_INTERVIEW_ROLE_ID);
    } catch (e) {
      console.error("[admin/reject] removeRole fejlede", e);
    }
  }

  let dmSent = false;
  try {
    const reason = note ? `\n\n**Begrundelse:** ${note}` : "";
    dmSent = await sendDM(
      params.id,
      `Din ansøgning er desværre blevet **afvist**.${reason}\n\n` +
        "Du er velkommen til at sende en ny ansøgning ind via " +
        "https://redefinedrp.dk/whitelist når du er klar."
    );
  } catch (e) {
    console.error("[admin/reject] DM fejlede", e);
  }

  try {
    await sendWhitelistPublicLine(params.id, "rejected");
  } catch (e) {
    console.error("[admin/reject] offentlig status fejlede", e);
  }

  try {
    const applicantUser = await fetchDiscordUser(params.id).catch(() => null);
    const applicantAvatar = applicantUser?.avatarUrl ?? avatarUrl(params.id, null);
    await sendLog({
      embeds: [
        {
          title: "Whitelist · afvist",
          color: LOG_COLORS.rejected,
          author: {
            name: `${updated.username} (${params.id})`,
            icon_url: applicantAvatar,
          },
          thumbnail: { url: applicantAvatar },
          description:
            `<@${params.id}> blev **afvist** af <@${guard.discordId}>.` +
            (note ? `\n\n**Begrundelse:** ${logClip(note, 800)}` : ""),
          fields: [
            { name: "Ansøger", value: `<@${params.id}>`, inline: true },
            { name: "Behandlet af", value: `<@${guard.discordId}>`, inline: true },
            { name: "Nr.", value: `#${updated.revision}`, inline: true },
            { name: "DM sendt", value: dmSent ? "Ja" : "Nej (fejl)", inline: true },
          ],
          footer: { text: "redefinedrp.dk · whitelist" },
          timestamp: new Date().toISOString(),
        },
      ],
      files: [
        {
          filename: `wl-${params.id}-afvist.txt`,
          content: buildApplicationTranscript(updated),
        },
      ],
    });
  } catch (e) {
    console.error("[admin/reject] log fejlede", e);
  }

  return NextResponse.json({ ok: true, application: updated, dmSent });
}
