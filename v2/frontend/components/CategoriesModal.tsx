"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type CategoryStat = { name: string; count: number };

export function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirming, setConfirming] = useState<CategoryStat | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setConfirming(null);
    setError("");
    api.listCategoryStats().then(setCategories).catch(() => {});
  }, [open]);

  if (!open) return null;

  function startEdit(name: string) {
    setEditing(name);
    setEditValue(name);
    setError("");
  }

  async function handleRename() {
    if (!editing) return;
    const next = editValue.trim();
    if (!next || next === editing) { setEditing(null); return; }
    setSaving(true);
    setError("");
    try {
      await api.renameCategory(editing, next);
      setCategories(prev =>
        prev.map(c => c.name === editing ? { ...c, name: next } : c)
            .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditing(null);
    } catch {
      setError("Failed to rename — try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirming) return;
    setSaving(true);
    try {
      await api.deleteCategory(confirming.name);
      setCategories(prev => prev.filter(c => c.name !== confirming.name));
      setConfirming(null);
    } catch {
      setError("Failed to delete — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Categories</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* Confirm delete */}
        {confirming ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-medium">Delete <span className="font-semibold">{confirming.name}</span>?</p>
            <p className="text-xs text-muted-foreground">
              {confirming.count} transaction{confirming.count !== 1 ? "s" : ""} will be reset to Uncategorized.
              Matching rules will also be deleted.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setConfirming(null); setError(""); }}
                className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="text-xs px-4 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No categories yet — import transactions first.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Category</th>
                      <th className="px-3 py-2.5 font-medium text-right">Transactions</th>
                      <th className="px-3 py-2.5 w-32" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categories.map(c => (
                      <tr key={c.name} className="group hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2">
                          {editing === c.name ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleRename();
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className="w-full text-sm rounded border border-input bg-background px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          ) : (
                            <span className="cursor-pointer" onDoubleClick={() => startEdit(c.name)}>{c.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                          {c.count}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing === c.name ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={handleRename}
                                disabled={saving}
                                className="text-xs text-emerald-600 hover:text-emerald-500 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEdit(c.name)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => { setConfirming(c); setError(""); }}
                                className="text-xs text-muted-foreground hover:text-destructive"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {error && !confirming && (
              <p className="px-5 py-2 text-xs text-destructive border-t border-border">{error}</p>
            )}

            <div className="px-5 py-3 border-t border-border flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Double-click a name to rename</p>
              <button
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
