"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Target, Receipt, Tags, Settings } from "lucide-react";
import { LLMSettings } from "@/components/LLMSettings";
import { CategoriesModal } from "@/components/CategoriesModal";

const NAV = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/insights",     label: "Insights",     icon: LineChart },
  { href: "/plan",         label: "Plan",         icon: Target },
  { href: "/transactions", label: "Transactions", icon: Receipt },
];

export function Sidebar() {
  const path = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-[19.2rem] shrink-0 border-r border-border/60 bg-background min-h-screen sticky top-0 h-screen">
        {/* Logo */}
        <div className="h-14 flex items-center justify-center px-4 border-b border-border/60">
          <Link href="/">
            <span className="font-semibold text-[17px] tracking-tight">SpendWisely</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1.5 pl-4 pr-2 pt-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-base transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom buttons */}
        <div className="mt-auto pl-4 pr-2 pb-4 pt-3 border-t border-border/60 flex flex-col gap-1.5">
          <button
            onClick={() => setCategoriesOpen(true)}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-base text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Tags className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            Categories
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-base text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
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
              onClick={() => setCategoriesOpen(true)}
              className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Categories"
            >
              <Tags className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              aria-label="AI Settings"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </nav>
        </div>
      </header>

      <CategoriesModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <LLMSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
