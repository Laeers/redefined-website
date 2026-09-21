import Link from "next/link";
import { getServerSession } from "next-auth";
import PageShell from "@/components/PageShell";
import Reveal from "@/components/Reveal";
import RulesMarkdown from "@/components/RulesMarkdown";
import { getPublishedSections, getRulesMeta } from "@/lib/rules";
import { authOptions } from "@/lib/auth";
import { canEditRules } from "@/lib/admin-guard";

// Reglerne hentes fra databasen og kan redigeres af Senior Admin+ på
// /admin/regler — intet er længere hardcodet her.
export const dynamic = "force-dynamic";

export default async function ReglerPage() {
  const [sections, meta] = await Promise.all([
    getPublishedSections(),
    getRulesMeta(),
  ]);

  // Vis "Rediger"-knap hvis den indloggede har redaktør-adgang.
  let isEditor = false;
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.discordId;
    if (discordId) isEditor = await canEditRules(discordId);
  } catch {
    // ignorér — knappen er bare ikke synlig
  }

  return (
    <PageShell
      eyebrow={meta.page_eyebrow}
      title={meta.page_title}
      description={meta.page_description}
    >
      {isEditor ? (
        <Reveal>
          <div className="flex items-center justify-between gap-3 rounded-md border border-brand-500/30 bg-brand-500/[0.06] px-4 py-3">
            <p className="text-[13px] text-foreground-muted">
              Du kan redigere reglerne og sektionerne direkte.
            </p>
            <Link
              href="/admin/regler"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-500"
            >
              Rediger regler
            </Link>
          </div>
        </Reveal>
      ) : null}

      {/* TABLE OF CONTENTS */}
      {sections.length > 0 ? (
        <Reveal>
          <nav className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground-faint">
              Indhold
            </p>
            <ul className="mt-3 grid gap-1.5 text-[14.5px] sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <Link
                    href={`#${s.slug}`}
                    className="group flex items-baseline gap-3 text-foreground-secondary transition-colors hover:text-foreground"
                  >
                    <span className="font-mono text-[11px] tracking-wider text-foreground-faint group-hover:text-brand-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.nav_label || s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Reveal>
      ) : null}

      {sections.map((s) => (
        <Reveal as="section" key={s.id} className="!mt-16 scroll-mt-28">
          <div id={s.slug} className="border-t border-[var(--line)] pt-10">
            {s.eyebrow ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
                {s.eyebrow}
              </p>
            ) : null}
            {s.title ? (
              <h2 className="mt-4 text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
                {s.title}
              </h2>
            ) : null}
            <div className="mt-5 space-y-4 text-[15px] leading-[1.75] text-foreground-secondary">
              <RulesMarkdown>{s.body}</RulesMarkdown>
            </div>
          </div>
        </Reveal>
      ))}

      <Reveal className="!mt-16 rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
          Klar?
        </p>
        <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-foreground">
          Har du læst hele vejen igennem og forstået tonen?
        </h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-foreground-muted">
          Så send en whitelist-ansøgning. Hold dine svar konkrete — vi vil
          hellere have to ærlige sætninger end ti generiske.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/whitelist"
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-brand-500"
          >
            Søg whitelist
          </Link>
          <a
            href="https://discord.gg/redefinedrp"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--line-strong)] px-5 py-2.5 text-[14px] font-medium text-foreground-secondary transition-colors hover:border-[var(--line)] hover:text-foreground"
          >
            Spørgsmål? Discord
          </a>
        </div>
      </Reveal>
    </PageShell>
  );
}
