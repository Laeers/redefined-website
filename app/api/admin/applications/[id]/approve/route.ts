import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-guard";
import { setApplicationStatus } from "@/lib/applications-admin";
import { getApplication } from "@/lib/applications";
import { addRole, removeRole, sendDM, fetchDiscordUser, avatarUrl } from "@/lib/discord";
import {
  WHITELIST_GRANTED_ROLE_ID,
  WHITELIST_AWAITING_INTERVIEW_ROLE_ID,
} from "@/lib/auth";
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
  if (existing.status !== "awaiting_interview") {
    return NextResponse.json(
      { error: "Kun ansøgninger der afventer samtale kan godkendes endeligt." },
      { status: 409 }
    );
  }

  const updated = await setApplicationStatus(params.id, "approved", note);
  if (!updated) {
    return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
  }

  let roleRemoved = false;
  try {
    await removeRole(params.id, WHITELIST_AWAITING_INTERVIEW_ROLE_ID);
    roleRemoved = true;
  } catch (e) {
    console.error("[admin/approve] removeRole fejlede", e);
  }

  let roleAdded = false;
  try {
    await addRole(params.id, WHITELIST_GRANTED_ROLE_ID);
    roleAdded = true;
  } catch (e) {
    console.error("[admin/approve] addRole fejlede", e);
  }

  let dmSent = false;
  try {
    dmSent = await sendDM(
      params.id,
      "Din ansøgning er blevet **godkendt**! 🎉\n\n" +
        "Du har nu fået whitelist-rollen i Discord, og du er klar til at hoppe på serveren. " +
        "Velkommen til **Redefined Roleplay** — vi glæder os til at se din karakter."
    );
  } catch (e) {
    console.error("[admin/approve] DM fejlede", e);
  }

  try {
    await sendWhitelistPublicLine(params.id, "approved");
  } catch (e) {
    console.error("[admin/approve] offentlig status fejlede", e);
  }

  try {
    const applicantUser = await fetchDiscordUser(params.id).catch(() => null);
    const applicantAvatar = applicantUser?.avatarUrl ?? avatarUrl(params.id, null);
    await sendLog({
      embeds: [
        {
          title: "Whitelist · godkendt",
          color: LOG_COLORS.approved,
          author: {
            name: `${updated.username} (${params.id})`,
            icon_url: applicantAvatar,
          },
          thumbnail: { url: applicantAvatar },
          description:
            `<@${params.id}> blev **godkendt** efter samtale af <@${guard.discordId}>.` +
            (note ? `\n\n**Note:** ${logClip(note, 800)}` : ""),
          fields: [
            { name: "Ansøger", value: `<@${params.id}>`, inline: true },
            { name: "Behandlet af", value: `<@${guard.discordId}>`, inline: true },
            { name: "Nr.", value: `#${updated.revision}`, inline: true },
            {
              name: "Afventer-samtale fjernet",
              value: roleRemoved ? "Ja" : "Nej (fejl)",
              inline: true,
            },
            { name: "WL-rolle tildelt", value: roleAdded ? "Ja" : "Nej (fejl)", inline: true },
            { name: "DM sendt", value: dmSent ? "Ja" : "Nej (fejl)", inline: true },
          ],
          footer: { text: "redefinedrp.dk · whitelist" },
          timestamp: new Date().toISOString(),
        },
      ],
      files: [
        {
          filename: `wl-${params.id}-godkendt.txt`,
          content: buildApplicationTranscript(updated),
        },
      ],
    });
  } catch (e) {
    console.error("[admin/approve] log fejlede", e);
  }

  return NextResponse.json({
    ok: true,
    application: updated,
    roleRemoved,
    roleAdded,
    dmSent,
  });
}
