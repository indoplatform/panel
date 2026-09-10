"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, ShieldAlert, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { AuditItem } from "@/app/(dashboard)/audit/page";

const ACTION_COLOR: Record<string, "default" | "info" | "success" | "warning" | "danger" | "outline"> = {
  LOGIN: "success",
  LOGOUT: "outline",
  LOGIN_FAILED: "danger",
  SERVICE_START: "success",
  SERVICE_STOP: "warning",
  SERVICE_RESTART: "info",
  METRICS_VIEW: "outline",
  LOG_VIEW: "outline",
  DNS_CREATE: "info",
  DNS_UPDATE: "info",
  DNS_DELETE: "danger"
};

export function AuditViewer({
  initial,
  canFilter
}: {
  initial: AuditItem[];
  canFilter?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");

  const visible = initial.filter((l) => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      l.userEmail?.toLowerCase().includes(q) ||
      l.userName?.toLowerCase().includes(q) ||
      l.entityId?.toLowerCase().includes(q) ||
      l.ipAddress?.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  });

  const actions = [...new Set(initial.map((l) => l.action))];

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Cari user / IP / entity..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          {canFilter && (
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">Semua action</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {visible.length} / {initial.length} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {formatDateTime(l.timestamp)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium text-slate-900">{l.userName ?? "-"}</div>
                    <div className="text-slate-500">{l.userEmail ?? "-"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={ACTION_COLOR[l.action] ?? "outline"}>{l.action}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                    {l.entity ?? "-"}
                    {l.entityId ? `:${l.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {l.ipAddress ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {l.success ? (
                      <Badge variant="success">
                        <Shield className="mr-1 h-3 w-3" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="danger">
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        FAIL
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              Tidak ada entry.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
