"use server";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuthError } from "next-auth";
import { writeAudit, getClientInfo } from "@/lib/audit";
import { headers } from "next/headers";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { error: "Email/username dan password wajib diisi." };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/"
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      const hdrs = headers();
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: identifier.toLowerCase() }, { username: identifier }]
        },
        select: { id: true, name: true, email: true }
      });
      const { ip, userAgent } = await getClientInfo(hdrs);
      await writeAudit({
        user: user ?? null,
        action: "LOGIN_FAILED",
        entity: "user",
        entityId: user?.id,
        details: { reason: err.type },
        ipAddress: ip,
        userAgent,
        success: false
      });
      if (err.type === "CredentialsSignin") {
        return { error: "Email/username atau password salah, atau akun nonaktif." };
      }
      return { error: "Terjadi kesalahan. Silakan coba lagi." };
    }
    throw err;
  }
}
