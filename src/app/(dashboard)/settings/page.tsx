import { requireSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSuperAdmin();
  const setting = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
  const userCount = await prisma.user.count();
  const targetCount = await prisma.uptimeTarget.count();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Konfigurasi panel. Hanya SUPER_ADMIN yang bisa akses halaman ini.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi Saat Ini</CardTitle>
          <CardDescription>
            Edit via API atau seed ulang. Coming soon: form edit di sini.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <KV label="Panel Name" value={setting?.panelName ?? "-"} />
          <KV label="Alert CPU threshold" value={`${setting?.alertCpuPercent ?? 85}%`} />
          <KV label="Alert Memory threshold" value={`${setting?.alertMemoryPercent ?? 90}%`} />
          <KV label="Alert Disk threshold" value={`${setting?.alertDiskPercent ?? 90}%`} />
          <KV label="DNS Manager" value={setting?.dnsManagerEnabled ? "Aktif" : "Nonaktif"} />
          <KV label="Service Manager" value={setting?.serviceManagerEnabled ? "Aktif" : "Nonaktif"} />
          <KV label="Log Viewer" value={setting?.logViewerEnabled ? "Aktif" : "Nonaktif"} />
          <KV label="Users" value={userCount.toString()} />
          <KV label="Uptime Targets" value={targetCount.toString()} />
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-medium text-slate-900">{value}</div>
    </div>
  );
}
