"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatZone } from "@/lib/format";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Actively Monitoring", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30" },
  matched: { label: "Match Found — Authority Notified", color: "text-green-700", bg: "bg-green-500/10 border-green-500/30" },
  resolved: { label: "Resolved", color: "text-blue-700", bg: "bg-blue-500/10 border-blue-500/30" },
};

export default function StatusCheck() {
  const [id, setId] = useState("");
  const [result, setResult] = useState<{ name: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await apiFetch(`/complaints/${id}/status`);
      const data = await res.json();
      if (data.error) setError("Complaint ID not found");
      else setResult(data);
    } catch {
      setError("Request failed — please try again");
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] diya-glow card-accent parchment-card">
      <form onSubmit={checkStatus} className="flex gap-2">
        <input
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--saffron)] focus:shadow-[0_0_0_3px_rgba(232,117,26,0.1)] transition"
          placeholder="Enter complaint ID"
          value={id} onChange={(e) => setId(e.target.value)} required
        />
        <button disabled={loading} className="btn-saffron rounded-xl px-6 text-sm">
          {loading ? "..." : "Check"}
        </button>
      </form>

      {error && <p className="text-xs mt-3 text-[var(--red)]">{error}</p>}
      {result && (
        <div className="mt-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
          <p className="font-medium mb-2">{result.name}</p>
          <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full border ${STATUS_CONFIG[result.status]?.bg} ${STATUS_CONFIG[result.status]?.color}`}>
            {STATUS_CONFIG[result.status]?.label ?? result.status}
          </span>
        </div>
      )}
    </div>
  );
}