"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Preceptor {
  id: string;
  name: string;
  email: string | null;
  specialty: string | null;
  site: string | null;
}

export default function PreceptorsPage() {
  const router = useRouter();

  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formSite, setFormSite] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPreceptors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preceptors");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const body = (await res.json()) as { preceptors: Preceptor[] };
      setPreceptors(body.preceptors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preceptors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreceptors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAddForm() {
    setEditingId(null);
    setFormName("");
    setFormEmail("");
    setFormSpecialty("");
    setFormSite("");
    setShowForm(true);
  }

  function openEditForm(p: Preceptor) {
    setEditingId(p.id);
    setFormName(p.name);
    setFormEmail(p.email ?? "");
    setFormSpecialty(p.specialty ?? "");
    setFormSite(p.site ?? "");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    setSaving(true);
    const payload = {
      name: formName.trim(),
      email: formEmail.trim() || null,
      specialty: formSpecialty.trim() || null,
      site: formSite.trim() || null,
    };

    try {
      const res = editingId
        ? await fetch(`/api/preceptors/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/preceptors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? `Failed (${res.status})`);
        setSaving(false);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preceptor");
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    fetchPreceptors();
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/preceptors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete preceptor");
    }
    setDeletingId(null);
    fetchPreceptors();
  }

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-border-light transition-colors"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-lg font-[family-name:var(--font-display)] text-foreground">
            Preceptors
          </h1>
          <button
            type="button"
            onClick={openAddForm}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-accent hover:bg-accent-light transition-colors"
            aria-label="Add preceptor"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 mx-auto w-full max-w-lg">
        {error && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-border bg-error-bg p-3 text-sm text-error">
            {error}
            <button type="button" onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-[var(--radius-lg)] bg-border-light animate-pulse" />
            ))}
          </div>
        ) : preceptors.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-light">
              <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">No preceptors yet</p>
              <p className="text-sm text-muted">Add your preceptors to start recording feedback.</p>
            </div>
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Add preceptor
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {preceptors.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4"
              >
                {/* Avatar initial */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent font-semibold text-sm">
                  {p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted truncate">
                    {p.specialty && <span>{p.specialty}</span>}
                    {p.specialty && p.email && <span className="text-subtle">·</span>}
                    {p.email && <span className="truncate">{p.email}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditForm(p)}
                    className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-border-light transition-colors"
                    aria-label={`Edit ${p.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(p.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-muted hover:text-error hover:bg-error-bg transition-colors"
                    aria-label={`Delete ${p.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-4 shadow-lg"
          >
            <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] text-foreground">
              {editingId ? "Edit Preceptor" : "Add Preceptor"}
            </h2>

            <div className="space-y-3">
              <div>
                <label htmlFor="p-name" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Name *
                </label>
                <input
                  id="p-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                />
              </div>

              <div>
                <label htmlFor="p-email" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Email *
                </label>
                <input
                  id="p-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="jane.smith@hospital.edu"
                  className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                />
              </div>

              <div>
                <label htmlFor="p-specialty" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Specialty
                </label>
                <input
                  id="p-specialty"
                  type="text"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  placeholder="Family Medicine"
                  className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                />
              </div>

              <div>
                <label htmlFor="p-site" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Site
                </label>
                <input
                  id="p-site"
                  type="text"
                  value={formSite}
                  onChange={(e) => setFormSite(e.target.value)}
                  placeholder="UBC FM"
                  className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formName.trim() || !formEmail.trim()}
                className="flex-1 rounded-[var(--radius-md)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Preceptor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-4 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Delete preceptor?</h2>
            <p className="text-sm text-muted">
              This will remove the preceptor from the list. Sessions already recorded with this preceptor will not be affected.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="flex-1 rounded-[var(--radius-md)] bg-error px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
