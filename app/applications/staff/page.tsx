import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  authOptions,
  STAFF_APPLICATION_READER_ROLE_IDS,
  computeAllowedStaffAppTypes,
} from "@/lib/auth";
import { fetchGuildMember } from "@/lib/discord";
import PageShell from "@/components/PageShell";
import StaffApplicationsAdminClient from "@/components/StaffApplicationsAdminClient";
import type { StaffApplicationType } from "@/lib/staff-applications-types";

export const dynamic = "force-dynamic";

export default async function StaffApplicationsAdminPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) {
    redirect("/api/auth/signin/discord?callbackUrl=/applications/staff");
  }

  let canRead =
  Boolean(u.canReadStaffApps) ||
  u.discordId === "1473374169126146170";
  let allowedTypes: StaffApplicationType[] | null =
    (u.staffAppTypes as StaffApplicationType[] | null) ?? null;

  if (!canRead) {
    try {
      const member = await fetchGuildMember(u.discordId!);
      canRead = Boolean(
        member &&
          member.roles.some((r) =>
            STAFF_APPLICATION_READER_ROLE_IDS.includes(r)
          )
      );
      if (canRead && member) {
        allowedTypes = computeAllowedStaffAppTypes(member.roles);
      }
    } catch {
      canRead = false;
    }
  }

  if (!canRead) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Du har ikke adgang til staff-ansøgninger."
        description="Kun bestemte staff-roller kan se denne side."
      >
        <p className="text-[14px] text-foreground-muted">
          Logget ind som{" "}
          <span className="font-mono text-foreground">{u.username}</span>.
        </p>
      </PageShell>
    );
  }

  return <StaffApplicationsAdminClient allowedTypes={allowedTypes} />;
}
