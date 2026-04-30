"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type IngestResult = {
  source_file: string; total_rows: number; imported: number;
  duplicates_skipped: number; internal_marked: number;
  categorized: number; uncategorized: number;
};

export function UploadCsv({ onDone }: { onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/ingest?use_llm=true`,
        { method: "POST", body: fd }
      );
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
      onDone?.();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="h-8 px-3.5 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Importing…" : "Import CSV"}
      </button>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />

      {error && <p className="text-xs text-red-500">{error}</p>}

      {result && (
        <div className="flex gap-3 text-[12px] text-muted-foreground">
          <span className="text-emerald-600 font-medium">+{result.imported} rows</span>
          {result.categorized > 0 && <span>{result.categorized} categorised</span>}
          {result.uncategorized > 0 && <span className="text-amber-600">{result.uncategorized} uncategorised</span>}
          {result.duplicates_skipped > 0 && <span>{result.duplicates_skipped} skipped</span>}
        </div>
      )}
    </div>
  );
}
