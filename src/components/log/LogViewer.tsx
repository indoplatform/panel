"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, ScrollText } from "lucide-react";

interface LogLine {
  timestamp: string;
  unit: string;
  priority: string;
  message: string;
}

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "info" | "secondary" | "default" | "outline"> = {
  EMERG: "danger",
  ALERT: "danger",
  CRIT: "danger",
  ERR: "danger",
  WARN: "warning",
  NOTICE: "info",
  INFO: "secondary",
  DEBUG: "outline"
};

export function LogViewer({
  services
}: {
  services: Array<{ name: string; displayName: string }>;
}) {
  const [selected, setSelected] = useState<string>(services[0]?.name ?? "");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    if (!selected) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(selected)}/logs?lines=300`, {
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLines(json.logs ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal load logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filtered = lines.filter((l) =>
    !filter || l.message.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScrollText className="h-4 w-4 text-slate-500" />
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            {services.map((s) => (
              <option key={s.name} value={s.name}>
                {s.displayName} ({s.name})
              </option>
            ))}
          </select>
          <Input
            placeholder="Filter pesan..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <span className="ml-auto text-xs text-slate-500">
            {filtered.length} baris · auto-refresh 8s
          </span>
        </div>

        {err && (
          <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-slate-200 bg-slate-50 font-mono text-xs scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Tidak ada log.</div>
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l, i) => (
                  <tr key={i} className="hover:bg-white">
                    <td className="whitespace-nowrap px-2 py-1 text-slate-500">
                      {new Date(l.timestamp).toLocaleTimeString("id-ID")}
                    </td>
                    <td className="px-2 py-1">
                      <Badge variant={PRIORITY_VARIANT[l.priority] || "default"}>
                        {l.priority}
                      </Badge>
                    </td>
                    <td className="break-all px-2 py-1 text-slate-800">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
