import { NextResponse } from "next/server";
import { requireAuthPage } from "@/lib/rbac";
import { collectVpsMetrics } from "@/lib/system";
import { writeAudit } from "@/lib/audit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // systeminformation requires node runtime

export async function GET() {
  try {
    await requireAuthPage();
    const metrics = await collectVpsMetrics();
    return NextResponse.json(metrics);
  } catch (err) {
    const hdrs = headers();
    await writeAudit({
      action: "METRICS_VIEW",
      entity: "system",
      success: false,
      errorMsg: err instanceof Error ? err.message : String(err),
      ipAddress: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      userAgent: hdrs.get("user-agent") ?? "unknown"
    });
    return NextResponse.json(
      { error: "Gagal mengumpulkan metrik VPS." },
      { status: 500 }
    );
  }
}
