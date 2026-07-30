"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Machines", icon: "🛠️", match: (p: string) => p === "/" || p.startsWith("/machines") || p.startsWith("/pieces") || p.startsWith("/software") },
  { href: "/journal", label: "Journal", icon: "📓", match: (p: string) => p.startsWith("/journal") },
  { href: "/trash", label: "Corbeille", icon: "🗑️", match: (p: string) => p.startsWith("/trash") },
];

export function BottomNav() {
  const pathname = usePathname() || "/";
  return (
    <nav className="bottom-nav">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className={it.match(pathname) ? "active" : ""}>
          <span className="ic">{it.icon}</span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
