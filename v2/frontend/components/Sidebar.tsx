"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LLMSettings } from "@/components/LLMSettings";

const NAV = [
  { href: "/",             label: "Dashboard",    icon: "▦" },
  { href: "/insights",     label: "Insights",     icon: "◈" },
  { href: "/plan",         label: "Plan",         icon: "◎" },
  { href: "/transactions", label: "Transactions", icon: "≡" },
];

export function Sidebar() {
  const path = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border/60 bg-background min-h-screen sticky top-0 h-screen">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border/60">
          <Link href="/">
            <span className="font-semibold text-[15px] tracking-tight">SpendWisely</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-2 pt-3">
          {NAV.map(({ href, label, icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="text-[16px] leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* AI Settings */}
        <div className="mt-auto px-2 pb-4 pt-3 border-t border-border/60">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <span className="text-[16px] leading-none">⚙</span>
            AI Settings
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/60">
        <div className="px-4 h-12 flex items-center justify-between">
          <Link href="/">
            <span className="font-semibold text-[14px] tracking-tight">SpendWisely</span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map(({ href, label }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors text-sm"
              aria-label="AI Settings"
            >
              ⚙
            </button>
          </nav>
        </div>
      </header>

      <LLMSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
