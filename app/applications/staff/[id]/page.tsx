import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  authOptions,
  STAFF_APPLICATION_READER_ROLE_IDS,
  computeAllowedStaffAppTypes,
} from "@/lib/auth";
import { fetchDiscordUser, fetchGuildMember } from "@/lib/discord";
import { getStaffApplication } from "@/lib/staff-applications";
import StaffApplicationDetail from "@/components/StaffApplicationDetail";
import PageShell from "@/components/PageShell";
import type { StaffApplicationType } from "@/lib/staff-applications-types";

export const dynamic = "force-dynamic";

export default async function StaffApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) {
    redirect(
      `/api/auth/signin/discord?callbackUrl=/applications/staff/${encodeURIComponent(params.id)}`
    );
  }

  let canRead = Boolean(u.canReadStaffApps);
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
          Logget ind, men uden adgang.
        </p>
      </PageShell>
    );
  }

  const app = await getStaffApplication(params.id);
  if (!app) {
    return (
      <PageShell
        eyebrow="Staff-ansøgninger"
        title="Ansøgning ikke fundet"
        description="Ansøgningen kan være slettet, eller ID'et er forkert."
      >
        <a
          href="/applications/staff"
          className="font-mono text-[12.5px] text-brand-400 hover:text-brand-300"
        >
          ← Tilbage til oversigt
        </a>
      </PageShell>
    );
  }

  if (allowedTypes !== null && !allowedTypes.includes(app.applicationType)) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Du har ikke adgang til denne ansøgningstype."
        description="Din rolle giver kun adgang til bestemte ansøgningstyper."
      >
        <a
          href="/applications/staff"
          className="font-mono text-[12.5px] text-brand-400 hover:text-brand-300"
        >
          ← Tilbage til oversigt
        </a>
      </PageShell>
    );
  }

  const [user, member] = await Promise.all([
    fetchDiscordUser(app.discordId).catch(() => null),
    fetchGuildMember(app.discordId).catch(() => null),
  ]);

  return (
    <StaffApplicationDetail application={app} user={user} member={member} />
  );
}
