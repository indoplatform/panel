import { NextResponse } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await requireAuthPage();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h default
  const points = await prisma.metricSnapshot.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    take: 1440, // 24h * 60min
    select: {
      id: true,
      timestamp: true,
      cpuPercent: true,
      memPercent: true,
      diskPercent: true,
      netRxBytesPerSec: true,
      netTxBytesPerSec: true,
      diskReadBytesPerSec: true,
      diskWriteBytesPerSec: true,
      gpuPercent: true,
      gpuMemUsedMB: true
    }
  });
  return NextResponse.json({ points });
}
