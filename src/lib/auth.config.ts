// Edge-safe auth config — no bcrypt, no prisma, no Node-only APIs.
// Used by middleware. Full auth logic (sign-in, authorize with bcrypt) lives in auth.ts.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  // Providers list intentionally empty here. Middleware only needs JWT decode,
  // not full Credentials authorize. Real authorize is in auth.ts (Node runtime).
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as { role?: string }).role) {
        (token as { role?: string }).role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (token.sub) session.user.id = token.sub;
        const role = (token as { role?: string }).role;
        if (role) (session.user as { role?: string }).role = role;
      }
      return session;
    }
  }
};
