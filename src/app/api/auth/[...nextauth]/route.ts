import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Twitter({
      id: "twitter",
      name: "X",
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };
