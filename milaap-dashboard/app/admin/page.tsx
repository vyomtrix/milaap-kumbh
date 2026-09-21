"use client";
import { useState } from "react";
import ComplaintsTable from "@/components/ComplaintsTable";
import CameraGrid from "@/components/CameraGrid";
import AlertsPanel from "@/components/AlertsPanel";
import Nav from "@/components/Nav";
import dynamic from "next/dynamic";
import { getSession, saveSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => getSession()?.role === "admin");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "cameras" | "complaints">("overview");

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    const form = new FormData();
    form.append("username", username);
    form.append("password", pw);
    try {
      const response = await apiFetch("/admin/login", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");
      saveSession({ token: data.access_token, role: "admin" });
      setAuthed(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        <form
          onSubmit={login}
          className="bg-[var(--surface)] p-8 rounded-2xl border border-[var(--border)] w-80"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--indigo)] to-[var(--amber)] flex items-center justify-center font-bold mb-4">A</div>
          <h1 className="text-lg font-semibold mb-1">Admin Access</h1>
          <p className="text-xs text-[var(--text-dim)] mb-4">Control center login</p>
          <input className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm mb-3 outline-none focus:border-[var(--indigo)]"
            placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm mb-3 outline-none focus:border-[var(--indigo)]"
            placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {loginError && <p className="text-xs text-[var(--red)] mb-3">{loginError}</p>}
          <button className="w-full bg-[var(--indigo)] hover:bg-[var(--indigo-hover)] rounded-xl py-2.5 text-sm font-semibold transition">
            Log in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav role="Admin" />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Control Center</h1>
            <p className="text-sm text-[var(--text-dim)]">Real-time monitoring and case management</p>
          </div>
          <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
            {(["overview", "cameras", "complaints"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                  tab === t ? "bg-[var(--indigo)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <MapView />
              <CameraGrid limit={6} />
            </div>
            <AlertsPanel />
          </div>
        )}
        {tab === "cameras" && <CameraGrid />}
        {tab === "complaints" && <ComplaintsTable />}
      </div>
    </div>
  );
}
