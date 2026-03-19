// Root page — middleware handles routing to /marketing or /drive based on subdomain.
// This is a fallback that redirects to the marketing homepage.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/marketing')
}
