import { requireAuthPage } from "@/lib/rbac";
import { MobileNavShell } from "@/components/layout/MobileNavShell";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthPage();
  return (
    <MobileNavShell
      userName={user.name}
      userEmail={user.email}
      userRole={user.role}
    >
      {children}
    </MobileNavShell>
  );
}