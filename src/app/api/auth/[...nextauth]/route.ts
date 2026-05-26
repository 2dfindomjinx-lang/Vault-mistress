import NextAuth, { NextAuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    TwitterProvider({
      id: "twitter",
      name: "X",
      clientId: process.env.TWITTER_CLIENT_ID || "", 
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0",
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: { 
          scope: "users.read tweet.read email.read",
        },
      },
      checks: ["pkce", "state"],
    }),
  ],
  cookies: {
    pkceCodeVerifier: {
      name: `next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    state: {
      name: `next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token) {
        // TypeScript hata vermesin diye id'yi güvenli şekilde bağlıyoruz
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };