// Root page — middleware handles routing to /marketing, /drive, or /k10 based on subdomain.
// This is a fallback that redirects to the RaceCor.io marketing homepage.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/marketing')
}
