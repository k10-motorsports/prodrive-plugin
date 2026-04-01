import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RaceCor.io Pro Drive',
  description: 'Your sim racing performance dashboard — iRating, Safety Rating, trends, and race history.',
}

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Drive app navigation will go here (auth-gated) */}
      {children}
    </>
  )
}
