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
      <div className="page-shell min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-4">
        <form
          onSubmit={login}
          className="app-card relative overflow-hidden p-7 sm:p-9 rounded-[1.75rem] w-full max-w-sm"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--saffron)] via-[var(--gold)] to-[var(--maroon)]" />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--saffron)] to-[var(--maroon)] flex items-center justify-center text-xl shadow-md mb-5">⌁</div>
          <span className="eyebrow">Restricted access</span>
          <h1 className="text-3xl font-semibold mt-3 mb-1">Control center</h1>
          <p className="text-sm leading-6 text-[var(--text-dim)] mb-6">Use your administrator credentials to manage cameras, cases, and live alerts.</p>
          <label htmlFor="admin-username" className="text-xs font-semibold text-[var(--text-dim)]">Username</label>
          <input id="admin-username" className="focus-ring w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm mt-1.5 mb-4 outline-none focus:border-[var(--indigo)]"
            placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <label htmlFor="admin-password" className="text-xs font-semibold text-[var(--text-dim)]">Password</label>
          <input id="admin-password" type="password" className="focus-ring w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm mt-1.5 mb-3 outline-none focus:border-[var(--indigo)]"
            placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {loginError && <p className="text-xs text-[var(--red)] mb-3">{loginError}</p>}
          <button className="focus-ring btn-saffron w-full rounded-xl py-3 text-sm font-semibold">
            Log in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav role="Admin" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
          <div>
            <span className="eyebrow">Live operations</span>
            <h1 className="text-3xl sm:text-4xl font-semibold mt-3">Control Center</h1>
            <p className="text-sm sm:text-base text-[var(--text-dim)] mt-2">Monitor configured feeds, incoming matches, and case resolution in one place.</p>
          </div>
          <div className="grid grid-cols-3 gap-1 p-1.5 bg-[var(--surface-2)]/85 rounded-2xl border border-[var(--border)] w-full lg:w-auto">
            {(["overview", "cameras", "complaints"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
                className={`focus-ring px-4 py-2 rounded-xl text-sm font-semibold capitalize transition ${
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
