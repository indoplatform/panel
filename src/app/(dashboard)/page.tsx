import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLive } from "@/components/dashboard/DashboardLive";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { ServerCog, Globe, Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuthPage();

  // Hitung stat dari DB
  // Untuk "1 failed" yang basi: pakai cek live status via systemctl.is-active,
  // BUKAN rely on lastStatus di DB (yang mungkin stale kalau cron tidak jalan).
  // Hanya hitung FAILED kalau lastChecked < 10 menit lalu (recent check).
  const [enabledServices, dnsCount, auditToday] = await Promise.all([
    prisma.monitoredService.findMany({
      where: { enabled: true },
      select: { id: true, name: true, lastStatus: true, lastChecked: true, sshHost: true }
    }),
    prisma.uptimeTarget.count({ where: { isActive: true } }),
    prisma.auditLog.count({
      where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    })
  ]);
  const { readServiceStatus } = await import("@/lib/system");
  const staleThresholdMs = 10 * 60 * 1000; // 10 menit
  let servicesFailed = 0;
  for (const svc of enabledServices) {
    let isCurrentlyFailed = false;
    if (!svc.sshHost) {
      try {
        const live = await readServiceStatus(svc.name);
        isCurrentlyFailed = live === "FAILED";
      } catch {
        // ignore
      }
    } else if (svc.lastChecked && Date.now() - new Date(svc.lastChecked).getTime() < staleThresholdMs) {
      // Remote service: rely on recent lastStatus (SSH check not implemented V1.0)
      isCurrentlyFailed = svc.lastStatus === "FAILED";
    }
    if (isCurrentlyFailed) servicesFailed++;
  }
  const servicesCount = enabledServices.length;

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

      {/* Quick stats — semua clickable, hover effect + Link ke halaman detail */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link
          href={servicesFailed > 0 ? "/services?status=FAILED" : "/services"}
          className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label={`Lihat detail services (${servicesCount} total${servicesFailed > 0 ? `, ${servicesFailed} gagal` : ""})`}
        >
          <Card className="h-full cursor-pointer transition-all group-hover:border-amber-400 group-hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <ServerCog className="h-3.5 w-3.5" />
                Services
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{servicesCount}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {servicesFailed > 0 ? (
                  <Badge variant="danger" title={`${servicesFailed} service systemd sedang FAILED. Klik card untuk lihat detail & restart.`}>
                    {servicesFailed} failed
                  </Badge>
                ) : (
                  <Badge variant="success">All OK</Badge>
                )}
                <span className="text-slate-400 group-hover:text-amber-600">→</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/uptime"
          className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label={`Lihat detail uptime targets (${dnsCount} URL publik dimonitor)`}
        >
          <Card className="h-full cursor-pointer transition-all group-hover:border-amber-400 group-hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Activity className="h-3.5 w-3.5" />
                Uptime Targets
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{dnsCount}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                URL publik dimonitor
                <span className="text-slate-400 group-hover:text-amber-600">→</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/audit"
          className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label={`Lihat audit log (${auditToday} aktivitas dalam 24 jam)`}
        >
          <Card className="h-full cursor-pointer transition-all group-hover:border-amber-400 group-hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Globe className="h-3.5 w-3.5" />
                Audit (24 jam)
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{auditToday}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                aktivitas tercatat
                <span className="text-slate-400 group-hover:text-amber-600">→</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/settings"
          className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label="Lihat profil & pengaturan akun Anda"
        >
          <Card className="h-full cursor-pointer transition-all group-hover:border-amber-400 group-hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Role Anda
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                <Badge variant="info">{user.role.replace("_", " ")}</Badge>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                {user.email}
                <span className="text-slate-400 group-hover:text-amber-600">→</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <DashboardLive />
      <MetricsChart />

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
