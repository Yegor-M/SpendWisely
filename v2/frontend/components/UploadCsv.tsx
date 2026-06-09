"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IngestResult } from "@/lib/api";
import { ImportReview } from "./ImportReview";

export function UploadCsv({ onDone }: { onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setResult(null); setReviewing(false);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/ingest?use_llm=false`,
        { method: "POST", body: fd }
      );
      if (!res.ok) throw new Error(await res.text());
      const data: IngestResult = await res.json();
      setResult(data);
      onDone?.();

      const parts: string[] = [];
      if (data.imported > 0) parts.push(`+${data.imported} imported`);
      if (data.categorized > 0) parts.push(`${data.categorized} categorized`);
      if (data.duplicates_skipped > 0) parts.push(`${data.duplicates_skipped} skipped`);

      if (data.imported === 0 && data.duplicates_skipped > 0) {
        toast.info("Nothing new", { description: `${data.duplicates_skipped} duplicate rows skipped` });
      } else {
        toast.success("Import complete", { description: parts.join(" · ") });
      }

      if (data.uncategorized_groups.length > 0) {
        setReviewing(true);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error("Import failed", {
        description: msg.includes("Failed to fetch")
          ? "Cannot reach the server — is the backend running?"
          : msg,
      });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleReviewDone() {
    setReviewing(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="h-8 px-3.5 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Importing…" : "Import CSV"}
        </button>
        <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
      </div>

      {reviewing && result && result.uncategorized_groups.length > 0 && (
        <ImportReview
          imported={result.imported}
          categorized={result.categorized}
          uncategorized={result.uncategorized}
          groups={result.uncategorized_groups}
          onDone={handleReviewDone}
        />
      )}
    </>
  );
}
