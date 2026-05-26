import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

const handler = NextAuth({
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
          scope: "users.read tweet.read",
        },
      },
      checks: ["pkce", "state"],
    }),
  ],
  // 💡 DÖNGÜYÜ KIRACAK KRİTİK AYAR:
  // Vercel ve X arasındaki çerez (cookie) uyumsuzluğunu çözer.
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
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };