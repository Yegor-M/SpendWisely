"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";

type Phase = "idle" | "confirm" | "loading";

export function DeleteAllTransactions() {
  const [phase, setPhase] = useState<Phase>("idle");
  const router = useRouter();

  async function handleDelete() {
    setPhase("loading");
    try {
      await api.deleteAllTransactions();
      router.refresh();
      setPhase("idle");
      toast.success("All transactions deleted");
    } catch (err: unknown) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setPhase("idle");
    }
  }

  return (
    <>
      <button
        onClick={() => setPhase("confirm")}
        disabled={phase === "loading"}
        className="h-8 px-3.5 rounded-lg text-sm font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
      >
        {phase === "loading" ? "Deleting…" : "Delete all"}
      </button>

      {phase === "confirm" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold">Delete all transactions?</h2>
              <p className="text-xs text-muted-foreground mt-1.5">
                This will permanently delete every transaction and cannot be undone.
                Category rules will not be affected.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPhase("idle")}
                className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="text-xs px-4 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
