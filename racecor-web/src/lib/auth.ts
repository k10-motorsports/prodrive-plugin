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
    // Expose Discord ID + avatar in the JWT and session
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.discordId = profile.id
        token.discordUsername = profile.username
        token.discordDisplayName = profile.global_name ?? profile.username
        token.discordAvatar = profile.avatar
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as unknown as Record<string, unknown>
        user.discordId = token.discordId
        user.discordUsername = token.discordUsername
        user.discordDisplayName = token.discordDisplayName
        user.discordAvatar = token.discordAvatar
      }
      return session
    },
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
