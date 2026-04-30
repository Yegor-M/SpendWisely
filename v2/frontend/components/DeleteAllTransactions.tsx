"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Phase = "idle" | "confirm" | "loading";

export function DeleteAllTransactions() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setPhase("loading");
    setError(null);
    try {
      await api.deleteAllTransactions();
      router.refresh();
      setPhase("idle");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setPhase("idle");
    }
  }

  if (phase === "confirm") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Delete all transactions?</span>
        <button
          onClick={handleDelete}
          className="h-8 px-3 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setPhase("idle")}
          className="h-8 px-3 rounded-lg text-sm font-medium border border-input bg-background hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setPhase("confirm")}
        disabled={phase === "loading"}
        className="h-8 px-3.5 rounded-lg text-sm font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
      >
        {phase === "loading" ? "Deleting…" : "Delete all"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
