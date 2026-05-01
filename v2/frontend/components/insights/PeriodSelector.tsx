"use client";
import { useRouter, useSearchParams } from "next/navigation";

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "6m",  label: "6 months" },
  { value: "3m",  label: "Quarter"  },
  { value: "1m",  label: "Month"    },
];

export function PeriodSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("period") ?? "all";

  function select(value: string) {
    const p = new URLSearchParams(params.toString());
    if (value === "all") p.delete("period");
    else p.set("period", value);
    router.replace(`/insights${p.toString() ? "?" + p.toString() : ""}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => select(value)}
          className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
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
