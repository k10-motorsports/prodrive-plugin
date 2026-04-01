#!/usr/bin/env npx tsx
/**
 * Seed script: populate the track_maps table from bundled CSV files.
 *
 * Usage:
 *   k10_DATABASE_URL="postgres://..." npx tsx scripts/seed-track-maps.ts
 *
 * The script reads every CSV from the plugin's trackmaps directory,
 * converts each to an SVG path via the csvToSvg() pipeline, and
 * upserts into the track_maps table (skips if trackId already exists).
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { trackMaps } from '../src/db/schema'
import { csvToSvg } from '../src/lib/track-svg'

// ── Config ──────────────────────────────────────────────────────────
const CSV_DIR = path.resolve(
  __dirname,
  '../../racecor-plugin/simhub-plugin/k10-motorsports-data/trackmaps'
)

const TRACK_META: Record<string, { gameName?: string; trackLengthKm?: number }> = {
  'barber 2026':            { gameName: 'iracing', trackLengthKm: 3.7 },
  'bathurst':               { gameName: 'iracing', trackLengthKm: 6.213 },
  'miami gp':               { gameName: 'iracing', trackLengthKm: 5.412 },
  'nurburgring combined':   { gameName: 'iracing', trackLengthKm: 25.378 },
  'nurburgring nordschleife': { gameName: 'iracing', trackLengthKm: 20.832 },
  'oschersleben gp':        { gameName: 'iracing', trackLengthKm: 3.696 },
  'oulton international':   { gameName: 'iracing', trackLengthKm: 4.307 },
  'sebring international':  { gameName: 'iracing', trackLengthKm: 6.019 },
  'spa 2024 up':            { gameName: 'iracing', trackLengthKm: 7.004 },
  'stpete':                 { gameName: 'iracing', trackLengthKm: 2.89 },
  'virginia 2022 full':     { gameName: 'iracing', trackLengthKm: 5.263 },
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Derive a readable track name from the filename stem */
function toTrackName(stem: string): string {
  return stem
    .replace(/\s+\d{4}(\s|$)/g, '$1')     // strip year suffix ("barber 2026" → "barber")
    .replace(/\b\w/g, c => c.toUpperCase()) // title-case
    .replace(/\bGp\b/g, 'GP')
    .trim()
}

/** Derive a stable trackId slug from the filename stem */
function toTrackId(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.k10_DATABASE_URL
  if (!dbUrl) {
    console.error('Error: k10_DATABASE_URL environment variable is required.')
    process.exit(1)
  }

  const sql = neon(dbUrl)
  const db = drizzle(sql)

  const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'))
  console.log(`Found ${csvFiles.length} track CSV files in ${CSV_DIR}\n`)

  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const file of csvFiles) {
    const stem = path.basename(file, '.csv')
    const trackId = toTrackId(stem)
    const trackName = toTrackName(stem)
    const csvPath = path.join(CSV_DIR, file)
    const rawCsv = fs.readFileSync(csvPath, 'utf-8')

    // Check if already seeded
    const existing = await db.select({ id: trackMaps.id })
      .from(trackMaps)
      .where(eq(trackMaps.trackId, trackId))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  ⏭  ${trackName} (${trackId}) — already exists, skipping`)
      skipped++
      continue
    }

    try {
      const { svgPath, pointCount, svgPreview } = csvToSvg(rawCsv, trackName)
      const meta = TRACK_META[stem] ?? {}

      await db.insert(trackMaps).values({
        trackId,
        trackName,
        svgPath,
        pointCount,
        rawCsv,
        svgPreview,
        gameName: meta.gameName ?? 'iracing',
        trackLengthKm: meta.trackLengthKm ?? null,
      })

      console.log(`  ✅ ${trackName} (${trackId}) — ${pointCount} points`)
      inserted++
    } catch (err) {
      console.error(`  ❌ ${trackName} (${trackId}) — ${(err as Error).message}`)
      failed++
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped, ${failed} failed`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
