import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  basePath: '/api/auth',
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/drive',
  },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isOnDrive = nextUrl.pathname.startsWith('/drive')
      const isSignedIn = !!session?.user

      // Drive pages require auth (except the login page itself)
      if (isOnDrive && nextUrl.pathname !== '/drive') {
        return isSignedIn
      }
      return true
    },
  },
})
