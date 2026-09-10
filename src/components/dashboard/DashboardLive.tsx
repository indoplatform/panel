"use client";

/**
 * DashboardLive — client component yang fetch metrics real-time dari VPS.
 * Auto-refresh setiap 10 detik via SWR-style polling.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Activity,
  Server,
  RefreshCw,
  Clock
} from "lucide-react";
import { formatBytes, formatUptime } from "@/lib/utils";

interface VpsMetrics {
  timestamp: string;
  hostname: string;
  uptime: number;
  cpuPercent: number;
  cpuCores: number;
  loadAvg: { one: number; five: number; fifteen: number };
  memory: { total: number; used: number; percent: number };
  swap: { total: number; used: number };
  disk: { total: number; used: number; percent: number };
  network: { rxBytes: number; txBytes: number };
  processCount: number;
  topProcesses: Array<{ pid: number; name: string; cpu: number; mem: number }>;
}

export function DashboardLive() {
  const [data, setData] = useState<VpsMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchMetrics() {
    try {
      const res = await fetch("/api/vps/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setErr(null);
      setLastUpdated(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              VPS Real-time
            </CardTitle>
            <CardDescription>
              CPU, RAM, disk, network — refresh tiap 10 detik
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {lastUpdated && (
              <span className="font-mono">
                {lastUpdated.toLocaleTimeString("id-ID")}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {err && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            {err}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricTile
                icon={Cpu}
                label="CPU"
                percent={data.cpuPercent}
                sub={`${data.cpuCores} cores`}
                value={`${data.cpuPercent.toFixed(1)}%`}
              />
              <MetricTile
                icon={MemoryStick}
                label="Memory"
                percent={data.memory.percent}
                sub={formatBytes(data.memory.used)}
                value={`${data.memory.percent.toFixed(1)}%`}
              />
              <MetricTile
                icon={HardDrive}
                label="Disk"
                percent={data.disk.percent}
                sub={formatBytes(data.disk.used)}
                value={`${data.disk.percent.toFixed(1)}%`}
              />
              <MetricTile
                icon={Wifi}
                label="Load (1/5/15)"
                customValue={
                  <div className="font-mono text-sm font-medium text-slate-900">
                    {data.loadAvg.one.toFixed(2)} / {data.loadAvg.five.toFixed(2)} / {data.loadAvg.fifteen.toFixed(2)}
                  </div>
                }
                sub={`uptime ${formatUptime(data.uptime)}`}
                percent={Math.min((data.loadAvg.one / data.cpuCores) * 100, 100)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SmallStat
                icon={Server}
                label="Hostname"
                value={data.hostname}
                mono
              />
              <SmallStat
                icon={Activity}
                label="Processes"
                value={data.processCount.toString()}
              />
              <SmallStat
                icon={Wifi}
                label="Network RX"
                value={formatBytes(data.network.rxBytes)}
                mono
              />
              <SmallStat
                icon={Wifi}
                label="Network TX"
                value={formatBytes(data.network.txBytes)}
                mono
              />
            </div>

            {data.topProcesses.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Top Processes (by CPU)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200 text-left text-slate-500">
                      <tr>
                        <th className="py-1 font-medium">PID</th>
                        <th className="py-1 font-medium">Name</th>
                        <th className="py-1 text-right font-medium">CPU %</th>
                        <th className="py-1 text-right font-medium">MEM %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topProcesses.slice(0, 5).map((p) => (
                        <tr key={p.pid} className="font-mono">
                          <td className="py-1 text-slate-500">{p.pid}</td>
                          <td className="py-1 text-slate-900">{p.name}</td>
                          <td className="py-1 text-right">
                            <Badge variant={p.cpu > 50 ? "warning" : "secondary"}>
                              {p.cpu.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-1 text-right text-slate-700">{p.mem.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  icon: Icon,
  label,
  percent,
  sub,
  value,
  customValue
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  percent: number;
  sub: string;
  value?: string;
  customValue?: React.ReactNode;
}) {
  const color =
    percent >= 90 ? "bg-rose-500" : percent >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2">
        {customValue ?? <div className="text-2xl font-bold text-slate-900">{value}</div>}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
  mono
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-0.5 truncate text-sm font-medium text-slate-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
