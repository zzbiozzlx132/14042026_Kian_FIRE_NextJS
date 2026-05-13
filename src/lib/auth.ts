import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 7;
const LOCK_MINUTES = 10;

function normalizeLogin(raw: string) {
  return raw.trim().toLowerCase();
}

function isLocked(login: string) {
  const state = loginAttempts.get(login);
  if (!state) return false;
  if (state.lockedUntil > Date.now()) return true;
  loginAttempts.delete(login);
  return false;
}

function registerFailedAttempt(login: string) {
  const prev = loginAttempts.get(login) || { count: 0, lockedUntil: 0 };
  const nextCount = prev.count + 1;
  const nextState = {
    count: nextCount,
    lockedUntil: nextCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60_000 : 0,
  };
  loginAttempts.set(login, nextState);
}

function resetFailedAttempts(login: string) {
  loginAttempts.delete(login);
}

async function delayMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        login: { label: "Email / Tên đăng nhập / SĐT", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const loginRaw = (credentials?.login as string || "").trim();
        const login = normalizeLogin(loginRaw);
        const password = credentials?.password as string;
        if (!login || !password) return null;

        if (isLocked(login)) {
          await delayMs(500);
          return null;
        }

        // [MOCK AUTH] Cho phép đăng nhập không cần DB trên local
        if (process.env.NODE_ENV === "development" && login === "kian@example.com") {
          resetFailedAttempts(login);
          return { id: "1", name: "Kian (Dev)", email: "kian@example.com", role: "ADMIN" };
        }

        try {
          // Find by email, username, or phone
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: { equals: login, mode: "insensitive" } },
                { username: { equals: login, mode: "insensitive" } },
                { phone: loginRaw },
              ],
            },
          });

          if (!user) {
            registerFailedAttempt(login);
            await delayMs(450);
            return null;
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!passwordMatch) {
            registerFailedAttempt(login);
            await delayMs(450);
            return null;
          }

          resetFailedAttempts(login);

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("Auth DB Error:", error);
          if (process.env.NODE_ENV === "development") {
            resetFailedAttempts(login);
            return { id: "1", name: "Kian (Dev DB Fallback)", email: login, role: "ADMIN" };
          }
          registerFailedAttempt(login);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
});
