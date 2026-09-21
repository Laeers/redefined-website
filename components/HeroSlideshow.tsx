"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  "/hero/01.png",
  "/hero/02.png",
  "/hero/03.png",
  "/hero/04.png",
  "/hero/05.png",
];

const HOLD_MS = 6500;
const FADE_MS = 1800;

/**
 * Krydsfadende slideshow til hero-baggrunden.
 * Billederne er sløret + nedtonet, og dækkes af et rødt-mørkt gradient-lag i page.tsx.
 */
export default function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, HOLD_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 -z-20 overflow-hidden bg-[var(--bg)]">
      {SLIDES.map((src, i) => (
        <div
          key={src}
          aria-hidden
          className="absolute inset-0"
          style={{
            opacity: active === i ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            quality={80}
            className="object-cover object-center"
            style={{
              filter: "blur(6px) brightness(0.78) saturate(1.05)",
              transform: "scale(1.06)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
