import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Masuk — Indoplatform Panel"
};

export default function LoginPage({
  searchParams
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const heading = "Indoplatform Panel";
  const tagline = "Server monitoring & control center";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-amber-50">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30">
            <ShieldCheck className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          <p className="text-sm text-amber-50/70">{tagline}</p>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-md shadow-2xl">
          <LoginForm />
          <p className="mt-6 border-t border-slate-700/50 pt-4 text-center text-xs text-amber-50/50">
            Akses terbatas. Semua aktivitas login & aksi akan dicatat di audit log.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-amber-50/40">
          Powered by{" "}
          <span className="font-semibold text-amber-500">Indoplatform</span> · MIT License
        </p>
      </div>
    </div>
  );
}
