import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, ADMIN_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import { getCompanySummaries } from "@/lib/companies";
import PageShell from "@/components/PageShell";
import CompaniesOverview from "@/components/admin/CompaniesOverview";

export const dynamic = "force-dynamic";

export default async function AdminFirmaerPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) {
    redirect("/api/auth/signin/discord?callbackUrl=/admin/firmaer");
  }

  let isAdmin = Boolean(u.isAdmin);
  if (!isAdmin) {
    try {
      isAdmin = await memberHasRole(u.discordId, ADMIN_ROLE_ID);
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
          Logget ind som{" "}
          <span className="font-mono text-foreground">{u.username}</span>.
        </p>
      </PageShell>
    );
  }

  const companies = await getCompanySummaries();

  return (
    <main className="min-h-screen pt-20">
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6">
          <Link
            href="/admin/players"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-faint transition-colors hover:text-foreground-secondary"
          >
            ← Admin
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Firma-oversigt
          </h1>
          <p className="mt-1.5 text-[14px] text-foreground-muted">
            Society-økonomi, ansatte, chefer og hvornår de sidst var online.
            Klik et firma for at se medlemmerne.
          </p>
        </div>
        <CompaniesOverview initial={companies} />
      </div>
    </main>
  );
}
