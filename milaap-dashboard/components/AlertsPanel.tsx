"use client";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

type AlertMsg = {
  type: string; camera_name?: string; person_name?: string; similarity?: number;
  authority_notified?: string; message?: string; snapshot?: string; timestamp?: number;
};

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertMsg[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const wsUrl = new URL(process.env.NEXT_PUBLIC_WS_URL!);
    wsUrl.searchParams.set("token", token);
    const ws = new WebSocket(wsUrl.toString());
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => setAlerts((prev) => [JSON.parse(e.data), ...prev].slice(0, 50));
    return () => ws.close();
  }, []);

  return (
    <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] h-fit diya-glow card-accent parchment-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">🪔 Live Alerts</h2>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[var(--green)] diya-pulse" : "bg-[var(--red)]"}`} />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      <div className="space-y-3 max-h-[75vh] overflow-y-auto">
        {alerts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">🪔</p>
            <p className="text-sm text-[var(--text-dim)]">No alerts yet</p>
            <p className="text-xs text-[var(--text-dimmer)] mt-1">You'll see matches here in real time</p>
          </div>
        )}
        {alerts.map((a, i) =>
          a.type === "match" ? (
            <div key={i} className="rounded-xl overflow-hidden bg-[var(--red)]/5 border border-[var(--red)]/30">
              {a.snapshot && <img src={`data:image/jpeg;base64,${a.snapshot}`} alt="" className="w-full h-36 object-cover" />}
              <div className="p-3">
                <p className="font-semibold text-[var(--red)] text-sm">🚨 {a.person_name}</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">{a.camera_name} · {(a.similarity! * 100).toFixed(0)}% match</p>
                <p className="text-xs text-[var(--text-dimmer)]">Notified {a.authority_notified}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="text-xs px-3 py-2 rounded-lg bg-[var(--surface-2)] text-[var(--text-dimmer)]">
              [{a.type}] {a.camera_name}: {a.message}
            </div>
          )
        )}
      </div>
    </div>
  );
}
