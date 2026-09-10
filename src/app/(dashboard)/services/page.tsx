import { requireAuthPage } from "@/lib/rbac";
import { ServiceList } from "@/components/service/ServiceList";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  await requireAuthPage();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Services
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Kelola systemd service: start, stop, restart. Hanya SUPER_ADMIN yang bisa execute aksi.
        </p>
      </div>
      <ServiceList />
    </div>
  );
}
