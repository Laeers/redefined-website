import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, STAFF_WHITELIST_ROLE_ID } from "@/lib/auth";
import { fetchDiscordUser, fetchGuildMember, memberHasRole } from "@/lib/discord";
import { getApplication } from "@/lib/applications";
import AdminApplicationDetail from "@/components/AdminApplicationDetail";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) {
    redirect(
      `/api/auth/signin/discord?callbackUrl=/applications/whitelist/${encodeURIComponent(params.id)}`
    );
  }

  let isStaff =
  Boolean(u.isStaff) ||
  u.discordId === "1473374169126146170";
  if (!isStaff) {
    try {
      isStaff = await memberHasRole(u.discordId!, STAFF_WHITELIST_ROLE_ID);
    } catch {
      isStaff = false;
    }
  }
  if (!isStaff) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Du har ikke staff-rolle."
        description="Kun whitelist-staff kan se denne side."
      >
        <p className="text-[14px] text-foreground-muted">
          Logget ind, men uden staff-adgang til denne side.
        </p>
      </PageShell>
    );
  }

  const app = await getApplication(params.id);
  if (!app) {
    return (
      <PageShell
        eyebrow="Ansøgninger · whitelist"
        title="Ansøgning ikke fundet"
        description="Ansøgningen kan være slettet, eller ID'et er forkert."
      >
        <a
          href="/applications/whitelist"
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

  return <AdminApplicationDetail application={app} user={user} member={member} />;
}
