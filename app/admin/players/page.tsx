import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, ADMIN_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import { KOMPENSATION_VIEWER_ROLES } from "@/lib/admin-guard";
import PageShell from "@/components/PageShell";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) redirect("/api/auth/signin/discord?callbackUrl=/admin/players");

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

  // Kompensationssager-tabben vises kun for Owner-rollen (eller udvidet via env).
  let canSeeKompensationer = false;
  for (const rid of KOMPENSATION_VIEWER_ROLES) {
    try {
      if (await memberHasRole(u.discordId!, rid)) {
        canSeeKompensationer = true;
        break;
      }
    } catch {
      // ignore
    }
  }

  return <AdminDashboard canSeeKompensationer={canSeeKompensationer} />;
}
