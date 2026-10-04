"use client";

import { useEffect, useState } from "react";
import { Sidebar, type UserRoleType } from "./Sidebar";
import { TopBar } from "./TopBar";

interface Props {
  userName: string;
  userEmail: string;
  userRole: UserRoleType;
  children: React.ReactNode;
}

export function MobileNavShell({ userName, userEmail, userRole, children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar userRole={userRole} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          onMenuClick={() => setOpen(true)}
        />
        <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}