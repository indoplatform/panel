import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type UserRoleType = "SUPER_ADMIN" | "ADMIN" | "VIEWER";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRoleType;
};

/**
 * Wajib login. Return null kalau belum, atau session user kalau sudah.
 * Untuk Server Component: gunakan requireAuthPage() di bawah.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role
  };
}

/**
 * Untuk Server Component — redirect ke /login kalau belum auth.
 */
export async function requireAuthPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Untuk Server Component — butuh role tertentu. Redirect ke / kalau kurang.
 */
export async function requireRole(allowed: UserRoleType | UserRoleType[]): Promise<SessionUser> {
  const user = await requireAuthPage();
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(user.role)) {
    redirect("/?error=forbidden");
  }
  return user;
}

/**
 * SUPER_ADMIN only — untuk action destruktif (restart service, edit DNS, dll).
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireRole("SUPER_ADMIN");
}

/**
 * Cek role untuk client component.
 */
export function hasRole(user: SessionUser | null, allowed: UserRoleType | UserRoleType[]): boolean {
  if (!user) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(user.role);
}
