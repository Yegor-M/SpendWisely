"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "earn",     label: "Earn"     },
];

export function DashboardTabs() {
  const router   = useRouter();
  const params   = useSearchParams();
  const pathname = usePathname();
  const current  = params.get("tab") ?? "overview";

  function select(value: string) {
    const p = new URLSearchParams(params.toString());
    if (value === "overview") p.delete("tab");
    else p.set("tab", value);
    router.replace(`${pathname}${p.toString() ? "?" + p.toString() : ""}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
      {TABS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => select(value)}
          className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            current === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
