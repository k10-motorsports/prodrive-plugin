import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import IRacingUploadForm from './IRacingUploadForm'

export default async function IRacingUploadPage() {
  const session = await auth()
  if (!session?.user) redirect('/drive')

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1
        className="text-2xl font-black mb-2"
        style={{ fontFamily: 'var(--ff-display)' }}
      >
        iRacing Data Import
      </h1>
      <div
        className="rounded-lg p-6 mb-8 text-sm leading-relaxed"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold mb-3">How to export your data</h2>
        <ol className="space-y-2 text-[var(--text-dim)]" style={{ listStyleType: 'decimal', paddingLeft: '1.25rem' }}>
          <li>Go to your <a href="https://members-ng.iracing.com/racing/results" target="_blank" rel="noopener" className="underline text-[var(--text-primary)]">iRacing Results page</a></li>
          <li>Use the dropdown menu to download your results as JSON</li>
          <li>Paste the JSON below or drag the file into the box</li>
        </ol>
      </div>

      <IRacingUploadForm />
    </main>
  )
}
