import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLive } from "@/components/dashboard/DashboardLive";
import { ServerCog, Globe, Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuthPage();

  // Hitung stat dari DB
  const [servicesCount, servicesFailed, dnsCount, auditToday] = await Promise.all([
    prisma.monitoredService.count({ where: { enabled: true } }),
    prisma.monitoredService.count({ where: { enabled: true, lastStatus: "FAILED" } }),
    prisma.uptimeTarget.count({ where: { isActive: true } }),
    prisma.auditLog.count({
      where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Beranda
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan VPS & services secara real-time.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <ServerCog className="h-3.5 w-3.5" />
              Services
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{servicesCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {servicesFailed > 0 ? (
                <Badge variant="danger">{servicesFailed} failed</Badge>
              ) : (
                <Badge variant="success">All OK</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Activity className="h-3.5 w-3.5" />
              Uptime Targets
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{dnsCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">URL publik dimonitor</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Globe className="h-3.5 w-3.5" />
              Audit (24 jam)
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{auditToday}</div>
            <div className="mt-1 text-[11px] text-slate-500">aktivitas tercatat</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Role Anda
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              <Badge variant="info">{user.role.replace("_", " ")}</Badge>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{user.email}</div>
          </CardContent>
        </Card>
      </div>

      <DashboardLive />

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>Akses cepat ke fitur utama panel</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button asChild variant="outline" className="justify-start">
            <Link href="/services"><ServerCog className="mr-2 h-4 w-4" />Kelola Services</Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/logs"><ShieldCheck className="mr-2 h-4 w-4" />Lihat Logs</Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/uptime"><Activity className="mr-2 h-4 w-4" />Uptime Monitor</Link>
          </Button>
          {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
            <Button asChild variant="outline" className="justify-start">
              <Link href="/dns"><Globe className="mr-2 h-4 w-4" />DNS Manager</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
