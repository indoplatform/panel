"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Box,
  Globe,
  ListChecks,
  ServerCog,
  ScrollText,
  Settings,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles yang boleh lihat. Kosong = semua. */
  roles?: UserRole[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Beranda", icon: Activity, section: "Monitor" },
  { href: "/services", label: "Services", icon: ServerCog, section: "Monitor" },
  { href: "/logs", label: "Logs", icon: ScrollText, section: "Monitor" },
  { href: "/uptime", label: "Uptime", icon: ListChecks, section: "Monitor" },
  { href: "/dns", label: "DNS Manager", icon: Globe, section: "Kontrol", roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/audit", label: "Audit Log", icon: ShieldCheck, section: "Kontrol", roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, section: "Sistem", roles: ["SUPER_ADMIN"] }
];

export function Sidebar({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((it) => !it.roles || it.roles.includes(userRole));

  const grouped: Record<string, NavItem[]> = {};
  for (const item of visible) {
    const sec = item.section ?? "Lainnya";
    grouped[sec] = grouped[sec] ?? [];
    grouped[sec].push(item);
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900 text-amber-50 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
        <Box className="h-5 w-5 text-amber-500" />
        <span className="font-semibold tracking-tight">Panel</span>
        <span className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
          v0.1
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-thin">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {section}
            </h3>
            <ul className="space-y-1">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-slate-800 text-amber-500"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-amber-50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4 text-[11px] text-slate-500">
        <div className="font-mono">MIT License</div>
        <div className="mt-1">Indoplatform Panel by CreatorB</div>
      </div>
    </aside>
  );
}
