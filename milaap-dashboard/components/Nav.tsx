"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearSession } from "@/lib/auth";

export default function Nav({ role, name }: { role?: string; name?: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b bg-[var(--surface)]/80 backdrop-blur-xl sticky top-0 z-50 border-[var(--border)]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[4.5rem] flex items-center justify-between gap-4">
        <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--saffron)] to-[var(--maroon)] flex items-center justify-center font-bold text-base text-white shadow-md">🪷</div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tracking-tight text-[var(--text)]">Milaap</span>
            <span className="heading-hindi text-sm text-[var(--saffron)] font-normal">मिलाप</span>
          </div>
          {role && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--saffron-light)] text-[var(--saffron)] ml-1 font-medium border border-[var(--saffron)]/20">{role}</span>
          )}
        </Link>
        <div className="flex items-center gap-3 text-sm text-[var(--text-dim)]">
          {name && <span className="hidden sm:inline max-w-36 truncate">{name}</span>}
          {role ? (
            <button onClick={() => { clearSession(); window.location.assign("/"); }} className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--maroon)] hover:bg-[var(--saffron-light)]">
              Sign out
            </button>
          ) : (
            <Link href="/authority" className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--saffron-light)]">Authority portal</Link>
          )}
          <span aria-label="Service online" className="w-2 h-2 rounded-full bg-[var(--green)] diya-pulse shadow-[0_0_6px_rgba(39,174,96,0.5)]" />
        </div>
      </div>
    </header>
  );
}
