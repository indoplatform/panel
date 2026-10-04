"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  X,
  RefreshCw,
  Pause,
  Play,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { buildActivityPageUrl, ACTIVITY_SOURCE_BASE_URL, type ActivitySource } from "@/lib/activity-sources";

interface ActivityItem {
  id: string;
  source: ActivitySource;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  role: string | null;
  userUsername?: string | null;
  userKota?: string | null;
  userKontingen?: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  success: boolean;
  errorMsg: string | null;
  page: string | null;
  createdAt: string;
}

const SOURCE_LABEL: Record<ActivitySource, string> = {
  KONI_DEV: "KONI (Dev)",
  KONI_PROD: "KONI (Prod)",
  PANEL: "Panel",
  RENTAL: "Rental.id",
  WILAYAH: "Wilayah"
};

const SOURCE_DOT: Record<ActivitySource, string> = {
  KONI_DEV: "bg-sky-400",
  KONI_PROD: "bg-sky-600",
  PANEL: "bg-amber-500",
  RENTAL: "bg-emerald-500",
  WILAYAH: "bg-violet-500"
};

const ROLE_LABEL: Record<string, string> = {
  OPERATOR: "Operator",
  TEAM_CAPIL: "Tim Capil",
  TEAM_VERIFIKASI: "Tim Verifikasi",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
  USER: "User",
  CUSTOMER: "Customer",
  VENDOR: "Vendor"
};

/** "Operator · Kota Samarinda (KALTIM)", "Tim Capil", dst. */
function roleDetail(l: ActivityItem): string | null {
  if (!l.role) return null;
  const label = ROLE_LABEL[l.role] ?? l.role;
  if (l.role === "OPERATOR") {
    const where = [l.userKota, l.userKontingen ? `(${l.userKontingen})` : null].filter(Boolean).join(" ");
    return where ? `${label} · ${where}` : label;
  }
  return label;
}

function roleTone(role: string | null): string {
  if (role === "OPERATOR") return "bg-sky-100 text-sky-800";
  if (role === "TEAM_CAPIL") return "bg-violet-100 text-violet-800";
  if (role === "TEAM_VERIFIKASI") return "bg-amber-100 text-amber-800";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "bg-slate-800 text-white";
  return "bg-slate-100 text-slate-700";
}

function UserCell({ l }: { l: ActivityItem }) {
  const detail = roleDetail(l);
  return (
    <div className="min-w-0 space-y-0.5 break-words">
      <div className="font-medium text-slate-900">
        {l.userName ?? "-"}
        {l.userUsername && <span className="ml-1 font-normal text-slate-500">@{l.userUsername}</span>}
      </div>
      {detail && (
        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", roleTone(l.role))}>{detail}</span>
      )}
      <div className="break-all text-slate-500">{l.userEmail ?? "-"}</div>
    </div>
  );
}

