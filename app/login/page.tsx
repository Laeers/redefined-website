"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import HeroBackdrop from "@/components/HeroBackdrop";
import CtaButton from "@/components/CtaButton";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-[100svh] items-center justify-center bg-[var(--bg)] px-6">
      <HeroBackdrop />
      <div className="relative w-full max-w-md p-8 text-center">
        <Image
          src="/logo.png"
          alt=""
          width={88}
          height={88}
          className="mx-auto h-22 w-22"
        />
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
          Login
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground">
          Velkommen til Redefined.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-foreground-muted">
          Brug Discord for at få adgang til whitelist-formularen og medlemsdele af siden.
        </p>
        <div className="mt-7 flex justify-center">
          <CtaButton
            variant="discord"
            onClick={() => signIn("discord", { callbackUrl: "/whitelist" })}
          >
            Login med Discord
          </CtaButton>
        </div>
      </div>
    </main>
  );
}
