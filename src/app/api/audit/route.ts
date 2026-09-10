import { NextResponse } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireAuthPage();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);
  const action = searchParams.get("action");
  const entityId = searchParams.get("entityId");
  const userId = searchParams.get("userId");

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit
  });
  return NextResponse.json({ logs });
}
