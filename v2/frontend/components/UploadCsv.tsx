"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/ingest?use_claude=true`,
        { method: "POST", body: fd }
      );
      if (!res.ok) throw new Error(await res.text());
      const data: IngestResult = await res.json();
      setResult(data);
      onDone?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          variant="outline"
        >
          {loading ? "Importing…" : "Import Bank CSV"}
        </Button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <Card className="w-fit">
          <CardContent className="pt-4 flex gap-6 text-sm">
            <span className="text-green-600 font-medium">+{result.imported} imported</span>
            <span>{result.internal_marked} internal (FX/transfers excluded)</span>
            <span>{result.categorized} categorised</span>
            {result.uncategorized > 0 && (
              <span className="text-orange-500">{result.uncategorized} uncategorised</span>
            )}
            {result.duplicates_skipped > 0 && (
              <span className="text-muted-foreground">{result.duplicates_skipped} skipped (dup)</span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
