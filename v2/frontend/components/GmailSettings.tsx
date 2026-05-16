"use client";
import { useEffect, useState } from "react";
import { api, GmailEnrichment } from "@/lib/api";

type Props = { visible: boolean };

export function GmailSettings({ visible }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichments, setEnrichments] = useState<GmailEnrichment[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    api.getGmailStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, [visible]);

  if (!visible) return null;

  async function handleConnect() {
    setError("");
    setLoading(true);
    try {
      const { url } = await api.getGmailAuthUrl();
      const popup = window.open(url, "gmail-auth", "width=600,height=700");
      // Poll for popup close, then refresh status
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          api.getGmailStatus().then((s) => setConnected(s.connected));
        }
      }, 800);
    } catch {
      setError("Failed to get auth URL — is GMAIL_CLIENT_ID set in .env?");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await api.gmailDisconnect();
      setConnected(false);
      setEnrichments([]);
    } catch {
      setError("Disconnect failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich() {
    setError("");
    setEnriching(true);
    try {
      // Fetch all uncategorized BLIK transactions
      const txs = await api.transactions({ category: "Uncategorized", limit: 200 });
      const blikIds = (txs as any[])
        .filter((t) => /BLIK\s+REF/i.test(t.title || ""))
        .map((t) => t.id);

      if (!blikIds.length) {
        setError("No uncategorized BLIK transactions found.");
        return;
      }
      const { enrichments: results } = await api.gmailEnrichBlik(blikIds);
      setEnrichments(results.filter((e) => e.suggested_merchant));
      if (!results.filter((e) => e.suggested_merchant).length) {
        setError("No matches found in Gmail for these transactions.");
      }
    } catch (e: any) {
      setError(e.message ?? "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  async function handleApply(e: GmailEnrichment) {
    try {
      const patch: { counterparty?: string; category?: string } = {
        counterparty: e.suggested_merchant ?? undefined,
      };
      if (e.suggested_category) patch.category = e.suggested_category;
      await api.patchTransaction(e.tx_id, patch);
      setApplied((prev) => new Set(prev).add(e.tx_id));
    } catch {
      setError(`Failed to apply enrichment for ${e.tx_id}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status + actions */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Connection</p>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            {connected === null ? "Checking…" : connected ? "Connected" : "Not connected"}
          </div>
          {connected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="text-xs px-3 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? "Opening…" : "Connect Gmail"}
            </button>
          )}
        </div>
        {!connected && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Reads confirmation emails to identify BLIK merchant names.
            Requires <code className="font-mono">GMAIL_CLIENT_ID</code> in .env.
          </p>
        )}
      </div>

      {/* Enrich button */}
      {connected && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">BLIK Enrichment</p>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="w-full text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-left"
          >
            {enriching ? "Searching Gmail…" : "Identify merchants for uncategorized BLIK transactions"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Results */}
      {enrichments.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Suggestions</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {enrichments.map((e) => {
              const isApplied = applied.has(e.tx_id);
              return (
                <div key={e.tx_id} className="rounded-lg border border-border px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{e.suggested_merchant}</p>
                      {e.suggested_category && (
                        <p className="text-muted-foreground">{e.suggested_category}</p>
                      )}
                      <p className="text-muted-foreground/70 mt-0.5">
                        {e.booking_date} · {e.amount} {e.currency}
                      </p>
                      {e.email_subject && (
                        <p className="text-muted-foreground/60 truncate mt-0.5 italic">
                          &ldquo;{e.email_subject}&rdquo;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleApply(e)}
                      disabled={isApplied}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 transition-colors font-medium"
                    >
                      {isApplied ? "Applied" : "Apply"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
