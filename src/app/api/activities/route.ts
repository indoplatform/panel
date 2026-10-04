import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { ALL_SOURCES, fetchUnifiedActivities, type ActivitySource } from "@/lib/activity-sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;
const MAX_DATE_RANGE_DAYS = 14; // 1 hari utama + 7 hari sebelum + 7 hari sesudah

function parseDateOnly(v: string | null): Date | null {
  if (!v) return null;
  // Asumsi format "YYYY-MM-DD" → start-of-day UTC
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function endOfDayUtc(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function GET(req: Request) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);

  const url = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT)));
  const sourceParam = url.searchParams.get("source");
  const sources: ActivitySource[] =
    sourceParam && (ALL_SOURCES as string[]).includes(sourceParam) ? [sourceParam as ActivitySource] : ALL_SOURCES;
  const action = url.searchParams.get("action") || undefined;
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

  // Date filter: day fokus = YYYY-MM-DD. Jika tidak ada → hari ini (UTC).
  const todayIso = new Date().toISOString().slice(0, 10);
  const dayParam = parseDateOnly(url.searchParams.get("day")) ?? parseDateOnly(todayIso);
  // fromDate = start of dayParam, toDate = end of dayParam
  const dayFrom: Date | null = dayParam;
  const dayTo: Date | null = dayParam ? endOfDayUtc(dayParam) : null;

  // Range opsional (override dayParam). Validate span max 14 hari.
  const fromParam = parseDateOnly(url.searchParams.get("fromDate"));
  const toParam = parseDateOnly(url.searchParams.get("toDate"));

  let rangeFrom: Date | null;
  let rangeTo: Date | null;
  if (fromParam || toParam) {
    rangeFrom = fromParam;
    rangeTo = toParam ? endOfDayUtc(toParam) : new Date();
    if (rangeFrom && rangeTo) {
      const spanDays = (rangeTo.getTime() - rangeFrom.getTime()) / (24 * 60 * 60 * 1000);
      if (spanDays > MAX_DATE_RANGE_DAYS) {
        rangeTo = new Date(rangeFrom.getTime() + MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
      }
    }
  } else {
    rangeFrom = dayFrom;
    rangeTo = dayTo;
  }

  // Pagination: page (1-based) × perSourceLimit tetap
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perSourceLimit = Math.min(MAX_LIMIT, Math.max(50, limit));

  let items = await fetchUnifiedActivities({
    sources,
    limit: MAX_LIMIT,
    perSourceLimit,
    fromDate: rangeFrom ?? undefined,
    toDate: rangeTo ?? undefined
  });

  if (action) items = items.filter((i) => i.action === action);
  if (search) {
    items = items.filter((i) =>
      [i.userName, i.userEmail, i.userUsername, i.userKota, i.userKontingen, i.role, i.entity, i.entityId, i.errorMsg, i.ipAddress, i.page]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(search))
    );
  }

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);
  const distinctActions = Array.from(new Set(items.map((i) => i.action))).sort();

  return NextResponse.json({
    items: paged,
    total,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    distinctActions,
    day: dayParam?.toISOString().slice(0, 10) ?? null,
    fromDate: rangeFrom?.toISOString() ?? null,
    toDate: rangeTo?.toISOString() ?? null,
    fetchedAt: new Date().toISOString()
  });
}
