import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Application,
  getApplication,
  saveApplication,
} from "@/lib/applications";
import { sendDM, fetchDiscordUser, avatarUrl } from "@/lib/discord";
import {
  sendLog,
  sendWhitelistPublicLine,
  buildApplicationTranscript,
  LOG_COLORS,
  clip as logClip,
} from "@/lib/log-webhook";

export const dynamic = "force-dynamic";

type Payload = {
  age?: string;
  steamHours?: string;
  realName?: string;
  charName?: string;
  charBackstory?: string;
  rpExperience?: string;
  scenario?: string;
  agree?: boolean;
};

const REQUIRED: (keyof Payload)[] = [
  "age",
  "steamHours",
  "realName",
  "charName",
  "charBackstory",
  "rpExperience",
  "scenario",
];

function validate(body: Payload): string | null {
  for (const f of REQUIRED) {
    if (!body[f] || !String(body[f]).trim()) return `Mangler felt: ${f}`;
  }
  if (!body.agree) return "Reglerne skal accepteres";
  return null;
}

async function readSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user as
    | { name?: string; email?: string; username?: string; discordId?: string }
    | undefined;
}

export async function GET() {
  const user = await readSessionUser();
  if (!user?.discordId) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }
  const app = await getApplication(user.discordId);
  return NextResponse.json({ application: app });
}

export async function POST(req: Request) {
  return upsert(req, /* allowExisting */ false);
}

export async function PUT(req: Request) {
  return upsert(req, /* allowExisting */ true);
}

async function upsert(req: Request, allowExisting: boolean) {
  const user = await readSessionUser();
  if (!user?.discordId) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const existing = await getApplication(user.discordId);

  if (!allowExisting && existing && existing.status !== "changes_requested") {
    return NextResponse.json(
      { error: "Du har allerede en ansøgning. Brug Dashboard til at redigere." },
      { status: 409 }
    );
  }

  if (existing?.status === "approved" || existing?.status === "awaiting_interview") {
    return NextResponse.json(
      {
        error:
          existing.status === "approved"
            ? "Din ansøgning er allerede godkendt."
            : "Din ansøgning afventer samtale og kan ikke redigeres.",
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const isUpdate = Boolean(existing);
  const app: Application = {
    discordId: user.discordId,
    username: user.username ?? user.name ?? "ukendt",
    age: String(body.age ?? "").trim(),
    steamHours: String(body.steamHours ?? "").trim(),
    realName: String(body.realName ?? "").trim(),
    charName: String(body.charName ?? "").trim(),
    charBackstory: String(body.charBackstory ?? "").trim(),
    rpExperience: String(body.rpExperience ?? "").trim(),
    scenario: String(body.scenario ?? "").trim(),
    agree: Boolean(body.agree),
    status: existing?.status === "rejected" ? "pending" : existing?.status ?? "pending",
    staffNote: existing?.staffNote,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revision: (existing?.revision ?? 0) + 1,
  };

  // Hvis brugeren havde fået "changes_requested", går den tilbage til pending efter ny submit.
  if (existing?.status === "changes_requested") app.status = "pending";

  try {
    await saveApplication(app);
  } catch (e) {
    console.error("[whitelist] save failed", e);
    return NextResponse.json({ error: "Kunne ikke gemme ansøgning" }, { status: 500 });
  }

  if (!isUpdate) {
    try {
      await sendWhitelistPublicLine(app.discordId, "received");
    } catch (e) {
      console.error("[whitelist] offentlig status (modtaget) fejlede", e);
    }
  }

  try {
    const user = await fetchDiscordUser(app.discordId).catch(() => null);
    const avatar = user?.avatarUrl ?? avatarUrl(app.discordId, null);
    await sendLog({
      embeds: [
        {
          title: isUpdate
            ? "Whitelist-ansøgning opdateret"
            : "Ny whitelist-ansøgning",
          color: isUpdate ? LOG_COLORS.info : LOG_COLORS.pending,
          author: { name: `${app.username} (${app.discordId})`, icon_url: avatar },
          thumbnail: { url: avatar },
          description: isUpdate
            ? `<@${app.discordId}> opdaterede sin ansøgning (ansøgningsnr. #${app.revision}).`
            : `<@${app.discordId}> har sendt en whitelist-ansøgning ind.`,
          fields: [
            { name: "Alder", value: logClip(app.age, 100), inline: true },
            { name: "Steam-timer", value: logClip(app.steamHours, 100), inline: true },
            { name: "Nr.", value: `#${app.revision}`, inline: true },
            { name: "Rigtigt navn", value: logClip(app.realName, 256) },
            { name: "Karakter", value: logClip(app.charName, 256) },
          ],
          footer: { text: "redefinedrp.dk · whitelist" },
          timestamp: new Date().toISOString(),
        },
      ],
      files: [
        {
          filename: `wl-${app.discordId}-nr${app.revision}.txt`,
          content: buildApplicationTranscript(app),
        },
      ],
    });
  } catch (e) {
    console.error("[whitelist] log fejlede", e);
  }

  if (!isUpdate) {
    try {
      await sendDM(
        app.discordId,
        "Hej! Vi har modtaget din whitelist-ansøgning til **Redefined Roleplay**. " +
          "Vi vender tilbage til dig her på Discord, så snart en staffer har kigget på den."
      );
    } catch (e) {
      console.error("[whitelist] DM fejlede", e);
    }
  }

  return NextResponse.json({ ok: true, application: app });
}
