"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type CameraStatus = { camera_name: string; running: boolean };
type Camera = { id: number; name: string; zone: string; source_configured: boolean };

export default function CameraGrid({ limit }: { limit?: number }) {
  const [statuses, setStatuses] = useState<Record<string, CameraStatus>>({});
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await apiFetch("/cameras/status");
      if (res.ok) setStatuses(await res.json());
    } catch { /* The login view owns authentication errors. */ }
  };

  const fetchCameras = async () => {
    try {
      const query = limit ? `?limit=${limit}` : "";
      const res = await apiFetch(`/admin/cameras${query}`);
      if (!res.ok) throw new Error("Could not load camera configuration");
      setCameras(await res.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load camera configuration");
    }
  };

  useEffect(() => {
    fetchCameras();
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [limit]);

  const startCamera = async (camera: Camera) => {
    const form = new FormData();
    form.append("camera_id", String(camera.id));
    const response = await apiFetch("/cameras/start", { method: "POST", body: form });
    if (!response.ok) {
      const data = await response.json();
      setError(data.detail || "Could not start camera");
      return;
    }
    setError(null);
    setTimeout(() => { fetchStatus(); setRefreshKey((k) => k + 1); }, 1500);
  };

  const stopCamera = async (id: number) => {
    const form = new FormData();
    form.append("camera_id", String(id));
    await apiFetch("/cameras/stop", { method: "POST", body: form });
    fetchStatus();
  };

  const accessToken = getAccessToken();

  return (
    <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] diya-glow card-accent parchment-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">📷 Live Camera Feeds</h2>
        <span className="text-xs text-[var(--text-dim)]">
          {Object.values(statuses).filter((s) => s.running).length} of {cameras.length} active
        </span>
      </div>
      {error && <p className="text-xs text-[var(--red)] mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam) => {
          const isRunning = statuses[cam.id]?.running;
          return (
            <div key={cam.id} className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="aspect-video bg-[#1a1510] flex items-center justify-center relative">
                {isRunning ? (
                  <>
                    <img key={refreshKey} src={`${process.env.NEXT_PUBLIC_API_BASE}/cameras/${cam.id}/stream?access_token=${encodeURIComponent(accessToken ?? "")}`} alt={cam.name} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-xs text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-pulse" /> LIVE
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-dimmer)]">Feed offline</span>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <p className="text-sm font-medium truncate">{cam.name} · {cam.zone}</p>
                <button disabled={!isRunning && !cam.source_configured} onClick={() => (isRunning ? stopCamera(cam.id) : startCamera(cam))}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ml-2 ${
                    isRunning ? "bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25" : cam.source_configured ? "bg-[var(--green)]/15 text-[var(--green)] hover:bg-[var(--green)]/25" : "bg-[var(--surface-3)] text-[var(--text-dimmer)] cursor-not-allowed"
                  }`}>
                  {isRunning ? "Stop" : cam.source_configured ? "Start" : "Unconfigured"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
