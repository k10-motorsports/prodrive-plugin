import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/lib/constants'
import { getTokenCssUrl } from '@/lib/tokens/get-token-css-url'
import { getThemeFromCookie, getThemeSetFromCookie } from '@/lib/theme'
import { ThemeScript } from '@/components/ThemeScript'


const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: '/screenshots/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/screenshots/og-image.png'],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [tokenCssUrl, theme] = await Promise.all([
    getThemeSetFromCookie().then(setSlug => getTokenCssUrl(setSlug)),
    getThemeFromCookie(),
  ])

  return (
    <html
      lang="en"
      data-theme={theme}
      data-set={await getThemeSetFromCookie()}
      className={`${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/pdg5yka.css" />
        <ThemeScript />
        {tokenCssUrl && (
          <link rel="stylesheet" href={tokenCssUrl} />
        )}
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
