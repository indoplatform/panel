import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AuditViewer } from "@/components/audit/AuditViewer";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireAuthPage();
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 200
  });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Audit Log</h2>
        <p className="mt-1 text-sm text-slate-500">
          200 aktivitas terakhir. Semua aksi (login, restart service, edit DNS, dll) tercatat di sini.
        </p>
      </div>
      <AuditViewer initial={logs as unknown as AuditItem[]} canFilter={user.role === "SUPER_ADMIN"} />
    </div>
  );
}

export interface AuditItem {
  id: string;
  timestamp: string | Date;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMsg: string | null;
}
