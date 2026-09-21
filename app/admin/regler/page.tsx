import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canEditRules } from "@/lib/admin-guard";
import { getAllSections, getRulesMeta } from "@/lib/rules";
import PageShell from "@/components/PageShell";
import RulesEditor from "@/components/admin/RulesEditor";

export const dynamic = "force-dynamic";

export default async function AdminReglerPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) {
    redirect("/api/auth/signin/discord?callbackUrl=/admin/regler");
  }

  let allowed = false;
  try {
    allowed = await canEditRules(u.discordId);
  } catch {
    allowed = false;
  }

  if (!allowed) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Kun Senior Admin+ kan redigere regler."
        description="Denne side kræver rollen Senior Admin, Head Admin eller Project Lead på Discord-serveren."
      >
        <p className="text-[14px] text-foreground-muted">
          Logget ind som{" "}
          <span className="font-mono text-foreground">{u.username}</span>.
        </p>
      </PageShell>
    );
  }

  const [sections, meta] = await Promise.all([
    getAllSections(),
    getRulesMeta(),
  ]);

  return (
    <PageShell
      eyebrow="Admin · Regler"
      title="Rediger regler & sektioner"
      description="Ændringer slår igennem på /regler med det samme. Brug Markdown i indholdet — **fed**, lister med bindestreg, og indrykkede underlister."
    >
      <RulesEditor initialSections={sections} initialMeta={meta} editor={u.username ?? u.discordId} />
    </PageShell>
  );
}
