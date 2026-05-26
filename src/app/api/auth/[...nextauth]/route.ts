import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

const handler = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    TwitterProvider({
      clientId: process.env.AUTH_TWITTER_ID as string,
      clientSecret: process.env.AUTH_TWITTER_SECRET as string,
      version: "2.0",
    }),
  ],
});

export { handler as GET, handler as POST };
