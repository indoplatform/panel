import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 text-slate-900 hover:opacity-90", className)}
      aria-label="Indoplatform Panel"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-amber-500 shadow-sm ring-1 ring-amber-500/40">
        <ShieldCheck className="h-4 w-4" />
      </span>
      {showText && (
        <span className="text-base font-semibold tracking-tight">
          <span className="text-slate-900">indoplatform</span>
          <span className="ml-0.5 font-light text-amber-500">.panel</span>
        </span>
      )}
    </Link>
  );
}
