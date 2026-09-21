import HeroBackdrop from "./HeroBackdrop";
import Reveal from "./Reveal";
import { ReactNode } from "react";

export default function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-[100svh] bg-[var(--bg)]">
      <HeroBackdrop />
      <section className="relative mx-auto max-w-3xl px-6 pb-32 pt-36 sm:pt-44">
        <Reveal>
          {eyebrow ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
              {eyebrow}
            </p>
          ) : null}
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-5 text-balance font-sans text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
        </Reveal>
        {description ? (
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-foreground-muted">
              {description}
            </p>
          </Reveal>
        ) : null}
        <Reveal delay={0.15}>
          <div className="mt-12 space-y-6 text-[15px] leading-relaxed text-foreground-secondary">
            {children}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
