/**
 * Audit log helpers.
 */
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

type AuditUser = {
  id: string;
  name: string;
  email: string;
};

export interface AuditEntry {
  user?: Pick<AuditUser, "id" | "name" | "email"> | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMsg?: string;
  page?: string | null;
}

function resolvePage(explicit?: string | null): string | null {
  if (explicit !== undefined && explicit !== null) return explicit;
  try {
    const h = headers();
    return h.get("x-pathname") ?? null;
  } catch {
    return null;
  }
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const page = resolvePage(entry.page);
    await prisma.auditLog.create({
      data: {
        userId: entry.user?.id ?? null,
        userName: entry.user?.name ?? null,
        userEmail: entry.user?.email ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        details: (entry.details as object) ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        success: entry.success ?? true,
        errorMsg: entry.errorMsg ?? null,
        page
      }
    });
  } catch (e) {
    console.error("Audit log write failed:", e);
    // Audit failure should not break the main action
  }
}

export async function getClientInfo(headers: Headers): Promise<{ ip: string; userAgent: string }> {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  const userAgent = headers.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}
