import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { fetchUnifiedActivities, type UnifiedActivity } from "@/lib/activity-sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 10_000;
const cache = new Map<string, { at: number; items: UnifiedActivity[] }>();

/**
 * GET /api/activities/recent?mode=important|all — 5 aktivitas terakhir untuk
 * kartu Beranda. Cache 10 detik di server supaya polling beberapa admin tidak
 * menambah beban database.
 */
export async function GET(req: Request) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const mode = new URL(req.url).searchParams.get("mode") === "all" ? "all" : "important";
  const hit = cache.get(mode);
  if (!hit || Date.now() - hit.at > TTL_MS) {
    const items = await fetchUnifiedActivities({
      limit: 5,
      perSourceLimit: mode === "all" ? 5 : 20,
      importantOnly: mode === "important"
    });
    cache.set(mode, { at: Date.now(), items });
  }
  return NextResponse.json(
    { items: cache.get(mode)!.items, mode, fetchedAt: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } }
  );
}
