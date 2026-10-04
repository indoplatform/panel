"use client";

/**
 * MetricsChart — grafik CPU/RAM/Disk 24h (Issue 12).
 * X-axis menampilkan label tanggal + jam (bukan cuma point index).
 * Auto-refresh setiap 60 detik (data 24h, perubahan cukup lambat).
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Clock, Activity } from "lucide-react";

interface Snapshot {
  id: string;
  timestamp: string; // ISO
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  netRxBytesPerSec: number | null;
  netTxBytesPerSec: number | null;
  diskReadBytesPerSec: number | null;
  diskWriteBytesPerSec: number | null;
  gpuPercent: number | null;
  gpuMemUsedMB: number | null;
}

interface ChartPoint {
  x: number; // timestamp ms
  cpu: number;
  ram: number;
  disk: number;
  netRx: number;
  netTx: number;
  gpu: number;
  isoDate: string; // "12 Sep 2026"
  isoTime: string; // "14:30"
}

const POLL_INTERVAL_MS = 3_000; // Issue 7: auto-refresh 3 detik (seperti DashboardLive)

export function MetricsChart() {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/metrics/history", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { points: Snapshot[] };
      const parsed: ChartPoint[] = (json.points ?? []).map((p) => {
        const d = new Date(p.timestamp);
        return {
          x: d.getTime(),
          cpu: p.cpuPercent,
          ram: p.memPercent,
          disk: p.diskPercent,
          netRx: p.netRxBytesPerSec ?? 0,
          netTx: p.netTxBytesPerSec ?? 0,
          gpu: p.gpuPercent ?? 0,
          isoDate: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
          isoTime: d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
        };
      });
      setPoints(parsed);
      setErr(null);
      setLastUpdated(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat history metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-sky-600" />
              Grafik 24 Jam
            </CardTitle>
            <CardDescription>
              CPU, RAM, disk — auto-refresh tiap 60 detik (X-axis: tanggal + jam)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            {lastUpdated && (
              <span className="font-mono">{lastUpdated.toLocaleTimeString("id-ID")}</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {err && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            {err}
          </div>
        )}

        {points.length === 0 ? (
          <div className="flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
            {loading ? "Memuat history metrics..." : "Belum ada snapshot metrics — cron job belum jalan."}
          </div>
        ) : (
          <>
            <Chart points={points} />
            <div className="mt-4 grid grid-cols-3 gap-4">
              <SummaryStat points={points} metric="cpu" label="CPU (avg)" color="bg-amber-500" />
              <SummaryStat points={points} metric="ram" label="RAM (avg)" color="bg-sky-500" />
              <SummaryStat points={points} metric="disk" label="Disk (avg)" color="bg-emerald-500" />
            </div>
            {points.some((p) => p.netRx > 0 || p.netTx > 0) && (
              <div className="mt-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Network I/O (KB/s)
                </h3>
                <NetworkChart points={points} />
              </div>
            )}
            {points.some((p) => p.gpu > 0) && (
              <div className="mt-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  GPU Utilization (%)
                </h3>
                <GpuChart points={points} />
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <Badge variant="info">{points.length} snapshots</Badge>
              <span>
                Range: <span className="font-mono">{points[0]?.isoDate} {points[0]?.isoTime}</span>
                {" → "}
                <span className="font-mono">{points[points.length - 1]?.isoDate} {points[points.length - 1]?.isoTime}</span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Chart({ points }: { points: ChartPoint[] }) {
  // SVG line-chart dengan 3 line (CPU/RAM/Disk) + X-axis label tanggal+jam
  const W = 900;
  const H = 220;
  const padding = { top: 16, right: 16, bottom: 36, left: 36 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;

  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;

  const yMax = 100;
  const yScale = (v: number) => padding.top + innerH - (v / yMax) * innerH;
  const xScale = (v: number) => padding.left + ((v - xMin) / xRange) * innerW;

  const buildLine = (key: "cpu" | "ram" | "disk") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p[key]).toFixed(1)}`)
      .join(" ");

  // Pilih ≤ 8 label X-axis evenly distributed biar tidak overlap.
  // Pakai evenly spaced indices (bukan modulo step) supaya label pasti jaraknya rata
  // dan tidak ada gap kosong atau tabrakan ketika points.length kecil.
  const xLabelCount = Math.min(8, points.length);
  const xLabels = points.length <= 8
    ? points
    : Array.from({ length: xLabelCount }, (_, i) => {
        const idx = Math.round((i * (points.length - 1)) / (xLabelCount - 1));
        return points[idx];
      });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik CPU, RAM, disk 24 jam">
        {/* Y-axis grid */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={padding.left}
              x2={W - padding.right}
              y1={yScale(g)}
              y2={yScale(g)}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
            <text x={padding.left - 6} y={yScale(g) + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
              {g}%
            </text>
          </g>
        ))}

        {/* Peak hour band — highlight rentang waktu di mana CPU/RAM/Disk > 70% (trafik tinggi). */}
        {(() => {
          if (points.length === 0) return null;
          const PEAK_THRESHOLD = 70;
          const innerTop = yScale(100);
          const innerBottom = yScale(0);
          const innerH2 = innerBottom - innerTop;
          const ranges: Array<{ startIdx: number; endIdx: number }> = [];
          let rangeStart: number | null = null;
          for (let i = 0; i < points.length; i += 1) {
            const p = points[i];
            const isPeak = Math.max(p.cpu, p.ram, p.disk) >= PEAK_THRESHOLD;
            if (isPeak && rangeStart === null) rangeStart = i;
            if (!isPeak && rangeStart !== null) {
              ranges.push({ startIdx: rangeStart, endIdx: i - 1 });
              rangeStart = null;
            }
          }
          if (rangeStart !== null) ranges.push({ startIdx: rangeStart, endIdx: points.length - 1 });
          return ranges.map((r, i) => {
            const x1 = xScale(points[r.startIdx].x);
            const x2 = xScale(points[r.endIdx].x);
            return (
              <rect
                key={`peak-${i}`}
                x={x1}
                y={innerTop}
                width={Math.max(2, x2 - x1)}
                height={innerH2}
                fill="#f43f5e"
                fillOpacity={0.08}
                pointerEvents="none"
              />
            );
          });
        })()}

        {/* X-axis labels (tanggal + jam) */}
        {xLabels.map((p, idx) => {
          const baseDate = xLabels[0]?.isoDate ?? "";
          const showDate = idx === 0 || xLabels[idx - 1]?.isoDate !== p.isoDate;
          const x = xScale(p.x);
          return (
            <g key={p.x}>
              <line x1={x} x2={x} y1={H - padding.bottom} y2={H - padding.bottom + 4} stroke="#cbd5e1" />
              <text
                x={x}
                y={H - padding.bottom + 16}
                textAnchor="middle"
                fontSize="9"
                fill="#475569"
                fontFamily="monospace"
              >
                {p.isoTime}
              </text>
              {showDate && (
                <text
                  x={x}
                  y={H - padding.bottom + 28}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#0f172a"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {p.isoDate}
                </text>
              )}
            </g>
          );
        })}

        {/* Lines: amber=CPU, sky=RAM, emerald=Disk */}
        <path d={buildLine("cpu")} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
        <path d={buildLine("ram")} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />
        <path d={buildLine("disk")} fill="none" stroke="#10b981" strokeWidth={1.5} />

        {/* Peak marker — titik & label untuk nilai max tiap seri biar operator
            langsung lihat jam mana trafik paling tinggi. */}
        {(() => {
          if (points.length === 0) return null;
          const peakCpu = points.reduce((acc, p) => (p.cpu > acc.cpu ? p : acc), points[0]);
          const peakRam = points.reduce((acc, p) => (p.ram > acc.ram ? p : acc), points[0]);
          const peakDisk = points.reduce((acc, p) => (p.disk > acc.disk ? p : acc), points[0]);
          const markers = [
            { point: peakCpu, color: "#f59e0b", name: "CPU" },
            { point: peakRam, color: "#0ea5e9", name: "RAM" },
            { point: peakDisk, color: "#10b981", name: "Disk" }
          ];
          return markers.map((m) => (
            <g key={`peak-${m.name}`} pointerEvents="none">
              <line
                x1={xScale(m.point.x)}
                x2={xScale(m.point.x)}
                y1={padding.top}
                y2={H - padding.bottom}
                stroke={m.color}
                strokeDasharray="2 4"
                strokeOpacity={0.5}
              />
              <circle cx={xScale(m.point.x)} cy={yScale(m.point[m.name.toLowerCase() as keyof typeof m.point] as number)} r={3} fill={m.color} />
              <text
                x={xScale(m.point.x) + 4}
                y={padding.top + 10}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="600"
                fill={m.color}
              >
                {m.name} {Math.round(m.point[m.name.toLowerCase() as keyof typeof m.point] as number)}% @ {m.point.isoTime}
              </text>
            </g>
          ));
        })()}

        {/* Data points (sub-sampled untuk performance) */}
        {points
          .filter((_, i) => i % Math.ceil(points.length / 40) === 0)
          .map((p) => (
            <g key={p.x}>
              <circle cx={xScale(p.x)} cy={yScale(p.cpu)} r={2} fill="#f59e0b" />
              <circle cx={xScale(p.x)} cy={yScale(p.ram)} r={2} fill="#0ea5e9" />
              <circle cx={xScale(p.x)} cy={yScale(p.disk)} r={2} fill="#10b981" />
            </g>
          ))}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${padding.top - 4})`}>
          <text fontSize="10" fill="#f59e0b" fontFamily="monospace" fontWeight="600">━ CPU</text>
          <text x={50} fontSize="10" fill="#0ea5e9" fontFamily="monospace" fontWeight="600">━ RAM</text>
          <text x={100} fontSize="10" fill="#10b981" fontFamily="monospace" fontWeight="600">━ Disk</text>
        </g>
      </svg>
    </div>
  );
}

function SummaryStat({
  points,
  metric,
  label,
  color
}: {
  points: ChartPoint[];
  metric: "cpu" | "ram" | "disk";
  label: string;
  color: string;
}) {
  // Filter NaN/null entries (data lama sebelum fix metric collector) supaya avg/min/max valid
  const values = points.map((p) => p[metric]).filter((v) => Number.isFinite(v) && v !== null);
  if (values.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-400">—</div>
        <div className="mt-1 text-[11px] text-slate-500 font-mono">no data</div>
      </div>
    );
  }
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{avg.toFixed(1)}%</div>
      <div className="mt-1 text-[11px] text-slate-500 font-mono">
        min {min.toFixed(0)} / max {max.toFixed(0)}
      </div>
    </div>
  );
}

function NetworkChart({ points }: { points: ChartPoint[] }) {
  const W = 900;
  const H = 160;
  const padding = { top: 16, right: 16, bottom: 36, left: 56 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;
  const yMaxRaw = Math.max(1, ...points.flatMap((p) => [p.netRx, p.netTx]));
  const yScale = (v: number) => padding.top + innerH - (v / yMaxRaw) * innerH;
  const xScale = (v: number) => padding.left + ((v - xMin) / xRange) * innerW;
  const buildLine = (key: "netRx" | "netTx") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p[key]).toFixed(1)}`).join(" ");
  const labelStep = Math.max(1, Math.floor(points.length / 8));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik Network I/O 24 jam">
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <g key={r}>
            <line x1={padding.left} x2={W - padding.right} y1={padding.top + innerH * (1 - r)} y2={padding.top + innerH * (1 - r)} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={padding.left - 6} y={padding.top + innerH * (1 - r) + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">{Math.round(yMaxRaw * r)}</text>
          </g>
        ))}
        {xLabels.map((p, idx) => {
          const showDate = idx === 0 || xLabels[idx - 1]?.isoDate !== p.isoDate;
          const x = xScale(p.x);
          return (
            <g key={p.x}>
              <line x1={x} x2={x} y1={H - padding.bottom} y2={H - padding.bottom + 4} stroke="#cbd5e1" />
              <text x={x} y={H - padding.bottom + 16} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="monospace">{p.isoTime}</text>
              {showDate && <text x={x} y={H - padding.bottom + 28} textAnchor="middle" fontSize="9" fill="#0f172a" fontFamily="monospace" fontWeight="600">{p.isoDate}</text>}
            </g>
          );
        })}
        <path d={buildLine("netRx")} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />
        <path d={buildLine("netTx")} fill="none" stroke="#10b981" strokeWidth={1.5} />
        <g transform={`translate(${padding.left}, ${padding.top - 4})`}>
          <text fontSize="10" fill="#0ea5e9" fontFamily="monospace" fontWeight="600">━ Turun (RX)</text>
          <text x={80} fontSize="10" fill="#10b981" fontFamily="monospace" fontWeight="600">━ Naik (TX)</text>
        </g>
      </svg>
    </div>
  );
}

