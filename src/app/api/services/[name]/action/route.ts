import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { execSystemctl } from "@/lib/system";
import { writeAudit, getClientInfo } from "@/lib/audit";

type ServiceAction = "start" | "stop" | "restart" | "status";

type ServiceStatusType = "ACTIVE" | "INACTIVE" | "FAILED" | "DEGRADED";

const ACTION_MAP: Record<ServiceAction, ServiceAction> = {
  start: "start",
  stop: "stop",
  restart: "restart",
  status: "status"
};

const STATUS_MAP: Record<string, ServiceStatusType> = {
  start: "ACTIVE",
  stop: "INACTIVE",
  restart: "ACTIVE"
};

const bodySchema = z.object({
  action: z.enum(["start", "stop", "restart"])
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const user = await requireSuperAdmin();
  const { ip, userAgent } = await getClientInfo(req.headers);

  const serviceName = decodeURIComponent(params.name);
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const svc = await prisma.monitoredService.findUnique({
    where: { name: serviceName }
  });
  if (!svc) {
    await writeAudit({
      user,
      action:
        body.action === "start"
          ? "SERVICE_START"
          : body.action === "stop"
          ? "SERVICE_STOP"
          : "SERVICE_RESTART",
      entity: "service",
      entityId: serviceName,
      success: false,
      errorMsg: "Service tidak ditemukan",
      ipAddress: ip,
      userAgent
    });
    return NextResponse.json({ error: "Service tidak ditemukan." }, { status: 404 });
  }

  const action = ACTION_MAP[body.action];
  const newStatus = STATUS_MAP[body.action];

  // Execute
  const result = await execSystemctl(serviceName, action, {
    ssh: svc.sshHost
      ? { host: svc.sshHost, user: svc.sshUser ?? "root", keyPath: svc.sshKeyPath ?? undefined }
      : undefined
  });

  // Audit + event
  await Promise.all([
    writeAudit({
      user,
      action:
        body.action === "start"
          ? "SERVICE_START"
          : body.action === "stop"
          ? "SERVICE_STOP"
          : "SERVICE_RESTART",
      entity: "service",
      entityId: svc.id,
      details: { serviceName, output: result.output.slice(0, 500) },
      ipAddress: ip,
      userAgent,
      success: result.success,
      errorMsg: result.success ? undefined : result.output.slice(0, 200)
    }),
    prisma.serviceEvent.create({
      data: {
        serviceId: svc.id,
        status: result.success ? newStatus : "FAILED",
        message: result.output.slice(0, 500),
        actorId: user.id,
        actorName: user.name
      }
    }),
    prisma.monitoredService.update({
      where: { id: svc.id },
      data: {
        lastChecked: new Date(),
        lastStatus: result.success ? newStatus : "FAILED"
      }
    })
  ]);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Gagal ${body.action} service ${serviceName}.`,
        output: result.output,
        status: result.success ? newStatus : "FAILED"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    action,
    service: serviceName,
    output: result.output,
    status: newStatus,
    timestamp: result.timestamp
  });
}
