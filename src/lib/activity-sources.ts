import { PrismaClient } from "@prisma/client";
import { getKoniPrisma } from "./koni-db";
import { prisma as panelPrisma } from "./db";

/**
 * Unified cross-app user activity feed.
 *
 * Setiap app yang di-host di VPS ini (KONI dev, KONI prod, Rental, Wilayah,
 * Panel sendiri) punya tabel activity/audit log masing-masing, dengan skema
 * yang sedikit berbeda. Modul ini membaca semua sumber secara paralel dan
 * menyeragamkan bentuknya jadi satu `UnifiedActivity[]`, di-sort terbaru dulu.
 *
 * KONI (dev+prod) dibaca lewat Prisma model `userActivity` (mirror model di
 * schema.prisma Panel, dipointing ke DB KONI via datasource override — lihat
 * koni-db.ts). Rental & Wilayah dibaca via `$queryRaw` langsung supaya schema
 * Panel sendiri tidak perlu "mirror" tabel yang bukan miliknya (raw SQL tidak
 * butuh model Prisma yang cocok, jadi tidak ada risiko schema drift di DB
 * Panel sendiri).
 */

export type ActivitySource = "KONI_DEV" | "KONI_PROD" | "PANEL" | "RENTAL" | "WILAYAH";

export const ACTIVITY_SOURCE_LABELS: Record<ActivitySource, string> = {
  KONI_DEV: "KONI (Dev)",
  KONI_PROD: "KONI (Prod)",
  PANEL: "Panel",
  RENTAL: "Rental.id",
  WILAYAH: "Wilayah"
};

export const ACTIVITY_SOURCE_BASE_URL: Record<ActivitySource, string> = {
  KONI_DEV: "https://konikaltim.indoplatform.id",
  KONI_PROD: "https://keabsahanporprovkaltim.id",
  PANEL: "https://panel.indoplatform.id",
  RENTAL: "https://rental.indoplatform.id",
  WILAYAH: "https://wilayah.indoplatform.id"
};

export interface UnifiedActivity {
  id: string;
  source: ActivitySource;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  role: string | null;
  /** Detail akun dari DB aplikasi asal (saat ini diisi untuk KONI). */
  userUsername?: string | null;
  userKota?: string | null;
  userKontingen?: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  success: boolean;
  errorMsg: string | null;
  page: string | null;
  createdAt: string; // ISO
}

export function buildActivityPageUrl(source: ActivitySource, page: string | null): string | null {
  if (!page) return null;
  const base = ACTIVITY_SOURCE_BASE_URL[source];
  if (!base) return null;
  // Hindari open-redirect: page harus mulai dengan "/"
  if (!page.startsWith("/")) return null;
  return `${base}${page}`;
}

const externalClients = new Map<string, PrismaClient>();
function getExternalPrisma(url: string): PrismaClient {
  let client = externalClients.get(url);
  if (!client) {
    client = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
    externalClients.set(url, client);
  }
  return client;
}

async function fetchKoni(env: "dev" | "prod", opts: FetchOpts): Promise<UnifiedActivity[]> {
  try {
    const client = getKoniPrisma(env);
    const where: Record<string, unknown> = {};
    if (opts.fromDate || opts.toDate) {
      where.createdAt = {
        ...(opts.fromDate ? { gte: opts.fromDate } : {}),
        ...(opts.toDate ? { lte: opts.toDate } : {})
      };
    }
    const rows = await client.userActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit
    });
    // Detail akun (role terkini, kota operator, kontingen, username) supaya admin
    // tahu operator kota mana / tim Capil atau Verifikasi — UserActivity hanya
    // menyimpan nama & email.
    const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v))));
    const users = userIds.length
      ? await client.$queryRaw<Array<{ id: string; username: string | null; role: string | null; kota: string | null; kontingen: string | null }>>`
          SELECT u."id", u."username", u."role"::text AS role, u."kota", k."kode" AS kontingen
          FROM "User" u LEFT JOIN "Kontingen" k ON k."id" = u."kontingenId"
          WHERE u."id" = ANY(${userIds})`
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      id: r.id,
      source: env === "dev" ? ("KONI_DEV" as const) : ("KONI_PROD" as const),
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      role: (r.userId && userById.get(r.userId)?.role) || r.role,
      userUsername: r.userId ? userById.get(r.userId)?.username ?? null : null,
      userKota: r.userId ? userById.get(r.userId)?.kota ?? null : null,
      userKontingen: r.userId ? userById.get(r.userId)?.kontingen ?? null : null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      ipAddress: r.ipAddress,
      success: r.success,
      errorMsg: r.errorMsg,
      page: r.page ?? null,
      createdAt: r.createdAt.toISOString()
    }));
  } catch (e) {
    console.error(`[activity-sources] KONI ${env} fetch failed:`, e);
    return [];
  }
}

