"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UnifiedActivity } from "@/lib/activity-sources";

const SOURCE: Record<string, { label: string; dot: string }> = {
  KONI_DEV: { label: "KONI Dev", dot: "bg-sky-400" },
  KONI_PROD: { label: "KONI", dot: "bg-sky-600" },
  PANEL: { label: "Panel", dot: "bg-amber-500" },
  RENTAL: { label: "Rental", dot: "bg-emerald-500" },
  WILAYAH: { label: "Wilayah", dot: "bg-violet-500" }
};

const ROLE: Record<string, string> = {
  OPERATOR: "Operator",
  TEAM_CAPIL: "Tim Capil",
  TEAM_VERIFIKASI: "Tim Verifikasi",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
  CUSTOMER: "Customer",
  VENDOR: "Vendor"
};

function roleText(a: UnifiedActivity): string {
  if (!a.role) return "";
  const label = ROLE[a.role] ?? a.role;
  return a.role === "OPERATOR" && a.userKota ? `${label} ${a.userKota}` : label;
}

function tone(a: UnifiedActivity): "danger" | "warning" | "info" {
  const x = a.action.toUpperCase();
  if (!a.success || x.includes("TOLAK") || x.includes("FAIL") || x.includes("DELETE") || x.includes("REJECT")) return "danger";
  if (x.includes("REVISI") || x.includes("OVERRIDE")) return "warning";
  return "info";
}

function jam(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
}

/**
 * Kartu ringkas 5 aktivitas pengguna terakhir di Beranda. Sengaja pendek supaya
 * VPS Real-time di bawahnya tetap terlihat. Diperbarui tiap 15 detik hanya saat
 * tab terlihat; server meng-cache 10 detik.
 */
export function RecentActivityCard() {
  const [mode, setMode] = useState<"important" | "all">("important");
  const [items, setItems] = useState<UnifiedActivity[] | null>(null);
  const [failed, setFailed] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/activities/recent?mode=${modeRef.current}`, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { items: UnifiedActivity[] };
        if (!stopped) {
          setItems(body.items);
          setFailed(false);
        }
      } catch {
        if (!stopped) setFailed(true);
      }
    };
    void load();
    const timer = setInterval(load, 15_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode]);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-900">Aktivitas Pengguna Terbaru</span>
            <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-[11px]">
              {(["important", "all"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setItems(null);
                    setMode(m);
                  }}
                  className={cn("rounded px-2 py-0.5", mode === m ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800")}
                >
                  {m === "important" ? "Penting" : "Semua"}
                </button>
              ))}
            </div>
          </div>
          <Link href="/aktivitas" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline">
            Lihat semua / detail <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <ul className="divide-y divide-slate-100 text-xs">
          {items === null &&
            Array.from({ length: 3 }).map((_, i) => <li key={i} className="h-7 animate-pulse rounded bg-slate-50" />)}
          {items?.length === 0 && (
            <li className="py-2 text-slate-500">
              {mode === "important" ? "Tidak ada aktivitas penting terbaru." : "Belum ada aktivitas."}
            </li>
          )}
          {items?.map((a) => (
            <li key={`${a.source}-${a.id}`} className="flex min-w-0 items-center gap-2 py-1.5">
              <span className="w-10 shrink-0 font-mono text-slate-500">{jam(a.createdAt)}</span>
              <span className="hidden w-16 shrink-0 items-center gap-1 text-slate-600 sm:inline-flex">
                <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE[a.source]?.dot)} />
                {SOURCE[a.source]?.label ?? a.source}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-slate-900">{a.userName ?? "-"}</span>
                {roleText(a) && <span className="text-slate-500"> · {roleText(a)}</span>}
              </span>
              <Badge variant={tone(a)} className="max-w-[45%] shrink-0 truncate text-[10px]" title={a.errorMsg ?? a.action}>
                {a.action}
              </Badge>
            </li>
          ))}
        </ul>
        {failed && items === null && <p className="mt-1 text-[11px] text-rose-600">Gagal memuat aktivitas, dicoba lagi otomatis.</p>}
      </CardContent>
    </Card>
  );
}
