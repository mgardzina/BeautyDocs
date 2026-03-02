import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    maxAge: 6 * 60 * 60, // 6 hours
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
        code: { label: "Kod 2FA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // Jeśli użytkownik ma numer telefonu, wymagaj kodu 2FA
        if (user.phoneNumber) {
          const code = credentials.code as string;
          if (!code) {
             // Jeśli brak kodu, a jest wymagany -> odrzuć (UI powinno wymusić krok 2FA)
             return null;
          }

          // Weryfikacja kodu OTP
          const verification = await prisma.otpVerification.findFirst({
            where: {
              phoneNumber: user.phoneNumber,
              code: code,
              verified: false,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (!verification) {
            // Kod niepoprawny lub wygasł
            throw new Error("Nieprawidłowy lub wygasły kod SMS");
          }

          // Oznacz kod jako zweryfikowany (opcjonalnie usuń)
          await prisma.otpVerification.update({
            where: { id: verification.id },
            data: { verified: true },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    authorized: async ({ auth }) => {
      return !!auth;
    },
  },
});
