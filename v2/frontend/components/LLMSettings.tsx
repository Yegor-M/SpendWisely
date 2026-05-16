"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GmailSettings } from "@/components/GmailSettings";

type Provider = "gemini" | "claude" | "openai";

const PROVIDERS: {
  id: Provider;
  name: string;
  description: string;
  model: string;
  free: boolean;
  keyLink: string;
  keyPlaceholder: string;
}[] = [
  {
    id: "gemini",
    name: "Gemini",
    description: "Free tier available — no billing required",
    model: "gemini-2.0-flash",
    free: true,
    keyLink: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza...",
  },
  {
    id: "claude",
    name: "Claude",
    description: "Best categorisation quality",
    model: "claude-haiku-4-5-20251001",
    free: false,
    keyLink: "https://console.anthropic.com/",
    keyPlaceholder: "sk-ant-...",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o mini",
    model: "gpt-4o-mini",
    free: false,
    keyLink: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
];

type Tab = "ai" | "gmail";
type Props = { open: boolean; onClose: () => void };

export function LLMSettings({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("ai");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError("");
    api.getLLMSettings().then((s) => {
      setProvider(s.provider as Provider);
      setKeySet(s.key_set);
      setApiKey("");
    }).catch(() => {});
  }, [open]);

  if (!open) return null;

  const info = PROVIDERS.find((p) => p.id === provider)!;

  async function handleSave() {
    if (!apiKey.trim()) { setError("Paste your API key first"); return; }
    setSaving(true);
    setError("");
    try {
      await api.saveLLMSettings({ provider, api_key: apiKey.trim(), model: info.model });
      setKeySet(true);
      setApiKey("");
      setSaved(true);
    } catch {
      setError("Failed to save — check the key and try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-4 border-b border-border">
          {(["ai", "gmail"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "ai" ? "AI Provider" : "Gmail"}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Gmail tab */}
          <GmailSettings visible={tab === "gmail"} />

          {/* Provider selector — AI tab only */}
          <div className={tab !== "ai" ? "hidden" : ""}>
            <p className="text-xs text-muted-foreground mb-2">Provider</p>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setApiKey(""); setSaved(false); setError(""); }}
                  className={`relative text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    provider === p.id
                      ? "border-foreground bg-accent text-accent-foreground"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {p.free && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded">FREE</span>
                  )}
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* API key input — AI tab only */}
          <div className={tab !== "ai" ? "hidden" : ""}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground">API Key</p>
              <a
                href={info.keyLink}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Get key →
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
                placeholder={keySet ? "••••••••  (key already saved)" : info.keyPlaceholder}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm pr-16 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showKey ? "hide" : "show"}
              </button>
            </div>
            {keySet && !apiKey && (
              <p className="text-[11px] text-emerald-600 mt-1">✓ Key configured — paste a new one to update</p>
            )}
          </div>

          {tab === "ai" && error && <p className="text-xs text-destructive">{error}</p>}
          {saved && <p className="text-xs text-emerald-600">✓ Saved — AI is ready to use</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {tab === "gmail" ? "Close" : "Cancel"}
          </button>
          {tab === "ai" && (
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="text-xs px-4 py-1.5 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
