import { requireRole } from "@/lib/rbac";
import { fetchUnifiedActivities } from "@/lib/activity-sources";
import { ActivityFeed } from "@/components/audit/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function AktivitasPage() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);

  const items = await fetchUnifiedActivities({ limit: 150, perSourceLimit: 150 });
  const distinctActions = Array.from(new Set(items.map((i) => i.action))).sort();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Aktivitas Pengguna</h2>
        <p className="mt-1 text-sm text-slate-500">
          Feed realtime semua aktivitas user (login, submit, keputusan, booking, sync, dll) di seluruh aplikasi
          yang di-host di VPS ini — KONI Kaltim (dev &amp; prod), Rental.id, Wilayah, dan Panel sendiri.
          Auto-refresh tiap 5 detik.
        </p>
      </div>
      <ActivityFeed initialItems={items} initialActions={distinctActions} />
    </div>
  );
}
