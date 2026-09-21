"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatZone } from "@/lib/format";
import Nav from "@/components/Nav";
import { getSession, saveSession } from "@/lib/auth";

type Alert = {
  id: number; similarity: number; status: string; notes: string | null;
  snapshot: string | null; detected_at: string; person_name: string;
  age: number; zone: string; camera_name: string;
};

export default function AuthorityPage() {
  const [authorityId, setAuthorityId] = useState<number | null>(() => {
    const session = getSession();
    return session?.role === "authority" ? session.authorityId ?? null : null;
  });
  const [authorityName, setAuthorityName] = useState(() => {
    const session = getSession();
    return session?.role === "authority" ? session.name ?? "" : "";
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"all" | "new" | "acknowledged" | "resolved">("all");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const form = new FormData();
    form.append("username", username);
    form.append("password", password);
    try {
      const res = await apiFetch("/authority/login", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      saveSession({ token: data.access_token, role: "authority", authorityId: data.authority_id, name: data.name });
      setAuthorityId(data.authority_id);
      setAuthorityName(data.name);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    }
  };

  const fetchAlerts = async () => {
    const res = await apiFetch("/authority/alerts");
    setAlerts(await res.json());
  };

  useEffect(() => {
    if (!authorityId) return;
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 6000);
    return () => clearInterval(interval);
  }, [authorityId]);

  const acknowledge = async (alertId: number) => {
    await apiFetch(`/authority/alerts/${alertId}/acknowledge`, { method: "POST" });
    if (authorityId) fetchAlerts();
  };

  const resolve = async (alertId: number) => {
    const form = new FormData();
    form.append("notes", noteDraft[alertId] || "");
    await apiFetch(`/authority/alerts/${alertId}/resolve`, { method: "POST", body: form });
    if (authorityId) fetchAlerts();
  };

  if (!authorityId) {
    return (
      <div className="page-shell min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4 py-8">
        <form onSubmit={login} className="app-card relative overflow-hidden p-7 sm:p-9 rounded-[1.75rem] w-full max-w-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--maroon)] via-[var(--gold)] to-[var(--saffron)]" />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--saffron)] to-[var(--maroon)] flex items-center justify-center mb-5 text-xl shadow-md">👮</div>
          <span className="eyebrow">Response desk</span>
          <h1 className="text-3xl font-semibold mt-3 mb-1">Authority portal</h1>
          <p className="heading-hindi text-sm text-[var(--saffron)] mb-5">क्षेत्र अधिकारी पोर्टल</p>
          <label htmlFor="authority-username" className="text-xs text-[var(--text-dim)] block mb-1.5 font-medium">Username</label>
          <input className="focus-ring w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-[var(--saffron)] focus:shadow-[0_0_0_3px_rgba(232,117,26,0.1)] transition"
            id="authority-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <label htmlFor="authority-password" className="text-xs text-[var(--text-dim)] block mb-1.5 font-medium">Password</label>
          <input id="authority-password" type="password" className="focus-ring w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-[var(--saffron)] focus:shadow-[0_0_0_3px_rgba(232,117,26,0.1)] transition"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginError && <p className="text-xs text-[var(--red)] mb-3">{loginError}</p>}
          <button className="focus-ring w-full btn-saffron rounded-xl py-3 text-sm">
            Log in
          </button>
        </form>
      </div>
    );
  }

  const STATUS_STYLE: Record<string, string> = {
    new: "bg-red-500/10 text-[var(--red)] border-red-500/30",
    acknowledged: "bg-amber-500/10 text-[var(--amber)] border-amber-500/30",
    resolved: "bg-green-500/10 text-[var(--green)] border-green-500/30",
  };

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);
  const counts = { new: alerts.filter(a => a.status === "new").length, acknowledged: alerts.filter(a => a.status === "acknowledged").length, resolved: alerts.filter(a => a.status === "resolved").length };

  return (
    <div className="page-shell min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav role="Authority" name={authorityName} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
        <div className="mb-7">
          <span className="eyebrow">Assigned alerts</span>
          <h1 className="text-3xl sm:text-4xl font-semibold mt-3">Response queue</h1>
          <p className="text-sm sm:text-base text-[var(--text-dim)] mt-2">Review, acknowledge, and resolve the matches assigned to your station.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-7">
          <div className="app-card rounded-2xl p-4 text-center card-accent">
            <p className="text-2xl font-bold text-[var(--red)]">{counts.new}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">New</p>
          </div>
          <div className="app-card rounded-2xl p-4 text-center card-accent">
            <p className="text-2xl font-bold text-[var(--amber)]">{counts.acknowledged}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">In progress</p>
          </div>
          <div className="app-card rounded-2xl p-4 text-center card-accent">
            <p className="text-2xl font-bold text-[var(--green)]">{counts.resolved}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Resolved</p>
          </div>
        </div>

        <div className="flex gap-1 mb-5 p-1.5 bg-[var(--surface-2)]/85 rounded-2xl border border-[var(--border)] w-full sm:w-fit overflow-x-auto">
          {(["all", "new", "acknowledged", "resolved"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`focus-ring px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
                filter === f ? "btn-saffron" : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}>{f}</button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-sm text-[var(--text-dim)] text-center py-10">No alerts in this category</p>}
          {filtered.map((a) => (
            <div key={a.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden flex diya-glow">
              {a.snapshot && <img src={`data:image/jpeg;base64,${a.snapshot}`} alt="" className="w-32 h-32 object-cover shrink-0" />}
              <div className="p-4 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{a.person_name}, {a.age}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full border capitalize shrink-0 ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                </div>
                <p className="text-xs text-[var(--text-dim)] mt-1">{a.camera_name} · {formatZone(a.zone)} · {(a.similarity * 100).toFixed(0)}% match</p>
                <p className="text-xs text-[var(--text-dimmer)]">{new Date(a.detected_at).toLocaleString()}</p>

                {a.status !== "resolved" && (
                  <div className="mt-3">
                    {a.status === "new" && (
                      <button onClick={() => acknowledge(a.id)} className="text-xs px-4 py-1.5 rounded-lg bg-[var(--amber)] text-white font-semibold shadow-sm hover:opacity-90 transition">
                        Acknowledge
                      </button>
                    )}
                    {a.status === "acknowledged" && (
                      <div className="flex gap-2">
                        <input className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--saffron)] transition"
                          placeholder="Resolution notes..." value={noteDraft[a.id] || ""}
                          onChange={(e) => setNoteDraft({ ...noteDraft, [a.id]: e.target.value })} />
                        <button onClick={() => resolve(a.id)} className="text-xs px-4 py-1.5 rounded-lg bg-[var(--green)] text-white font-semibold shrink-0 shadow-sm hover:opacity-90 transition">
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {a.notes && <p className="text-xs mt-2 text-[var(--text-dim)] italic">"{a.notes}"</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
