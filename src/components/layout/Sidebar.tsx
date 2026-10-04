"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  Activity,
  Box,
  Globe,
  Radio,
  ListChecks,
  ServerCog,
  ScrollText,
  Settings,
  ShieldCheck,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@prisma/client";
export type UserRoleType = "SUPER_ADMIN" | "ADMIN" | "VIEWER";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles yang boleh lihat. Kosong = semua. */
  roles?: UserRoleType[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Beranda", icon: Activity, section: "Monitor" },
  { href: "/services", label: "Services", icon: ServerCog, section: "Monitor" },
  { href: "/logs", label: "Logs", icon: ScrollText, section: "Monitor" },
  { href: "/uptime", label: "Uptime", icon: ListChecks, section: "Monitor" },
  { href: "/dns", label: "DNS Manager", icon: Globe, section: "Kontrol", roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/aktivitas", label: "Aktivitas Pengguna", icon: Radio, section: "Kontrol", roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/audit", label: "Audit Log Panel", icon: ShieldCheck, section: "Kontrol", roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, section: "Sistem", roles: ["SUPER_ADMIN"] }
];

interface SidebarProps {
  userRole: UserRoleType;
  /** Mobile drawer state — controls slide-in overlay. */
  open?: boolean;
  /** Dipanggil saat user menutup drawer (backdrop / X / ESC / klik link). */
  onClose?: () => void;
}

export function Sidebar({ userRole, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const visible = NAV_ITEMS.filter((it) => !it.roles || it.roles.includes(userRole));

  const grouped: Record<string, NavItem[]> = {};
  for (const item of visible) {
    const sec = item.section ?? "Lainnya";
    grouped[sec] = grouped[sec] ?? [];
    grouped[sec].push(item);
  }

  const navContent = (onNavigate?: () => void) => (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
        <Box className="h-5 w-5 text-amber-500" />
        <span className="font-semibold tracking-tight">Panel</span>
        <span className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
          v0.1
        </span>
        {onNavigate && (
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={onNavigate}
            className="-mr-2 ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-amber-50 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
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
                      onClick={onNavigate}
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
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible >= lg */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900 text-amber-50 lg:flex lg:flex-col">
        {navContent()}
      </aside>

      {/* Mobile drawer — slide in from left, only below lg */}
      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Tutup menu"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Drawer panel */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
          className={cn(
            "relative flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-900 text-amber-50 shadow-2xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {navContent(onClose)}
        </aside>
      </div>
    </>
  );
}