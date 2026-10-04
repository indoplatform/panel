import { PrismaClient } from "@prisma/client";

/**
 * Prisma client khusus Panel yang read dari KONI DB — dev (`konikaltim`) atau
 * prod (`prod_koni`). Lazy-init karena Next.js build-time page-data collection
 * akan instantiate semua imported modules — kalau env var belum diset saat
 * build, PrismaClient throw "datasource url undefined".
 *
 * Pakai function/getter pattern: klien dibuat saat runtime pertama
 * (route handler dipanggil), bukan saat module di-load.
 */
export type KoniEnv = "dev" | "prod";

const cached: Partial<Record<KoniEnv, PrismaClient>> = {};

function resolveUrl(env: KoniEnv): string {
  if (env === "prod") {
    const url = process.env.KONI_PROD_DATABASE_URL;
    if (!url) {
      throw new Error("KONI_PROD_DATABASE_URL harus diset di environment agar Panel bisa query DB KONI produksi.");
    }
    return url;
  }
  // KONI_DATABASE_URL = nama env var lama (dari sebelum ada dual dev/prod source).
  const url = process.env.KONI_DEV_DATABASE_URL ?? process.env.KONI_DATABASE_URL;
  if (!url) {
    throw new Error("KONI_DEV_DATABASE_URL (atau KONI_DATABASE_URL) harus diset di environment agar Panel bisa query DB KONI dev.");
  }
  return url;
}

export function getKoniPrisma(env: KoniEnv = "dev"): PrismaClient {
  const existing = cached[env];
  if (existing) return existing;
  const client = new PrismaClient({
    datasources: { db: { url: resolveUrl(env) } },
    log: ["error", "warn"]
  });
  cached[env] = client;
  return client;
}
