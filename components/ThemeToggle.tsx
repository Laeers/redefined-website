"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "redefined-theme";

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.59 1.591a.75.75 0 001.06 1.06l1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 5.106a.75.75 0 001.06 1.06l1.591-1.59a.75.75 0 00-1.061-1.06l-1.591 1.59z" />
    </svg>
  );
}

export default function ThemeToggle({ onHero }: { onHero?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    if (nextDark) {
      root.classList.add("dark");
      try {
        localStorage.setItem(STORAGE_KEY, "dark");
      } catch {
        /* ignore */
      }
    } else {
      root.classList.remove("dark");
      try {
        localStorage.setItem(STORAGE_KEY, "light");
      } catch {
        /* ignore */
      }
    }
    setDark(nextDark);
  }

  const color =
    onHero ? "text-white" : dark ? "text-white" : "text-neutral-900";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`-m-1 flex items-center justify-center p-2 transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${color}`}
      aria-label={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
      title={dark ? "Lys tilstand" : "Mørk tilstand"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
