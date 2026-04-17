import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        login: { label: "Email / Tên đăng nhập / SĐT", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const login = (credentials?.login as string || "").trim();
        const password = credentials?.password as string;
        if (!login || !password) return null;

        // [MOCK AUTH] Cho phép đăng nhập không cần DB trên local
        if (process.env.NODE_ENV === "development" && login === "kian@example.com") {
          return { id: "1", name: "Kian (Dev)", email: "kian@example.com", role: "ADMIN" };
        }

        try {
          // Find by email, username, or phone
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: login },
                { username: login },
                { phone: login },
              ],
            },
          });

          if (!user) return null;

          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!passwordMatch) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("Auth DB Error:", error);
          if (process.env.NODE_ENV === "development") {
            return { id: "1", name: "Kian (Dev DB Fallback)", email: login, role: "ADMIN" };
          }
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
