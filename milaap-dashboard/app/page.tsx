"use client";
import { useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import StatusCheck from "@/components/StatusCheck";
import Nav from "@/components/Nav";

export default function Home() {
  const [view, setView] = useState<"file" | "status">("file");

  return (
    <div className="page-shell min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <section className="relative overflow-hidden app-card rounded-[2rem] px-5 py-10 sm:p-12 mb-8">
          <div className="soft-grid absolute inset-0 opacity-60" />
          <div className="relative max-w-3xl mx-auto text-center">
            <span className="eyebrow"><span className="text-base leading-none">✦</span> Kumbh Mela safety network</span>
            <p className="heading-hindi text-xl text-[var(--saffron)] mt-5 mb-1">अपनों को खोजें</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-[var(--text)]">Find your loved one,<br className="hidden sm:block" /> faster.</h1>
            <p className="max-w-xl mx-auto text-sm sm:text-base leading-7 text-[var(--text-dim)] mt-4">
              File a missing-person report, share the last-seen location, and track progress through the Kumbh Mela monitoring network.
            </p>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-6 text-xs font-medium text-[var(--text-dim)]">
              <span>◉ Photo-assisted matching</span><span>◉ Location-aware response</span><span>◉ Status updates</span>
            </div>
          </div>
        </section>

        <div className="flex gap-1 mb-6 p-1.5 bg-[var(--surface-2)]/80 rounded-2xl border border-[var(--border)] w-full sm:w-fit mx-auto">
          <button
            onClick={() => setView("file")}
            className={`focus-ring flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
              view === "file" ? "btn-saffron" : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            🪔 File a Complaint
          </button>
          <button
            onClick={() => setView("status")}
            className={`focus-ring flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
              view === "status" ? "btn-saffron" : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            📿 Check Status
          </button>
        </div>

        {view === "file" ? <ComplaintForm /> : <StatusCheck />}

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="app-card p-5 rounded-2xl card-accent">
            <p className="text-lg mb-2">🛕</p>
            <p className="text-2xl font-bold text-[var(--saffron)]">1,280</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">mapped camera locations</p>
          </div>
          <div className="app-card p-5 rounded-2xl card-accent">
            <p className="text-lg mb-2">🪔</p>
            <p className="text-2xl font-bold text-[var(--maroon)]">14</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">police stations in seed data</p>
          </div>
          <div className="app-card p-5 rounded-2xl card-accent">
            <p className="text-lg mb-2">📿</p>
            <p className="text-2xl font-bold text-[var(--green)]">32</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Kumbh zones in seed data</p>
          </div>
        </div>
      </main>
    </div>
  );
}
