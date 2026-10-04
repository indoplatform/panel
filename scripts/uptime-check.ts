/**
 * Cron: HTTP HEAD/GET check untuk setiap UptimeTarget → simpan ke UptimeCheck.
 * Jalankan tiap 1 menit via cron (atau lebih cepat jika interval target < 60s).
 *
 * PENTING: pakai `rejectUnauthorized: false` di httpsAgent karena banyak target
 * (khususnya yang behind Cloudflare dengan Origin Certificate self-signed) akan
 * fail TLS verification pakai default Node verifier. Kita tidak butuh validasi
 * cert chain untuk uptime check — cukup cek HTTP status response.
 */
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import https from "node:https";

const prisma = new PrismaClient();
const TIMEOUT = 15_000;

// HTTPS agent yang skip verifikasi certificate (Cloudflare Origin Cert, self-signed, dll)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function check(target: { id: string; url: string; method: string; timeoutMs: number }) {
  const start = Date.now();
  try {
    const res = await axios({
      url: target.url,
      method: target.method as "HEAD" | "GET",
      timeout: target.timeoutMs ?? TIMEOUT,
      httpsAgent,
      validateStatus: () => true // any status
    });
    const ms = Date.now() - start;
    const isUp = res.status >= 200 && res.status < 400;
    return {
      targetId: target.id,
      statusCode: res.status,
      responseMs: ms,
      isUp,
      errorMessage: isUp ? null : `HTTP ${res.status}`
    };
  } catch (e) {
    const ms = Date.now() - start;
    return {
      targetId: target.id,
      statusCode: null,
      responseMs: ms,
      isUp: false,
      errorMessage: (e as Error).message.slice(0, 200)
    };
  }
}

async function main() {
  const targets = await prisma.uptimeTarget.findMany({
    where: { isActive: true }
  });
  if (targets.length === 0) {
    console.log("[uptime] no active targets");
    return;
  }
  const results = await Promise.all(targets.map(check));
  await prisma.uptimeCheck.createMany({
    data: results
  });
  const ups = results.filter((r) => r.isUp).length;
  console.log(
    `[uptime] ${new Date().toISOString()} ${ups}/${results.length} UP`
  );
}

main()
  .catch((e) => {
    console.error("[uptime] error:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
