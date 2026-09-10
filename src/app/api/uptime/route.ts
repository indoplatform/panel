import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuthPage } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  method: z.enum(["HEAD", "GET"]).default("HEAD"),
  intervalSec: z.number().int().min(30).max(3600).default(60),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  isActive: z.boolean().default(true),
  notifyOn: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

export async function GET() {
  await requireAuthPage();
  const targets = await prisma.uptimeTarget.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      checks: { orderBy: { timestamp: "desc" }, take: 1 }
    }
  });
  return NextResponse.json({ targets });
}

export async function POST(req: NextRequest) {
  const user = await requireAuthPage();
  if (user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }
  const target = await prisma.uptimeTarget.create({ data: body });
  return NextResponse.json({ target });
}
