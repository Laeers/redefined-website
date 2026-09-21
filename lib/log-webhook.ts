/**
 * Tynd helper til at sende strukturerede log-events til staff-loggen.
 * Tager en webhook-URL fra env og sender et embed (+ valgfri vedhæftet fil).
 */

const URL_ENV = "LOG_WEBHOOK_URL";
/** Korte offentlige WL-linjer (modtaget / godkendt / afvist) — prioriterer whitelist-kanalen. */
const PUBLIC_LINE_URL_ENV = "WHITELIST_WEBHOOK_URL";

/** Vises som afsender på de korte, offentlige statuslinjer (ping + tekst). */
const DEFAULT_PUBLIC_NAME = "Redefined Whitelist";
const DEFAULT_PUBLIC_AVATAR = "https://redefinedrp.dk/logo.png";

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface LogEmbed {
  title: string;
  description?: string;
  color?: number;
  author?: { name: string; icon_url?: string; url?: string };
  fields?: EmbedField[];
  footer?: { text: string; icon_url?: string };
  thumbnail?: { url: string };
  url?: string;
  timestamp?: string;
}

interface AttachedFile {
  filename: string;
  content: string;
  contentType?: string;
}

export interface LogPayload {
  embeds: LogEmbed[];
  files?: AttachedFile[];
  content?: string;
  username?: string;
  avatarUrl?: string;
}

export const LOG_COLORS = {
  pending: 0xb0a01c,    // gul-grøn — ansøgning afventer
  approved: 0x16a34a,   // grøn
  rejected: 0xb02323,   // rød
  ticketOpen: 0x4f8cf6, // blå
  ticketClose: 0x6b7280,// grå
  info: 0x4f8cf6,
} as const;

export function clip(s: string, max = 1024): string {
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max - 3) + "…";
}

/**
 * Kort status til log-kanalen — samme format som på billedet:
 * `@Bruger - Din whitelist ansøgning er blevet godkendt` osv.
 */
export async function sendWhitelistPublicLine(
  discordId: string,
  kind: "received" | "interview_invited" | "approved" | "rejected"
): Promise<void> {
  const url =
    process.env[PUBLIC_LINE_URL_ENV] || process.env[URL_ENV];
  if (!url) {
    console.warn(
      `[log] hverken ${PUBLIC_LINE_URL_ENV} eller ${URL_ENV} sat — springer offentlig status over`
    );
    return;
  }

  const content =
    kind === "received"
      ? `<@${discordId}> - vi har modtaget din ansøgning ⏳`
      : kind === "interview_invited"
        ? `<@${discordId}> - Du er blevet indkaldt til en snak om din ansøgning :partying_face: `
        : kind === "approved"
          ? `<@${discordId}> - Din whitelist ansøgning er blevet **godkendt**! `
          : `<@${discordId}> - Din whitelist ansøgning er blevet **afvist**!`;

  const username = process.env.WHITELIST_PUBLIC_BOT_NAME ?? DEFAULT_PUBLIC_NAME;
  const avatarUrl =
    process.env.WHITELIST_PUBLIC_BOT_AVATAR_URL ?? DEFAULT_PUBLIC_AVATAR;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      avatar_url: avatarUrl,
      content,
      allowed_mentions: { users: [discordId] },
    }),
  });
  if (!r.ok) {
    console.error(
      "[log] whitelist public line failed",
      r.status,
      await r.text().catch(() => "")
    );
  }
}

export async function sendLog(payload: LogPayload): Promise<void> {
  const url = process.env[URL_ENV];
  if (!url) {
    console.warn(`[log] ${URL_ENV} ikke sat — springer log over`);
    return;
  }
  const body = {
    username: payload.username ?? "Redefined Logs",
    avatar_url: payload.avatarUrl,
    content: payload.content,
    embeds: payload.embeds,
    allowed_mentions: { parse: [] },
  };

  if (payload.files && payload.files.length) {
    const fd = new FormData();
    fd.append("payload_json", JSON.stringify(body));
    payload.files.forEach((f, i) => {
      const blob = new Blob([f.content], {
        type: f.contentType ?? "text/plain;charset=utf-8",
      });
      fd.append(`files[${i}]`, blob, f.filename);
    });
    const r = await fetch(url, { method: "POST", body: fd });
    if (!r.ok) {
      console.error("[log] webhook failed", r.status, await r.text().catch(() => ""));
    }
    return;
  }

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    console.error("[log] webhook failed", r.status, await r.text().catch(() => ""));
  }
}

/**
 * Bygger en plain-text "transcript" af en whitelist-ansøgning som vedhæftet fil.
 */
export function buildApplicationTranscript(app: {
  discordId: string;
  username: string;
  age: string;
  steamHours: string;
  realName: string;
  charName: string;
  charBackstory: string;
  rpExperience: string;
  scenario: string;
  status: string;
  staffNote?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}): string {
  return [
    `Whitelist-ansøgning · transcript`,
    `==================================`,
    ``,
    `Discord:        ${app.username} (${app.discordId})`,
    `Status:         ${app.status}`,
    `Ansøgningsnr.:  #${app.revision}`,
    `Sendt:          ${new Date(app.createdAt).toLocaleString("da-DK")}`,
    `Senest opdateret: ${new Date(app.updatedAt).toLocaleString("da-DK")}`,
    ``,
    `Alder:          ${app.age}`,
    `Steam-timer:    ${app.steamHours}`,
    `Rigtigt navn:   ${app.realName}`,
    ``,
    `--- Karakter ---`,
    app.charName,
    ``,
    `--- Karakter-baggrund ---`,
    app.charBackstory,
    ``,
    `--- RP-erfaring ---`,
    app.rpExperience,
    ``,
    `--- Scenarie (politi/spritkørsel) ---`,
    app.scenario,
    ``,
    app.staffNote
      ? `--- Staff-note ---\n${app.staffNote}\n`
      : ``,
  ].join("\n");
}
