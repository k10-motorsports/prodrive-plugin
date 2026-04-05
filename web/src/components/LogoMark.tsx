/**
 * LogoMark — renders the RaceCor logomark, swapping white/red based on theme.
 * Works in both server and client components (pure CSS switching, no JS).
 *
 * Dark mode → white logomark
 * Light mode → red/colored logomark
 */
export default function LogoMark({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <>
      <img
        src="/branding/racecor-logomark-white.svg"
        alt=""
        className={`${className} logo-dark`}
      />
      <img
        src="/branding/racecor-logomark.svg"
        alt=""
        className={`${className} logo-light`}
      />
    </>
  )
}
