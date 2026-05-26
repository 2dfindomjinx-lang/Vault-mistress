JavaScript
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
          // 💡 Artık Developer Portal'da izin verdiğimiz için 'users.read' yanına 'email.read' de ekledik
          scope: "users.read tweet.read email.read",
        },
      },
      checks: ["pkce", "state"],
    }),
  ],
  // Vercel ve X arasındaki çerez senkronizasyonunu garantiye alan ayar
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
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      return token;
    },
  },
});

export { handler as GET, handler as POST };