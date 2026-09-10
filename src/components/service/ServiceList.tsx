"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Square, RotateCw, AlertCircle, ChevronDown } from "lucide-react";

type Status = "ACTIVE" | "INACTIVE" | "FAILED" | "UNKNOWN";

interface Service {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isCritical: boolean;
  liveStatus: Status;
  dbStatus: Status;
  lastChecked: string | null;
}

const STATUS_VARIANT: Record<Status, "success" | "secondary" | "danger" | "outline"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  FAILED: "danger",
  UNKNOWN: "outline"
};

export function ServiceList() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function load() {
    try {
      const res = await fetch("/api/services", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setServices(json.services ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function execAction(name: string, action: "start" | "stop" | "restart") {
    if (!confirm(`Yakin ${action} service ${name}?`)) return;
    setBusyName(name);
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(name)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(`Gagal: ${json.error ?? "unknown"}\n${json.output ?? ""}`);
      } else {
        startTransition(() => load());
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusyName(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat services...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {services.map((s) => (
        <Card key={s.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-900">
                    {s.displayName}
                  </h3>
                  {s.isCritical && (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700"
                      title="Service marked critical — alert if down (V1.1)"
                    >
                      <AlertCircle className="h-2.5 w-2.5" />
                      Critical
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-slate-500">{s.name}</p>
                {s.description && (
                  <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[s.liveStatus]}>
                {s.liveStatus}
              </Badge>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={busyName === s.name || s.liveStatus === "ACTIVE"}
                onClick={() => execAction(s.name, "start")}
              >
                <Play className="h-3 w-3" />
                Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyName === s.name || s.liveStatus === "INACTIVE"}
                onClick={() => execAction(s.name, "stop")}
              >
                <Square className="h-3 w-3" />
                Stop
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyName === s.name}
                onClick={() => execAction(s.name, "restart")}
              >
                <RotateCw className="h-3 w-3" />
                Restart
              </Button>
            </div>

            {s.lastChecked && (
              <p className="text-[11px] text-slate-500">
                Last check: {new Date(s.lastChecked).toLocaleTimeString("id-ID")}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
