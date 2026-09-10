import { NextResponse } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { readServiceStatus } from "@/lib/system";
import type { ServiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuthPage();
    const services = await prisma.monitoredService.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
      include: {
        events: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    // Live status (only for local services — ssh not implemented V1.0)
    const enriched = await Promise.all(
      services.map(async (svc) => {
        let liveStatus: ServiceStatus = svc.lastStatus;
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
