import { DefaultSession } from "next-auth";
import type { StaffApplicationType } from "@/lib/staff-applications-types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      discordId?: string;
      username?: string;
      avatar?: string | null;
      isStaff?: boolean;
      isAdmin?: boolean;
      isWhitelisted?: boolean;
      canReadStaffApps?: boolean;
      staffAppTypes?: StaffApplicationType[] | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    username?: string;
    avatar?: string | null;
    isStaff?: boolean;
    isAdmin?: boolean;
    isWhitelisted?: boolean;
    canReadStaffApps?: boolean;
    staffAppTypes?: StaffApplicationType[] | null;
    staffCheckedAt?: number;
  }
}
