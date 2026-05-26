import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    TwitterProvider({
      id: "twitter",
      name: "X",
      // TypeScript ünlemlerini ( ! ) temizledik, düz JS uyumlu yaptık
      clientId: process.env.TWITTER_CLIENT_ID, 
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      version: "2.0",
      // Ücretsiz X API hesaplarında döngüye girmeyi engelleyen kritik scope ayarı:
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: { 
          scope: "users.read tweet.read",
        },
      },
      checks: ["pkce", "state"],
    }),
  ],
  // pages: { signIn: "/" } satırını sildik! Hata varsa NextAuth bize artık gösterecek.
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };