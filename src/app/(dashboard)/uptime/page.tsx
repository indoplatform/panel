import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { UptimeList } from "@/components/uptime/UptimeList";

export const dynamic = "force-dynamic";

export default async function UptimePage() {
  await requireAuthPage();
  const targets = await prisma.uptimeTarget.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      checks: { orderBy: { timestamp: "desc" }, take: 100 }
    }
  });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Uptime Monitor</h2>
        <p className="mt-1 text-sm text-slate-500">
          HTTP HEAD check berkala untuk URL publik. Cron jalan tiap 1 menit (lihat scripts/cron-runner.js).
        </p>
      </div>
      <UptimeList
        targets={targets.map((t) => ({
          id: t.id,
          name: t.name,
          url: t.url,
          method: t.method,
          intervalSec: t.intervalSec,
          isActive: t.isActive,
          notifyOn: t.notifyOn,
          createdAt: t.createdAt.toISOString(),
          checks: t.checks.map((c) => ({
            id: c.id,
            timestamp: c.timestamp.toISOString(),
            statusCode: c.statusCode,
            responseMs: c.responseMs,
            isUp: c.isUp,
            errorMessage: c.errorMessage
          }))
        }))}
      />
    </div>
  );
}
