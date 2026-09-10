"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface UptimeCheck {
  id: string;
  timestamp: string;
  statusCode: number | null;
  responseMs: number | null;
  isUp: boolean;
  errorMessage: string | null;
}

interface UptimeTarget {
  id: string;
  name: string;
  url: string;
  method: string;
  intervalSec: number;
  isActive: boolean;
  notifyOn: boolean;
  createdAt: string;
  checks: UptimeCheck[];
}

export function UptimeList({ targets }: { targets: UptimeTarget[] }) {
  const [_, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (targets.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-500">
          <Activity className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Belum ada uptime target. Tambahkan via API:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            POST /api/uptime
          </code>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {targets.map((t) => {
        const last = t.checks[0];
        const upCount = t.checks.filter((c) => c.isUp).length;
        const uptimePct = t.checks.length > 0 ? (upCount / t.checks.length) * 100 : 0;
        return (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{t.name}</h3>
                    {last ? (
                      <Badge variant={last.isUp ? "success" : "danger"}>
                        {last.isUp ? "UP" : "DOWN"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No data</Badge>
                    )}
                  </div>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 break-all font-mono text-xs text-slate-500 hover:text-amber-600"
                  >
                    {t.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Uptime (recent)</div>
                  <div className="text-lg font-bold text-slate-900">{uptimePct.toFixed(1)}%</div>
                  <div className="text-[11px] text-slate-500">
                    {t.checks.length} checks · {t.intervalSec}s
                  </div>
                </div>
              </div>

              {/* Uptime bars */}
              <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded">
                {t.checks.length === 0 ? (
                  <div className="flex-1 bg-slate-100" />
                ) : (
                  [...t.checks].reverse().map((c, i) => (
                    <div
                      key={i}
                      title={`${formatDateTime(c.timestamp)}: ${c.isUp ? "UP" : "DOWN"}${c.responseMs ? ` (${c.responseMs}ms)` : ""}`}
                      className={`h-full w-1 flex-1 ${
                        c.isUp ? "bg-emerald-400" : "bg-rose-500"
                      }`}
                    />
                  ))
                )}
              </div>

              {last && (
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>Last check: {formatDateTime(last.timestamp)}</span>
                  {last.responseMs != null && (
                    <span className="font-mono">{last.responseMs}ms</span>
                  )}
                  {last.statusCode != null && (
                    <span className="font-mono">HTTP {last.statusCode}</span>
                  )}
                  {last.errorMessage && <span className="text-rose-600">{last.errorMessage}</span>}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
