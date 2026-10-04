import { NextResponse } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { readServiceStatus } from "@/lib/system";

type ServiceStatusType = "ACTIVE" | "INACTIVE" | "FAILED" | "DEGRADED" | "UNKNOWN";
type ServiceRow = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isCritical: boolean;
  enabled: boolean;
  lastStatus: ServiceStatusType;
  lastChecked: Date | null;
  sshHost: string | null;
  events: Array<{
    id: string;
    status: ServiceStatusType;
    message: string;
    createdAt: Date;
    actorName: string | null;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuthPage();
    const services = (await prisma.monitoredService.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
      include: {
        events: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    })) as unknown as ServiceRow[];

    // Live status (only for local services — ssh not implemented V1.0)
    const enriched = await Promise.all(
      services.map(async (svc: ServiceRow) => {
        let liveStatus: ServiceStatusType = svc.lastStatus;
        if (!svc.sshHost) {
          try {
            liveStatus = await readServiceStatus(svc.name);
          } catch {
            liveStatus = "UNKNOWN";
          }
        }
        return {
          id: svc.id,
          name: svc.name,
          displayName: svc.displayName,
          description: svc.description,
          isCritical: svc.isCritical,
          enabled: svc.enabled,
          liveStatus,
          dbStatus: svc.lastStatus,
          lastChecked: svc.lastChecked,
          lastEvent: svc.events[0] ?? null
        };
      })
    );

    return NextResponse.json({ services: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat daftar service." },
      { status: 500 }
    );
  }
}
