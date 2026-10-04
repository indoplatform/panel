/**
 * Cron: collect VPS metrics → simpan ke Postgres.
 * Jalankan tiap 1 menit via systemd timer / cron:
 *   * * * * * cd /opt/panel && /usr/bin/node scripts/cron-runner.js metrics
 */
import { collectVpsMetrics } from "../src/lib/system";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const m = await collectVpsMetrics();
  await prisma.metricSnapshot.create({
    data: {
      hostname: m.hostname,
      cpuPercent: m.cpuPercent,
      cpuCores: m.cpuCores,
      loadAvg1: m.loadAvg.one,
      loadAvg5: m.loadAvg.five,
      loadAvg15: m.loadAvg.fifteen,
      memTotal: BigInt(m.memory.total),
      memUsed: BigInt(m.memory.used),
      memPercent: m.memory.percent,
      swapTotal: BigInt(m.swap.total),
      swapUsed: BigInt(m.swap.used),
      diskTotal: BigInt(m.disk.total),
      diskUsed: BigInt(m.disk.used),
      diskPercent: m.disk.percent,
      diskReadBytesPerSec: m.diskIo?.readBytesPerSec ?? null,
      diskWriteBytesPerSec: m.diskIo?.writeBytesPerSec ?? null,
      netRxBytes: BigInt(m.network.rxBytes),
      netTxBytes: BigInt(m.network.txBytes),
      netRxBytesPerSec: m.network.rxBytesPerSec ?? null,
      netTxBytesPerSec: m.network.txBytesPerSec ?? null,
      gpuPercent: m.gpu?.utilizationPercent ?? null,
      gpuMemUsedMB: m.gpu?.memUsedMB ?? null,
      gpuModel: m.gpu?.model ?? null,
      processCount: m.processCount
    }
  });
  console.log(
    `[metrics] ${new Date().toISOString()} CPU=${m.cpuPercent.toFixed(1)}% MEM=${m.memory.percent.toFixed(1)}% DISK=${m.disk.percent.toFixed(1)}%`
  );
}

main()
  .catch((e) => {
    console.error("[metrics] error:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
