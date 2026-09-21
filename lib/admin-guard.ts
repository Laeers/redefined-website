import { getServerSession } from "next-auth";
import {
  authOptions,
  STAFF_WHITELIST_ROLE_ID,
  ADMIN_ROLE_ID,
  WHITELIST_GRANTED_ROLE_ID,
  STAFF_APPLICATION_READER_ROLE_IDS,
  computeAllowedStaffAppTypes,
} from "./auth";
import { fetchGuildMember, memberHasRole } from "./discord";
import type { StaffApplicationType } from "./staff-applications-types";

export interface StaffSession {
  discordId: string;
  username?: string;
  isStaff: true;
}

export interface AdminSession {
  discordId: string;
  username?: string;
  isAdmin: true;
}

export interface WhitelistedSession {
  discordId: string;
  username?: string;
  isWhitelisted: true;
}

export interface StaffAppReaderSession {
  discordId: string;
  username?: string;
  canReadStaffApps: true;
  allowedTypes: StaffApplicationType[] | null;
}

export async function requireStaff(): Promise<StaffSession | { error: string; status: 401 | 403 }> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (u.isStaff) {
    return { discordId: u.discordId, username: u.username, isStaff: true };
  }
  // fallback: re-check live (token kan være cached uden staff)
  try {
    if (await memberHasRole(u.discordId, STAFF_WHITELIST_ROLE_ID)) {
      return { discordId: u.discordId, username: u.username, isStaff: true };
    }
  } catch {
    // ignore
  }
  return { error: "Ingen adgang", status: 403 };
}

export async function requireAdmin(): Promise<AdminSession | { error: string; status: 401 | 403 }> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
    if (u.discordId === "1473374169126146170") {}
  return { discordId: u.discordId, username: u.username, isAdmin: true };
}
  
  if (u.isAdmin) {
    return { discordId: u.discordId, username: u.username, isAdmin: true };
  }
  // fallback: re-check live
  try {
    if (await memberHasRole(u.discordId, ADMIN_ROLE_ID)) {
      return { discordId: u.discordId, username: u.username, isAdmin: true };
    }
  } catch {
    // ignore
  }
  return { error: "Ingen adgang", status: 403 };
}

// Adgang til Kompensationssager (website admin-view) er rolle-baseret.
// Default: Owner-rollen (1500245868953997373). Kan udvides via env med
// KOMPENSATION_VIEWER_ROLE_IDS (kommasepareret) hvis flere roller skal kunne se.
const KOMPENSATION_VIEWER_ROLE_IDS = Array.from(
  new Set(
    [
      "1500245868953997373", // Owner
      ...(process.env.KOMPENSATION_VIEWER_ROLE_IDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ],
  ),
);

async function memberHasAnyRole(discordId: string, roleIds: string[]): Promise<boolean> {
  for (const rid of roleIds) {
    try {
      if (await memberHasRole(discordId, rid)) return true;
    } catch {
      // ignore, prøv næste rolle
    }
  }
  return false;
}

export async function requireKompensationViewer(): Promise<
  { discordId: string; username?: string } | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (await memberHasAnyRole(u.discordId, KOMPENSATION_VIEWER_ROLE_IDS)) {
    return { discordId: u.discordId, username: u.username };
  }
  return { error: "Ingen adgang", status: 403 };
}

// Lille helper hvis kalderen allerede har en liste af rolle-id'er (fx fra JWT).
export function hasKompensationViewerRole(roleIds: string[] | null | undefined): boolean {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return false;
  return KOMPENSATION_VIEWER_ROLE_IDS.some((id) => roleIds.includes(id));
}

export const KOMPENSATION_VIEWER_ROLES = KOMPENSATION_VIEWER_ROLE_IDS;

// Fjern items fra spiller-inventar via admin player overview (kun disse roller).
export const INVENTORY_MANAGER_ROLE_IDS = [
  "1500245868953997373",
  "1502775151480279071",
];

export async function canManageInventory(discordId: string): Promise<boolean> {
  return memberHasAnyRole(discordId, INVENTORY_MANAGER_ROLE_IDS);
}

export async function requireInventoryManager(): Promise<
  { discordId: string; username?: string } | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (await canManageInventory(u.discordId)) {
    return { discordId: u.discordId, username: u.username };
  }
  return { error: "Ingen adgang til inventar-redigering", status: 403 };
}

// Regler-redaktører: Senior Admin og opefter (Project Lead, Head Admin,
// Senior Admin). Kan udvides/ændres via env RULES_EDITOR_ROLE_IDS (kommasep.).
export const RULES_EDITOR_ROLE_IDS = Array.from(
  new Set(
    [
      "1500245868953997373", // Project Lead
      "1502775255419191296", // Head Admin
      "1502775151480279071", // Senior Admin
      ...(process.env.RULES_EDITOR_ROLE_IDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ],
  ),
);

export async function canEditRules(discordId: string): Promise<boolean> {
  return memberHasAnyRole(discordId, RULES_EDITOR_ROLE_IDS);
}

export async function requireRulesEditor(): Promise<
  { discordId: string; username?: string } | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (await canEditRules(u.discordId)) {
    return { discordId: u.discordId, username: u.username };
  }
  return { error: "Kun Senior Admin+ kan redigere regler", status: 403 };
}

// Full player-wipe (sletter user + alt ejet). EKSTREMT destruktivt → kun Owner.
export const WIPE_PLAYER_ROLE_IDS = ["1500245868953997373"];

export async function canWipePlayer(discordId: string): Promise<boolean> {
  return memberHasAnyRole(discordId, WIPE_PLAYER_ROLE_IDS);
}

export async function requireWiper(): Promise<
  { discordId: string; username?: string } | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (await canWipePlayer(u.discordId)) {
    return { discordId: u.discordId, username: u.username };
  }
  return { error: "Kun Owner kan wipe spillere", status: 403 };
}

export async function requireWhitelisted(): Promise<
  WhitelistedSession | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (u.isWhitelisted) {
    return { discordId: u.discordId, username: u.username, isWhitelisted: true };
  }
  try {
    if (await memberHasRole(u.discordId, WHITELIST_GRANTED_ROLE_ID)) {
      return { discordId: u.discordId, username: u.username, isWhitelisted: true };
    }
  } catch {
    // ignore
  }
  return {
    error: "Du skal have whitelist-rollen for at ansøge om staff",
    status: 403,
  };
}

export async function requireStaffAppReader(): Promise<
  StaffAppReaderSession | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) {
    return { error: "Ikke logget ind", status: 401 };
  }
  if (u.canReadStaffApps) {
    return {
      discordId: u.discordId,
      username: u.username,
      canReadStaffApps: true,
      allowedTypes: (u.staffAppTypes as StaffApplicationType[] | null) ?? null,
    };
  }
  // fallback: re-check live
  try {
    const member = await fetchGuildMember(u.discordId);
    if (
      member &&
      member.roles.some((r) => STAFF_APPLICATION_READER_ROLE_IDS.includes(r))
    ) {
      return {
        discordId: u.discordId,
        username: u.username,
        canReadStaffApps: true,
        allowedTypes: computeAllowedStaffAppTypes(member.roles),
      };
    }
  } catch {
    // ignore
  }
  return { error: "Ingen adgang", status: 403 };
}
