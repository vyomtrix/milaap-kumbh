"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatZone } from "@/lib/format";
import ZoneSelect from "@/components/ZoneSelect";

const DEFAULT_ZONES = Array.from({ length: 32 }, (_, i) => ({
  value: `Zone Area ${i + 1}`,
  label: `Zone ${i + 1} (Zone Area ${i + 1})`,
}));

export default function ComplaintForm() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [zone, setZone] = useState("");
  const [zones, setZones] = useState<{ value: string; label: string }[]>(DEFAULT_ZONES);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locStatus, setLocStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [complaintId, setComplaintId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/zones")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setZones(data);
        }
      })
      .catch(() => {});
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return setLocStatus("Geolocation not supported");
    setLocStatus("Fetching location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("Location captured");
      },
      () => setLocStatus("Could not get location — check permissions"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) return setStatus("Please select a last seen zone");
    if (photos.length === 0) return setStatus("Please add at least one photo");
    if (!location) return setStatus("Please share your current location");
    setLoading(true);
    setStatus(null);
    const form = new FormData();
    form.append("name", name);
    form.append("age", age);
    form.append("zone", zone);
    form.append("phone", phone);
    form.append("message", message);
    form.append("complainant_lat", String(location.lat));
    form.append("complainant_lng", String(location.lng));
    form.append("complainant_address", address);
    photos.forEach((p) => form.append("photos", p));

    try {
      const res = await apiFetch("/enroll", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setComplaintId(data.person_id);
        setName(""); setAge(""); setZone(""); setPhone(""); setMessage("");
        setPhotos([]); setLocation(null); setAddress("");
      } else setStatus(data.error);
    } catch {
      setStatus("Request failed — please try again");
    } finally {
      setLoading(false);
    }
  };

  if (complaintId) {
    return (
      <div className="bg-[var(--surface)] rounded-2xl p-8 border-2 text-center diya-glow card-accent" style={{ borderImage: 'linear-gradient(135deg, var(--green), var(--gold)) 1' }}>
        <div className="w-16 h-16 rounded-full bg-[var(--green)]/10 flex items-center justify-center mx-auto mb-4 text-3xl">
          🪷
        </div>
        <p className="heading-hindi text-sm text-[var(--saffron)] mb-1">शिकायत दर्ज हुई</p>
        <p className="text-lg font-semibold mb-1">Complaint filed successfully</p>
        <p className="text-sm text-[var(--text-dim)] mb-5">Save this reference ID to check status</p>
        <p className="text-4xl font-bold text-[var(--saffron)] mb-6 tracking-tight">#{complaintId}</p>
        <button onClick={() => setComplaintId(null)} className="text-sm text-[var(--saffron)] hover:underline font-medium">
          File another complaint →
        </button>
      </div>
    );
  }

  const inputClass = "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--saffron)] focus:shadow-[0_0_0_3px_rgba(232,117,26,0.1)] transition placeholder:text-[var(--text-dimmer)]";
  const labelClass = "text-xs font-medium text-[var(--text-dim)] block mb-1.5";

  return (
    <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] diya-glow card-accent parchment-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Full name</label>
            <input className={inputClass} placeholder="e.g. Ramesh Patil" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Age</label>
            <input className={inputClass} type="number" placeholder="e.g. 65" value={age} onChange={(e) => setAge(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className={labelClass}>Last seen zone</label>
          <ZoneSelect zones={zones} value={zone} onChange={setZone} />
        </div>

        <div>
          <label className={labelClass}>Your contact number <span className="text-[var(--text-dimmer)]">(optional)</span></label>
          <input className={inputClass} placeholder="+91..." value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Additional details <span className="text-[var(--text-dimmer)]">(optional)</span></label>
          <textarea className={inputClass} rows={2} placeholder="Clothing, distinguishing features, last known activity..." value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[var(--text-dim)]">📍 Your current location</label>
            {location && <span className="text-xs text-[var(--green)] font-medium">✓ Captured</span>}
          </div>
          <button type="button" onClick={getCurrentLocation}
            className="text-xs px-4 py-2 rounded-lg bg-[var(--maroon)] text-white font-semibold hover:opacity-90 transition shadow-md">
            📍 Share my location
          </button>
          {locStatus && !location && <p className="text-xs mt-2 text-[var(--text-dim)]">{locStatus}</p>}
          {location && (
            <input className={`${inputClass} mt-3`} placeholder="Nearby landmark (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          )}
        </div>

        <div>
          <label className={labelClass}>Photos <span className="text-[var(--text-dimmer)]">(multiple angles improve accuracy)</span></label>
          <input className="w-full text-sm text-[var(--text-dim)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:text-[var(--text)] file:text-xs file:font-medium hover:file:bg-[var(--saffron)] hover:file:text-white file:transition file:cursor-pointer"
            type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} required />
        </div>

        <button disabled={loading} className="w-full btn-saffron rounded-xl py-3 text-sm">
          {loading ? "Submitting..." : "🪔 Submit Complaint"}
        </button>
        {status && <p className="text-xs text-[var(--red)] text-center">{status}</p>}
      </form>
    </div>
  );
}