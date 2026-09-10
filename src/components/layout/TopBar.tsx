import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export function TopBar({ userName, userEmail, userRole }: Props) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold text-slate-900">
          {new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          })}
        </h1>
      </div>

      <div className="flex items-center gap-3">
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
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
