/**
 * Tynd Discord REST helper med bot-token. Bruges fra serveren til:
 *  - hente medlems-roller (rolle-gating af staff)
 *  - sende DM
 *  - tildele rolle
 *  - hente user-profil (avatar, oprettet-dato)
 */

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? "";

const DISCORD_EPOCH = 1420070400000;

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    Authorization: `Bot ${TOKEN}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function botFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!TOKEN) throw new Error("DISCORD_BOT_TOKEN mangler");
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store",
  });
}

export interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string;
  bannerColor: string | null;
  createdAt: string;
}

export function snowflakeToDate(snowflake: string): string {
  try {
    const ms = (BigInt(snowflake) >> 22n) + BigInt(DISCORD_EPOCH);
    return new Date(Number(ms)).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

export function avatarUrl(userId: string, hash: string | null, size = 128): string {
  if (!hash) {
    const idx = (BigInt(userId) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=${size}`;
}

export async function fetchDiscordUser(id: string): Promise<DiscordUser | null> {
  const r = await botFetch(`/users/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const u = await r.json();
  return {
    id: u.id,
    username: u.username,
    globalName: u.global_name ?? null,
    avatar: u.avatar ?? null,
    avatarUrl: avatarUrl(u.id, u.avatar ?? null),
    bannerColor: u.banner_color ?? null,
    createdAt: snowflakeToDate(u.id),
  };
}

export interface DiscordMember {
  id: string;
  roles: string[];
  joinedAt: string | null;
  nick: string | null;
  user: DiscordUser | null;
}

export async function fetchGuildMember(userId: string): Promise<DiscordMember | null> {
  if (!GUILD_ID) throw new Error("DISCORD_GUILD_ID mangler");
  const r = await botFetch(
    `/guilds/${encodeURIComponent(GUILD_ID)}/members/${encodeURIComponent(userId)}`
  );
  if (!r.ok) return null;
  const m = await r.json();
  return {
    id: userId,
    roles: m.roles ?? [],
    joinedAt: m.joined_at ?? null,
    nick: m.nick ?? null,
    user: m.user
      ? {
          id: m.user.id,
          username: m.user.username,
          globalName: m.user.global_name ?? null,
          avatar: m.user.avatar ?? null,
          avatarUrl: avatarUrl(m.user.id, m.user.avatar ?? null),
          bannerColor: m.user.banner_color ?? null,
          createdAt: snowflakeToDate(m.user.id),
        }
      : null,
  };
}

export async function memberHasRole(userId: string, roleId: string): Promise<boolean> {
  const m = await fetchGuildMember(userId);
  if (!m) return false;
  return m.roles.includes(roleId);
}

export async function addRole(userId: string, roleId: string): Promise<void> {
  if (!GUILD_ID) throw new Error("DISCORD_GUILD_ID mangler");
  const r = await botFetch(
    `/guilds/${encodeURIComponent(GUILD_ID)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "PUT" }
  );
  if (!r.ok && r.status !== 204) {
    const t = await r.text().catch(() => "");
    throw new Error(`addRole ${r.status}: ${t}`);
  }
}

export async function removeRole(userId: string, roleId: string): Promise<void> {
  if (!GUILD_ID) throw new Error("DISCORD_GUILD_ID mangler");
  const r = await botFetch(
    `/guilds/${encodeURIComponent(GUILD_ID)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "DELETE" }
  );
  if (!r.ok && r.status !== 204) {
    const t = await r.text().catch(() => "");
    throw new Error(`removeRole ${r.status}: ${t}`);
  }
}

export async function sendDM(userId: string, content: string): Promise<boolean> {
  const r1 = await botFetch(`/users/@me/channels`, {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!r1.ok) {
    console.error("[discord] open DM failed", r1.status, await r1.text().catch(() => ""));
    return false;
  }
  const ch = await r1.json();
  const r2 = await botFetch(`/channels/${ch.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!r2.ok) {
    console.error("[discord] DM send failed", r2.status, await r2.text().catch(() => ""));
    return false;
  }
  return true;
}
