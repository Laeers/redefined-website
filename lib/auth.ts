import type { NextAuthOptions } from "next-auth";
import Discord from "next-auth/providers/discord";
import { fetchGuildMember, memberHasRole } from "./discord";
import type { StaffApplicationType } from "./staff-applications-types";

const clientId = process.env.DISCORD_CLIENT_ID ?? "";
const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

export const STAFF_WHITELIST_ROLE_ID =
  process.env.WHITELIST_STAFF_ROLE_ID ?? "1500270517192753313";
export const WHITELIST_GRANTED_ROLE_ID =
  process.env.WHITELIST_GRANTED_ROLE_ID ?? "1500245891553034364";
/** Discord-rolle når ansøger er indkaldt til samtale (afventer endelig godkendelse). */
export const WHITELIST_AWAITING_INTERVIEW_ROLE_ID = "1510742483485724833";
export const ADMIN_ROLE_ID = "1500245889976111185";

/**
 * Rolle → hvilke ansøgningstyper de kan se.
 * null = fuld adgang til alle typer.
 */
export const STAFF_APP_ROLE_ACCESS: Record<string, StaffApplicationType[] | null> = {
  "1500245868953997373": null,
  "1502775255419191296": null,
  "1502775151480279071": null,
  "1508513848229892297": ["whitelist_receiver"],
  "1508506688968331324": null,
};

export const STAFF_APPLICATION_READER_ROLE_IDS: readonly string[] =
  Object.keys(STAFF_APP_ROLE_ACCESS);

export function computeAllowedStaffAppTypes(
  memberRoles: string[]
): StaffApplicationType[] | null {
  const types: StaffApplicationType[] = [];

  for (const [roleId, access] of Object.entries(STAFF_APP_ROLE_ACCESS)) {
    if (!memberRoles.includes(roleId)) continue;
    if (access === null) return null;
    for (const t of access) {
      if (!types.includes(t)) types.push(t);
    }
  }

  return types;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Discord({
      clientId,
      clientSecret,
      authorization: { params: { scope: "identify email" } },
    }),
  ],
  callbacks: {
    async jwt({ token, profile, trigger }) {
      const discordProfile = profile as
        | { id?: string; username?: string; global_name?: string; avatar?: string | null }
        | undefined;

      if (discordProfile?.id) {
        token.discordId = discordProfile.id;
        token.username = discordProfile.global_name ?? discordProfile.username;
        token.avatar = discordProfile.avatar ?? null;
      }

      // Refresh staff/admin status hver 5 min eller ved sign-in / update
      const lastChecked = (token.staffCheckedAt as number | undefined) ?? 0;
      const stale = Date.now() - lastChecked > 5 * 60 * 1000;
      if (token.discordId && (trigger === "signIn" || trigger === "update" || stale)) {
        try {
          const member = await fetchGuildMember(token.discordId as string);
          token.isStaff = member
            ? member.roles.includes(STAFF_WHITELIST_ROLE_ID)
            : false;
          token.isAdmin = member
            ? member.roles.includes(ADMIN_ROLE_ID)
            : false;
          token.isWhitelisted = member
            ? member.roles.includes(WHITELIST_GRANTED_ROLE_ID)
            : false;
          token.canReadStaffApps = member
            ? member.roles.some((r) => STAFF_APPLICATION_READER_ROLE_IDS.includes(r))
            : false;
          token.staffAppTypes = member
            ? computeAllowedStaffAppTypes(member.roles)
            : [];
          token.staffCheckedAt = Date.now();
        } catch (e) {
          console.error("[auth] staff role check failed", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      const u = session.user as Record<string, unknown>;
      u.discordId = token.discordId;
      u.username = token.username;
      u.avatar = token.avatar;
      u.isStaff = Boolean(token.isStaff);
      u.isAdmin = Boolean(token.isAdmin);
      u.isWhitelisted = Boolean(token.isWhitelisted);
      u.canReadStaffApps = Boolean(token.canReadStaffApps);
      // Bevar null (= fuld adgang) — `?? []` ville kollapse null til en tom
      // array og fejlagtigt fjerne adgangen for owner/admin-roller.
      u.staffAppTypes =
        token.staffAppTypes === undefined ? [] : token.staffAppTypes;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export interface SessionUser {
  name?: string | null;
  email?: string | null;
  username?: string;
  discordId?: string;
  avatar?: string | null;
  isStaff?: boolean;
  isAdmin?: boolean;
  isWhitelisted?: boolean;
  canReadStaffApps?: boolean;
  staffAppTypes?: StaffApplicationType[] | null;
}
