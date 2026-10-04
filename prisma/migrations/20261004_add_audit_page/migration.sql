-- 2026-10-04 — tambah kolom `page` ke AuditLog Panel sendiri + UserActivity (mirror KONI)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "page" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_page_idx" ON "AuditLog" ("page");

-- Mirror UserActivity (cross-app, query via koniPrisma) - defensive: tabel mungkin
-- belum ada jika Panel DB lama. Skip dengan IF NOT EXISTS.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'UserActivity') THEN
    ALTER TABLE "UserActivity" ADD COLUMN IF NOT EXISTS "page" TEXT;
    CREATE INDEX IF NOT EXISTS "UserActivity_page_idx" ON "UserActivity" ("page");
  END IF;
END $$;
