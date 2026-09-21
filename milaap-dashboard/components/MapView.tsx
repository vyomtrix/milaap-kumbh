"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { apiFetch } from "@/lib/api";
import "leaflet/dist/leaflet.css";

type MapData = {
  cameras: { id: number; name: string; lat: number; lng: number; zone: string }[];
  authorities: { id: number; name: string; lat: number; lng: number; zone: string }[];
  alerts: { id: number; lat: number; lng: number; person_name: string; status: string; detected_at: string }[];
};

export default function MapView() {
  const [data, setData] = useState<MapData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/map/data");
        setData(await res.json());
      } catch {}
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!data || data.cameras.length === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 diya-glow">
        <p className="text-sm text-[var(--text-dim)]">No camera locations available yet.</p>
      </div>
    );
  }

  const center: [number, number] = [data.cameras[0].lat, data.cameras[0].lng];

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden diya-glow card-accent">
      <div className="p-4 pb-0">
        <h2 className="font-semibold text-lg">Zone Overview</h2>
        <p className="text-xs text-[var(--text-dim)] mb-3">Cameras, authorities, and recent alerts</p>
      </div>
      <MapContainer center={center} zoom={13} style={{ height: "380px", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {data.cameras.map((c) => (
          <CircleMarker key={`cam-${c.id}`} center={[c.lat, c.lng]} radius={8} pathOptions={{ color: "#e8751a", fillColor: "#e8751a", fillOpacity: 0.8 }}>
            <Popup>📷 {c.name}<br />{c.zone}</Popup>
          </CircleMarker>
        ))}
        {data.authorities.map((a) => (
          <CircleMarker key={`auth-${a.id}`} center={[a.lat, a.lng]} radius={7} pathOptions={{ color: "#8b1a1a", fillColor: "#8b1a1a", fillOpacity: 0.8 }}>
            <Popup>👮 {a.name}<br />{a.zone}</Popup>
          </CircleMarker>
        ))}
        {data.alerts.map((al) => (
          <CircleMarker key={`alert-${al.id}`} center={[al.lat, al.lng]} radius={10} pathOptions={{ color: "#c0392b", fillColor: "#c0392b", fillOpacity: 0.5 }}>
            <Popup>🚨 {al.person_name}<br />{al.status}<br />{new Date(al.detected_at).toLocaleTimeString()}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="flex gap-4 p-3 text-xs text-[var(--text-dim)]">
        <span>🟠 Camera</span>
        <span>🟤 Authority</span>
        <span>🔴 Alert</span>
      </div>
    </div>
  );
}