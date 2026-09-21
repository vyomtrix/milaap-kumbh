"use client";
import { useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import StatusCheck from "@/components/StatusCheck";
import Nav from "@/components/Nav";

export default function Home() {
  const [view, setView] = useState<"file" | "status">("file");

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="heading-hindi text-lg text-[var(--saffron)] mb-1">अपनों को खोजें</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--text)]">Find Your Loved One</h1>
          <p className="text-[var(--text-dim)]">
            AI-powered missing person detection across Kumbh Mela monitoring zones
          </p>
          <hr className="rangoli-divider" />
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] w-fit mx-auto">
          <button
            onClick={() => setView("file")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              view === "file" ? "btn-saffron" : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            🪔 File a Complaint
          </button>
          <button
            onClick={() => setView("status")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              view === "status" ? "btn-saffron" : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            📿 Check Status
          </button>
        </div>

        {view === "file" ? <ComplaintForm /> : <StatusCheck />}

        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] diya-glow card-accent">
            <p className="text-sm mb-2">🛕</p>
            <p className="text-2xl font-bold text-[var(--saffron)]">1,280+</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Cameras monitored</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] diya-glow card-accent">
            <p className="text-sm mb-2">🪔</p>
            <p className="text-2xl font-bold text-[var(--maroon)]">15</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Response units</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] diya-glow card-accent">
            <p className="text-sm mb-2">📿</p>
            <p className="text-2xl font-bold text-[var(--green)]">33</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Zones covered</p>
          </div>
        </div>
      </main>
    </div>
  );
}