function actionTone(action: string, success: boolean): "success" | "warning" | "danger" | "info" | "outline" {
  if (!success) return "danger";
  const a = action.toUpperCase();
  if (a.includes("FAIL") || a.includes("TOLAK") || a.includes("REJECT") || a.includes("DELETE") || a.includes("SUSPEND")) return "danger";
  if (a.includes("REVISI") || a.includes("WARNING") || a.includes("PENDING")) return "warning";
  if (a.includes("SUCCESS") || a.includes("LOLOS") || a.includes("CREATE") || a.includes("APPROVE") || a.includes("LOGIN") || a.includes("VERIFIED")) return "success";
  if (a.includes("UPDATE") || a.includes("EDIT") || a.includes("VIEW")) return "info";
  return "outline";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function formatDayLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

const POLL_INTERVAL_MS = 10000;
const PAGE_LIMIT = 100;

export function ActivityFeed({
  initialItems,
  initialActions
}: {
  initialItems: ActivityItem[];
  initialActions: string[];
}) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems);
  const [actions, setActions] = useState<string[]>(initialActions);
  const [source, setSource] = useState<ActivitySource | "">("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pulseNew, setPulseNew] = useState(false);
  // Day filter: tanggal fokus. Default = hari ini (UTC).
  const [day, setDay] = useState<string>(todayIso());
  // Range override (kalau user isi manual).
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [total, setTotal] = useState<number>(initialItems.length);

  const prevIdsRef = useRef<Set<string>>(new Set(initialItems.map((i) => i.id)));

  const fetchNow = useCallback(async (opts: { s?: ActivitySource | ""; a?: string; q?: string; d?: string; from?: string; to?: string } = {}) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_LIMIT));
    const s = opts.s !== undefined ? opts.s : source;
    const a = opts.a !== undefined ? opts.a : actionFilter;
    const q = opts.q !== undefined ? opts.q : search;
    const d = opts.d !== undefined ? opts.d : day;
    const from = opts.from !== undefined ? opts.from : fromDate;
    const to = opts.to !== undefined ? opts.to : toDate;
    if (s) params.set("source", s);
    if (a) params.set("action", a);
    if (q) params.set("search", q);
    if (from || to) {
      if (from) params.set("fromDate", from);
      if (to) params.set("toDate", to);
    } else if (d) {
      params.set("day", d);
    }
    try {
      const res = await fetch(`/api/activities?${params.toString()}`, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: ActivityItem[];
        total: number;
        distinctActions: string[];
      };
      const prevIds = prevIdsRef.current;
      const newCount = data.items.filter((i) => !prevIds.has(i.id)).length;
      prevIdsRef.current = new Set(data.items.map((i) => i.id));
      setItems(data.items);
      setActions(data.distinctActions);
      setTotal(data.total);
      setLastSyncedAt(new Date());
      if (newCount > 0 && !s && !a && !q) {
        setPulseNew(true);
        setTimeout(() => setPulseNew(false), 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [source, actionFilter, search, day, fromDate, toDate]);

  // Debounced search
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        fetchNow({ q: searchInput });
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Realtime polling (matikan kalau user pakai range manual)
  useEffect(() => {
    if (!live) return;
    if (fromDate || toDate) return; // polling pause untuk range manual
    const handle = setInterval(() => fetchNow(), POLL_INTERVAL_MS);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, source, actionFilter, search, day, fromDate, toDate]);

  const isToday = day === todayIso();
  const dayLabel = useMemo(() => formatDayLong(day), [day]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Filter baris 1: search + source + action + live */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama / username / kota / role / email / halaman..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  fetchNow({ q: "" });
                }}
                className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Bersihkan pencarian"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <select
            value={source}
            onChange={(e) => {
              const next = e.target.value as ActivitySource | "";
              setSource(next);
              fetchNow({ s: next });
            }}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm sm:w-auto"
          >
            <option value="">Semua aplikasi</option>
            {(Object.keys(SOURCE_LABEL) as ActivitySource[]).map((s) => (
              <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => {
              const next = e.target.value;
              setActionFilter(next);
              fetchNow({ a: next });
            }}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm sm:w-auto"
          >
            <option value="">Semua action</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
              live ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"
            )}
            title={live ? "Jeda realtime" : "Lanjutkan realtime"}
          >
            {live ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {live ? "Live" : "Jeda"}
          </button>
          <span className="inline-flex w-full items-center gap-1.5 text-xs text-slate-500 sm:ml-auto sm:w-auto">
            <RefreshCw className={cn("h-3 w-3", loading ? "animate-spin text-sky-600" : pulseNew ? "text-sky-600" : "")} />
            {pulseNew ? "Data baru" : lastSyncedAt ? `Sinkron ${lastSyncedAt.toLocaleTimeString("id-ID")}` : "Menyiapkan..."}
            <span className="ml-1">· {items.length} / {total} entri</span>
          </span>
        </div>

        {/* Filter baris 2: date range + day pagination */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-700">Filter tanggal:</span>

          <label className="inline-flex items-center gap-1 text-xs text-slate-600">
            Dari
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                fetchNow({ from: e.target.value });
              }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-slate-600">
            Sampai
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                fetchNow({ to: e.target.value });
              }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
            />
          </label>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
                fetchNow({ from: "", to: "" });
              }}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-600 hover:bg-slate-100"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}

          <span className="mx-2 h-5 w-px bg-slate-300" />

          {/* Day pagination (hanya aktif kalau TIDAK pakai range manual) */}
          <div className={cn("inline-flex items-center gap-1", (fromDate || toDate) && "pointer-events-none opacity-40")}>
            <button
              type="button"
              onClick={() => {
                const next = shiftDay(day, -1);
                setDay(next);
                fetchNow({ d: next });
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
              aria-label="Hari sebelumnya"
              title={formatDayLong(shiftDay(day, -1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <input
              type="date"
              value={day}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setDay(v);
                fetchNow({ d: v });
              }}
              max={todayIso()}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
              aria-label="Pilih hari"
            />
            <button
              type="button"
              onClick={() => {
                const next = shiftDay(day, 1);
                if (next > todayIso()) return;
                setDay(next);
                fetchNow({ d: next });
              }}
              disabled={day >= todayIso()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Hari sesudahnya"
              title={day >= todayIso() ? "Tidak ada data masa depan" : formatDayLong(shiftDay(day, 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const t = todayIso();
                setDay(t);
                fetchNow({ d: t });
              }}
              disabled={isToday}
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Hari ini
            </button>
            <span className="ml-2 text-xs font-medium text-slate-700">{dayLabel}</span>
          </div>
        </div>

        {/* HP: kartu per aktivitas (tabel 7 kolom tidak muat di layar kecil) */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {items.map((l) => {
            const pageUrl = buildActivityPageUrl(l.source, l.page);
            return (
              <li key={`m-${l.source}-${l.id}`} className="space-y-1.5 py-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_DOT[l.source])} />
                    {SOURCE_LABEL[l.source]}
                  </span>
                  <span className="font-mono text-slate-500">{formatDateTime(l.createdAt)}</span>
                </div>
                <UserCell l={l} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={actionTone(l.action, l.success)}>{l.action}</Badge>
                  {l.success ? <Badge variant="success">OK</Badge> : <Badge variant="danger">FAIL</Badge>}
                  {l.entity && (
                    <span className="font-mono text-slate-600">
                      {l.entity}
                      {l.entityId ? `:${l.entityId.slice(0, 8)}` : ""}
                    </span>
                  )}
                </div>
                {l.errorMsg && <div className="text-[11px] text-rose-600">{l.errorMsg}</div>}
                {pageUrl && (
                  <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sky-700 hover:underline">
                    <span className="truncate font-mono text-[11px]">{l.page}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2">Aplikasi</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Halaman</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((l) => {
                const pageUrl = buildActivityPageUrl(l.source, l.page);
                return (
                  <tr key={`${l.source}-${l.id}`} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_DOT[l.source])} />
                        {SOURCE_LABEL[l.source]}
                      </span>
                    </td>
                    <td className="min-w-[220px] px-3 py-2 text-xs">
                      <UserCell l={l} />
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-xs">
                      {pageUrl ? (
                        <a
                          href={pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded text-sky-700 hover:underline"
                          title={`Buka ${l.page} di ${ACTIVITY_SOURCE_BASE_URL[l.source]}`}
                        >
                          <span className="truncate font-mono text-[11px]">{l.page}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={actionTone(l.action, l.success)}>{l.action}</Badge>
                      {l.errorMsg && <div className="mt-1 text-[10px] text-rose-600">{l.errorMsg}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">
                      {l.entity ?? "-"}
                      {l.entityId ? `:${l.entityId.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      {l.success ? <Badge variant="success">OK</Badge> : <Badge variant="danger">FAIL</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            Tidak ada entry untuk filter ini.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
