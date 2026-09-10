import { NextResponse, type NextRequest } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  await requireAuthPage();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h default
  const points = await prisma.metricSnapshot.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    take: 1440 // 24h * 60min
  });
  return NextResponse.json({ points });
}
