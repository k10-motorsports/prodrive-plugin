import OverviewCards from './OverviewCards'

export const metadata = {
  title: 'Admin Overview — RaceCor.io Pro Drive',
}

export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-wide uppercase text-[var(--text)] mb-8">
        Admin Overview
      </h1>
      <OverviewCards />
    </div>
  )
}
