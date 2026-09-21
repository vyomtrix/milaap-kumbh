"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatZone } from "@/lib/format";

type Complaint = { id: number; name: string; age: number; zone: string; status: string; enrolled_at: string };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  matched: "bg-green-500/10 text-green-700 border-green-500/30",
  resolved: "bg-blue-500/10 text-blue-700 border-blue-500/30",
};

export default function ComplaintsTable() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState("all");

  const fetchComplaints = async () => {
    try { const res = await apiFetch("/admin/complaints"); setComplaints(await res.json()); } catch {}
  };

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(fetchComplaints, 8000);
    return () => clearInterval(interval);
  }, []);

  const resolve = async (id: number) => {
    await apiFetch(`/admin/complaints/${id}/resolve`, { method: "POST" });
    fetchComplaints();
  };

  const filtered = filter === "all" ? complaints : complaints.filter((c) => c.status === filter);

  return (
    <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] diya-glow card-accent parchment-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">📋 Complaints ({complaints.length})</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="bg-[var(--surface-2)] border border-[var(--border)] text-xs rounded-lg px-3 py-1.5 outline-none focus:border-[var(--saffron)] transition">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="matched">Matched</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 && <p className="text-sm text-[var(--text-dim)] py-8 text-center">No complaints found.</p>}
        {filtered.map((c) => (
          <div key={c.id} className="flex items-center justify-between bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium">#{c.id} — {c.name}, {c.age}</p>
              <p className="text-xs text-[var(--text-dim)]">{formatZone(c.zone)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${STATUS_STYLE[c.status] ?? ""}`}>{c.status}</span>
              {c.status !== "resolved" && (
                <button onClick={() => resolve(c.id)} className="text-xs px-3 py-1 rounded-lg bg-[var(--surface-3)] hover:bg-[var(--saffron)] hover:text-white transition">
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}