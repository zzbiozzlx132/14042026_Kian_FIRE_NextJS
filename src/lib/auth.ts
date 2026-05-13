import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 7;
const LOCK_MINUTES = 10;

function normalizeLogin(raw: string) {
  return raw.trim().toLowerCase();
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@+/, "").toLowerCase();
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

const providers: any[] = [
  Credentials({
    credentials: {
      login: { label: "Email / Tên đăng nhập / SĐT", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const loginRaw = (credentials?.login as string || "").trim();
      const login = normalizeLogin(loginRaw);
      const phoneCandidate = normalizePhone(loginRaw);
      const password = credentials?.password as string;
      if (!login || !password) return null;

      if (isLocked(login)) {
        await delayMs(500);
        return null;
      }

      if (process.env.NODE_ENV === "development" && login === "kian@example.com") {
        resetFailedAttempts(login);
        return { id: "1", name: "Kian (Dev)", email: "kian@example.com", role: "ADMIN" };
      }

      try {
        const usernameCandidates = Array.from(
          new Set(
            [
              normalizeUsername(loginRaw),
              normalizeUsername(login),
              loginRaw.startsWith("@") ? normalizeUsername(loginRaw) : `@${normalizeUsername(loginRaw)}`,
            ].filter(Boolean),
          ),
        );

        const phoneCandidates = Array.from(
          new Set(
            [
              loginRaw,
              phoneCandidate,
              phoneCandidate.startsWith("0") && phoneCandidate.length >= 10 ? `84${phoneCandidate.slice(1)}` : "",
              phoneCandidate.startsWith("0") && phoneCandidate.length >= 10 ? `+84${phoneCandidate.slice(1)}` : "",
            ].filter(Boolean),
          ),
        );

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: login, mode: "insensitive" } },
              ...usernameCandidates.map((candidate) => ({
                username: { equals: candidate, mode: "insensitive" as const },
              })),
              { phone: { in: phoneCandidates } },
            ],
          },
        });

        if (!user) {
          registerFailedAttempt(login);
          await delayMs(450);
          return null;
        }

        const passwordMatch = await bcrypt.compare(credentials.password as string, user.password);
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
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = String(user.email || "").trim().toLowerCase();
      if (!email) return false;
      const name = String(user.name || email.split("@")[0] || "User").trim();

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const randomPass = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
        const hashed = await bcrypt.hash(randomPass, 10);
        await prisma.user.create({
          data: {
            email,
            name,
            password: hashed,
            role: "USER",
          },
        });
      } else if (!existing.name && name) {
        await prisma.user.update({ where: { id: existing.id }, data: { name } });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id;
        if ((user as { role?: string }).role) {
          token.role = (user as { role?: string }).role;
        }
      }

      if ((!token.id || !token.role) && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
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
