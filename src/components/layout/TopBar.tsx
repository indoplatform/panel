"use client";

import { LogOut, Menu, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleSignOut } from "./topbar-actions";

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  /** Dipanggil saat hamburger ditekan (mobile only). */
  onMenuClick: () => void;
}

export function TopBar({ userName, userEmail, userRole, onMenuClick }: Props) {
  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Buka menu"
          className="-ml-2 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-base font-semibold text-slate-900">
          {new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          })}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden text-right text-xs sm:block">
          <div className="font-medium text-slate-900">{userName}</div>
          <div className="text-slate-500">{userEmail}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
          <UserIcon className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-medium uppercase tracking-wider text-slate-700">
            {userRole.replace("_", " ")}
          </span>
        </div>
        <form action={handleSignOut}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </form>
      </div>
    </header>
  );
}