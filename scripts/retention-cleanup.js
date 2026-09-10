/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function cleanup() {
  const setting = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
  if (!setting) return;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const metricsDeleted = await prisma.metricSnapshot.deleteMany({
    where: { timestamp: { lt: new Date(now - setting.metricRetentionDays * DAY) } }
  });
  const auditDeleted = await prisma.auditLog.deleteMany({
    where: { timestamp: { lt: new Date(now - setting.auditRetentionDays * DAY) } }
  });
  const uptimeDeleted = await prisma.uptimeCheck.deleteMany({
    where: { timestamp: { lt: new Date(now - setting.uptimeRetentionDays * DAY) } }
  });

  console.log(
    `[retention] metrics=${metricsDeleted.count} audit=${auditDeleted.count} uptime=${uptimeDeleted.count} (retention days: ${setting.metricRetentionDays}/${setting.auditRetentionDays}/${setting.uptimeRetentionDays})`
  );
}

cleanup()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
