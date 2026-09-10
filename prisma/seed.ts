/**
 * Seed database Indoplatform Panel.
 * Jalankan: pnpm db:seed
 *
 * Default SUPER_ADMIN:
 *   email:    admin@panel.local
 *   password: admin123
 *
 * ⚠️ GANTI password setelah login pertama!
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function randomPassword(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function main() {
  console.log("🌱 Seeding Indoplatform Panel database...\n");

  // 1. AppSetting singleton
  const setting = await prisma.appSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      alertCpuPercent: 85,
      alertMemoryPercent: 90,
      alertDiskPercent: 90,
      alertEnabled: true,
      metricRetentionDays: 7,
      auditRetentionDays: 90,
      uptimeRetentionDays: 30,
      dnsManagerEnabled: true,
      serviceManagerEnabled: true,
      logViewerEnabled: true,
      panelName: "Indoplatform Panel"
    }
  });
  console.log(`✓ AppSetting (panelName: "${setting.panelName}")`);

  // 2. Default SUPER_ADMIN user
  const adminEmail = "admin@panel.local";
  const adminPass = "admin123"; // GANTI setelah login pertama!
  const passwordHash = await bcrypt.hash(adminPass, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: "admin",
      passwordHash,
      name: "Panel Administrator",
      role: "SUPER_ADMIN",
      isActive: true
    }
  });
  console.log(`✓ SUPER_ADMIN: ${adminEmail} / ${adminPass}`);

  // 3. Sample MonitoredServices (sesuaikan dengan VPS Anda)
  const services = [
    { name: "konikaltim.service", displayName: "KONI Kaltim (Dev)", description: "Staging Next.js — port 3000", sortOrder: 1, isCritical: true },
    { name: "keabsahan.service", displayName: "KONI Keabsahan (Prod)", description: "Production Next.js — port 3001", sortOrder: 2, isCritical: true },
    { name: "rental.service", displayName: "Rental.id", description: "Rental marketplace — port 3002", sortOrder: 3, isCritical: true },
    { name: "wilayah.service", displayName: "Wilayah", description: "Wilayah microservice — port 3010", sortOrder: 4, isCritical: false },
    { name: "nginx.service", displayName: "Nginx", description: "Reverse proxy + TLS termination", sortOrder: 10, isCritical: true },
    { name: "postgresql.service", displayName: "PostgreSQL", description: "Database server", sortOrder: 11, isCritical: true }
  ];

  for (const svc of services) {
    await prisma.monitoredService.upsert({
      where: { name: svc.name },
      update: {},
      create: svc
    });
  }
  console.log(`✓ MonitoredServices: ${services.length} entries`);

  // 4. Sample UptimeTargets
  const uptimeTargets = [
    { name: "Indoplatform Landing", url: "https://indoplatform.id", sortOrder: 1 },
    { name: "KONI Kaltim (Dev)", url: "https://konikaltim.indoplatform.id/login", sortOrder: 2 },
    { name: "KONI Keabsahan (Prod)", url: "https://keabsahanporprovkaltim.id/login", sortOrder: 3 },
    { name: "Rental.id", url: "https://rental.indoplatform.id/login", sortOrder: 4 },
    { name: "Wilayah", url: "https://wilayah.indoplatform.id/", sortOrder: 5 }
  ];

  for (const t of uptimeTargets) {
    await prisma.uptimeTarget.upsert({
      where: { id: `seed-${t.url}` },
      update: {},
      create: {
        id: `seed-${t.url}`,
        name: t.name,
        url: t.url,
        method: "HEAD",
        intervalSec: 60,
        timeoutMs: 10000,
        isActive: true,
        notifyOn: true,
        sortOrder: t.sortOrder
      }
    });
  }
  console.log(`✓ UptimeTargets: ${uptimeTargets.length} entries`);

  // 5. Initial audit log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      userName: admin.name,
      userEmail: admin.email,
      action: "LOGIN",
      entity: "system",
      entityId: "seed",
      details: { event: "initial-seed", randomSecret: randomPassword().slice(0, 8) + "..." },
      success: true
    }
  });
  console.log("✓ AuditLog: initial seed event\n");

  console.log("🎉 Seed selesai. Silakan login:");
  console.log(`   URL:      http://localhost:3003/login`);
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPass}`);
  console.log("   ⚠️  GANTI password setelah login pertama!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
