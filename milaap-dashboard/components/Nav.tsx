"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ role, name }: { role?: string; name?: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b-2 bg-[var(--surface)]/95 backdrop-blur sticky top-0 z-50" style={{ borderImage: 'linear-gradient(90deg, var(--saffron), var(--gold), var(--maroon), var(--gold), var(--saffron)) 1' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--saffron)] to-[var(--maroon)] flex items-center justify-center font-bold text-base text-white shadow-md">🪷</div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tracking-tight text-[var(--text)]">Milaap</span>
            <span className="heading-hindi text-sm text-[var(--saffron)] font-normal">मिलाप</span>
          </div>
          {role && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--saffron-light)] text-[var(--saffron)] ml-1 font-medium border border-[var(--saffron)]/20">{role}</span>
          )}
        </Link>
        <div className="flex items-center gap-4 text-sm text-[var(--text-dim)]">
          {name && <span>{name}</span>}
          <span className="w-2 h-2 rounded-full bg-[var(--saffron)] diya-pulse shadow-[0_0_6px_rgba(232,117,26,0.5)]" />
        </div>
      </div>
    </header>
  );
}