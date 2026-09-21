"use client";
import { useEffect, useRef, useState } from "react";

type Zone = { value: string; label: string };

export default function ZoneSelect({
  zones = [],
  value,
  onChange,
}: {
  zones?: Zone[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const safeZones = Array.isArray(zones) ? zones : [];
  const selected = safeZones.find((z) => z.value === value);

  return (
    <div ref={ref} className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-left outline-none focus:border-[var(--saffron)] focus:shadow-[0_0_0_3px_rgba(232,117,26,0.1)] transition flex items-center justify-between cursor-pointer"
      >
        <span className={selected ? "text-[var(--text)] font-medium" : "text-[var(--text-dimmer)]"}>
          {selected ? selected.label : "Select a zone"}
        </span>
        <span className={`text-xs text-[var(--text-dim)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1 divide-y divide-[var(--border)]/20">
          {safeZones.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--text-dim)] text-center">No zones available</div>
          ) : (
            safeZones.map((z) => (
              <button
                key={z.value}
                type="button"
                onClick={() => {
                  onChange(z.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition cursor-pointer flex items-center justify-between hover:bg-[var(--saffron-light)] ${
                  z.value === value
                    ? "bg-[var(--saffron-light)] text-[var(--saffron)] font-semibold"
                    : "text-[var(--text)]"
                }`}
              >
                <span>{z.label}</span>
                {z.value === value && <span className="text-xs text-[var(--saffron)]">✓</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}