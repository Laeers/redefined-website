"use client";

/** Subtilt, statisk baggrundslag — bruges på undersider. Minimalistisk. */
export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-600/18 via-brand-600/6 to-transparent dark:from-brand-900/35 dark:via-brand-900/10" />
    </div>
  );
}
