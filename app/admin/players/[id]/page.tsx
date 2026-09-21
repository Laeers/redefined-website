import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, ADMIN_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import PageShell from "@/components/PageShell";
import AdminPlayerDetail from "@/components/AdminPlayerDetail";

export const dynamic = "force-dynamic";

export default async function AdminPlayerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) {
    redirect(`/api/auth/signin/discord?callbackUrl=/admin/players/${params.id}`);
  }

  let isAdmin = Boolean(u.isAdmin);
  if (!isAdmin) {
    try {
      isAdmin = await memberHasRole(u.discordId!, ADMIN_ROLE_ID);
    } catch {
      isAdmin = false;
    }
  }
  if (!isAdmin) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Du har ikke admin-rollen."
        description="Denne side kræver admin-rollen på Discord-serveren."
      >
        <p className="text-[14px] text-foreground-muted">
          Logget ind som <span className="font-mono text-foreground">{u.username}</span>.
        </p>
      </PageShell>
    );
  }

  return <AdminPlayerDetail identifier={decodeURIComponent(params.id)} />;
}
