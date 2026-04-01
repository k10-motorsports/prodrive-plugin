'use client'

export default function IRatingSparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 60
  const h = 20
  const pad = 2

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / range) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  const lastValue = values[values.length - 1]
  const prevValue = values[values.length - 2]
  const trending =
    lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'flat'
  const color =
    trending === 'up'
      ? 'hsl(142, 60%, 55%)'
      : trending === 'down'
        ? 'hsl(0, 70%, 60%)'
        : 'hsl(0, 0%, 50%)'

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="opacity-70"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