async function fetchPanel(opts: FetchOpts): Promise<UnifiedActivity[]> {
  try {
    const where: Record<string, unknown> = {};
    if (opts.fromDate || opts.toDate) {
      where.timestamp = {
        ...(opts.fromDate ? { gte: opts.fromDate } : {}),
        ...(opts.toDate ? { lte: opts.toDate } : {})
      };
    }
    const rows = await panelPrisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: opts.limit
    });
    return rows.map((r) => ({
      id: r.id,
      source: "PANEL" as const,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      role: null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      ipAddress: r.ipAddress,
      success: r.success,
      errorMsg: r.errorMsg,
      page: r.page ?? null,
      createdAt: r.timestamp.toISOString()
    }));
  } catch (e) {
    console.error("[activity-sources] Panel fetch failed:", e);
    return [];
  }
}

interface RentalAuditRow {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string;
  page: string | null;
  createdAt: Date;
}

async function fetchRental(opts: FetchOpts): Promise<UnifiedActivity[]> {
  const url = process.env.RENTAL_DATABASE_URL;
  if (!url) return [];
  try {
    const client = getExternalPrisma(url);
    const conditions: string[] = [];
    if (opts.fromDate) conditions.push(`a."createdAt" >= '${opts.fromDate.toISOString()}'`);
    if (opts.toDate) conditions.push(`a."createdAt" <= '${opts.toDate.toISOString()}'`);
    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await client.$queryRawUnsafe<RentalAuditRow[]>(
      `SELECT a.id, a."userId", u.name as "userName", u.email as "userEmail", u.role as "userRole",
              a.action, a.entity, a."entityId", a.page, a."createdAt"
       FROM "AuditLog" a
       LEFT JOIN "User" u ON u.id = a."userId"
       ${whereSql}
       ORDER BY a."createdAt" DESC
       LIMIT ${opts.limit}`
    );
    return rows.map((r) => ({
      id: r.id,
      source: "RENTAL" as const,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      role: r.userRole,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      ipAddress: null,
      success: true,
      errorMsg: null,
      page: r.page ?? null,
      createdAt: r.createdAt.toISOString()
    }));
  } catch (e) {
    console.error("[activity-sources] Rental fetch failed:", e);
    return [];
  }
}

interface WilayahActivityRow {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  success: boolean;
  errorMsg: string | null;
  page: string | null;
  createdAt: Date;
}

async function fetchWilayah(opts: FetchOpts): Promise<UnifiedActivity[]> {
  const url = process.env.WILAYAH_DATABASE_URL;
  if (!url) return [];
  try {
    const client = getExternalPrisma(url);
    const conditions: string[] = [];
    if (opts.fromDate) conditions.push(`"createdAt" >= '${opts.fromDate.toISOString()}'`);
    if (opts.toDate) conditions.push(`"createdAt" <= '${opts.toDate.toISOString()}'`);
    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await client.$queryRawUnsafe<WilayahActivityRow[]>(
      `SELECT id, "userId", "userName", "userEmail", action, entity, "entityId",
              "ipAddress", success, "errorMsg", page, "createdAt"
       FROM "AdminActivity"
       ${whereSql}
       ORDER BY "createdAt" DESC
       LIMIT ${opts.limit}`
    );
    return rows.map((r) => ({
      id: r.id,
      source: "WILAYAH" as const,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      role: "ADMIN",
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      ipAddress: r.ipAddress,
      success: r.success,
      errorMsg: r.errorMsg,
      page: r.page ?? null,
      createdAt: r.createdAt.toISOString()
    }));
  } catch (e) {
    console.error("[activity-sources] Wilayah fetch failed:", e);
    return [];
  }
}

interface FetchOpts {
  limit: number;
  fromDate?: Date;
  toDate?: Date;
}

const FETCHERS: Record<ActivitySource, (opts: FetchOpts) => Promise<UnifiedActivity[]>> = {
  KONI_DEV: (opts) => fetchKoni("dev", opts),
  KONI_PROD: (opts) => fetchKoni("prod", opts),
  PANEL: fetchPanel,
  RENTAL: fetchRental,
  WILAYAH: fetchWilayah
};

export const ALL_SOURCES: ActivitySource[] = ["KONI_DEV", "KONI_PROD", "PANEL", "RENTAL", "WILAYAH"];

/**
 * Ambil + gabungkan activity dari semua sumber (atau subset via `sources`),
 * sudah di-sort terbaru dulu, dipotong ke `limit` total.
 * `perSourceLimit` membatasi berapa row diambil dari TIAP sumber sebelum
 * digabung — supaya satu sumber yang sangat ramai tidak menenggelamkan
 * sumber lain saat di-merge lalu dipotong ke `limit`.
 */
export async function fetchUnifiedActivities(opts: {
  sources?: ActivitySource[];
  limit?: number;
  perSourceLimit?: number;
  fromDate?: Date;
  toDate?: Date;
} = {}): Promise<UnifiedActivity[]> {
  const sources = opts.sources ?? ALL_SOURCES;
  const perSourceLimit = opts.perSourceLimit ?? 500;
  const limit = opts.limit ?? 200;
  const fetchOpts: FetchOpts = {
    limit: perSourceLimit,
    fromDate: opts.fromDate,
    toDate: opts.toDate
  };

  const results = await Promise.all(sources.map((s) => FETCHERS[s](fetchOpts)));
  const merged = results.flat();
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged.slice(0, limit);
}
