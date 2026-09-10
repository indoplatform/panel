import { requireRole } from "@/lib/rbac";
import { DnsManager } from "@/components/dns/DnsManager";

export const dynamic = "force-dynamic";

export default async function DnsPage() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">DNS Manager</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kelola Cloudflare DNS record untuk zone Anda (A, AAAA, CNAME, TXT).
        </p>
      </div>
      <DnsManager />
    </div>
  );
}
