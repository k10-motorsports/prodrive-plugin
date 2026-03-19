import type { Metadata } from 'next'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/constants'

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Public website navigation will go here */}
      {children}
    </>
  )
}