function GpuChart({ points }: { points: ChartPoint[] }) {
  const W = 900;
  const H = 140;
  const padding = { top: 16, right: 16, bottom: 36, left: 36 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;
  const yScale = (v: number) => padding.top + innerH - (v / 100) * innerH;
  const xScale = (v: number) => padding.left + ((v - xMin) / xRange) * innerW;
  const buildLine = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.gpu).toFixed(1)}`).join(" ");
  const labelStep = Math.max(1, Math.floor(points.length / 8));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik GPU 24 jam">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padding.left} x2={W - padding.right} y1={yScale(g)} y2={yScale(g)} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={padding.left - 6} y={yScale(g) + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">{g}%</text>
          </g>
        ))}
        {xLabels.map((p, idx) => {
          const showDate = idx === 0 || xLabels[idx - 1]?.isoDate !== p.isoDate;
          const x = xScale(p.x);
          return (
            <g key={p.x}>
              <line x1={x} x2={x} y1={H - padding.bottom} y2={H - padding.bottom + 4} stroke="#cbd5e1" />
              <text x={x} y={H - padding.bottom + 16} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="monospace">{p.isoTime}</text>
              {showDate && <text x={x} y={H - padding.bottom + 28} textAnchor="middle" fontSize="9" fill="#0f172a" fontFamily="monospace" fontWeight="600">{p.isoDate}</text>}
            </g>
          );
        })}
        <path d={buildLine} fill="none" stroke="#a855f7" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
