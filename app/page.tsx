import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import HeroSlideshow from "@/components/HeroSlideshow";

export default function HomePage() {
  return ( 
    <main className="bg-[var(--bg)]">
      {/* HERO — slideshow med rødt overlay, logo i centrum */}
      <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden">
        <HeroSlideshow />
        <div
          className="absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(180, 30, 30, 0.32) 0%, rgba(8,3,3,0) 70%), linear-gradient(180deg, rgba(8,3,3,0.18) 0%, rgba(40,6,6,0.28) 50%, rgba(6,3,4,0.85) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-56"
          aria-hidden
          style={{
            background:
              "linear-gradient(180deg, rgba(6,3,4,0) 0%, rgba(6,3,4,1) 100%)",
          }}
        />

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-24 pt-28 text-center">
          <Reveal>
            <Image
              src="/logo.png"
              alt="Redefined Roleplay"
              width={520}
              height={520}
              priority
              className="h-auto w-[280px] select-none sm:w-[400px] md:w-[480px] lg:w-[520px]"
            />
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-10 max-w-xl text-balance text-[15.5px] leading-relaxed text-hero-muted sm:text-base">
              Dansk FiveM RP — whitelist-only. Frihed under ansvar, og en by
              hvor dine valg har konsekvens.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/whitelist"
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-brand-500"
              >
                Søg whitelist
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M2 7h10M8 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="https://discord.gg/redefinedrp"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--hero-border)] px-6 py-3 text-[14px] font-medium text-hero transition-colors hover:border-[var(--hero-border-hover)] hover:text-[var(--hero-text)]"
              >
                Discord
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="mt-12 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-hero-faint">
              <span className="h-1.5 w-1.5 animate-slow-pulse rounded-full bg-orange-500" />
              redefinedrp.dk · vi bygger · på vej op
            </div>
          </Reveal>
        </div>
      </section>

      {/* TO-KOLONNE: FRIHED UNDER ANSVAR | REDEFINED ROLEPLAY */}
      <section className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
          <div className="grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
            <Reveal className="bg-[var(--bg)] p-8 sm:p-10 lg:p-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.36em] text-brand-400/85">
                Frihed under ansvar
              </p>
              <h2 className="mt-5 text-balance text-[28px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[34px]">
                Det er ikke bare RP — det er{" "}
                <span className="text-brand-500">din historie</span>.
              </h2>
              <div className="mt-6 space-y-4 text-pretty text-[15px] leading-[1.75] text-foreground-muted">
                <p>
                  Hos Redefined får du friheden til selv at forme din karakter
                  — men friheden står aldrig alene. Vi bygger byen op omkring
                  princippet om, at handlinger har konsekvenser, og at en
                  historie først bliver vigtig, når der rent faktisk er noget
                  på spil.
                </p>
                <p>
                  Det betyder plads til kreativitet og kant, men ikke et
                  frikort. Du sætter retningen for din karakter; verden sætter
                  rammen. Sådan opstår scenerne der bliver husket — og sådan
                  bygger vi en by, hvor dine valg betyder noget.
                </p>
              </div>
            </Reveal>

            <Reveal
              delay={0.08}
              className="bg-[var(--bg-2)] p-8 sm:p-10 lg:p-12"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.36em] text-brand-400/85">
                Redefined Roleplay
              </p>
              <h2 className="mt-5 text-balance text-[28px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[34px]">
                ESX-server med RP i fokus.
              </h2>
              <div className="mt-6 space-y-4 text-pretty text-[15px] leading-[1.75] text-foreground-muted">
                <p>
                  Vi er en dansk ESX-server. Ikke mere, ikke mindre. Ingen
                  buzzwords om custom frameworks eller hemmelige features —
                  det er ESX kørt seriøst, med en stab der gider og en
                  spillerbase der gider RP.
                </p>
                <p>
                  Fokus er på rollespillet selv. Solid bande-RP, fede
                  ulovlige jobs, og en by hvor scenerne får lov at bygge sig
                  op i stedet for at blive brudt af /me-spam og kontotjek.
                </p>
                <p className="text-foreground-secondary">
                  Du behøver ikke at være proff. Du skal bare have lyst til
                  at spille — og forstå at handlinger har konsekvenser.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Reveal>
            <h3 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Klar til at skrive din karakter ind i byen?
            </h3>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-8 flex justify-center">
              <Link
                href="/whitelist"
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-7 py-3 text-[14px] font-medium text-white transition-colors hover:bg-brand-500"
              >
                Søg whitelist nu
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M2 7h10M8 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
