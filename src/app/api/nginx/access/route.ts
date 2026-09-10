import { NextResponse } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { getNginxStats } from "@/lib/nginx-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await requireAuthPage();
  try {
    const stats = await getNginxStats(5000);
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal parse nginx log." },
      { status: 500 }
    );
  }
}
