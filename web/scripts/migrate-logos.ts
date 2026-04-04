/**
 * Logo Migration Script
 *
 * Imports existing SVG logos from racecor-overlay/images/logos/ into the
 * car_logos PostgreSQL table. Run once after applying the schema migration.
 *
 * Usage:
 *   cd web && npx tsx scripts/migrate-logos.ts
 *
 * Requires: k10_DATABASE_URL environment variable
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename, extname } from 'path'
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { eq } from 'drizzle-orm'

// Inline schema to avoid import resolution issues in scripts
const carLogos = pgTable('car_logos', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandKey: varchar('brand_key', { length: 64 }).notNull().unique(),
  brandName: varchar('brand_name', { length: 128 }).notNull(),
  logoSvg: text('logo_svg'),
  logoPng: text('logo_png'),
  brandColorHex: varchar('brand_color_hex', { length: 7 }),
  contributorId: uuid('contributor_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Brand key → display name mapping
const BRAND_NAMES: Record<string, string> = {
  acura: 'Acura',
  astonmartin: 'Aston Martin',
  audi: 'Audi',
  bmw: 'BMW',
  cadillac: 'Cadillac',
  chevrolet: 'Chevrolet',
  dallara: 'Dallara',
  ferrari: 'Ferrari',
  fia: 'FIA',
  ford: 'Ford',
  honda: 'Honda',
  hyundai: 'Hyundai',
  lamborghini: 'Lamborghini',
  ligier: 'Ligier',
  lotus: 'Lotus',
  mazda: 'Mazda',
  mclaren: 'McLaren',
  mercedes: 'Mercedes-Benz',
  nissan: 'Nissan',
  porsche: 'Porsche',
  radical: 'Radical',
  toyota: 'Toyota',
}

// Brand key → hex color (from config.js _mfrBrandColors, converted to hex)
const BRAND_COLORS: Record<string, string> = {
  bmw: '#0073E6',
  mclaren: '#FF7A00',
  mazda: '#B71C1C',
  nissan: '#CC1A1A',
  dallara: '#1565C0',
  ferrari: '#DC0000',
  porsche: '#808080',
  audi: '#808080',
  mercedes: '#00B89F',
  lamborghini: '#D4A017',
  chevrolet: '#CC9933',
  ford: '#002277',
  toyota: '#CC0000',
  hyundai: '#0D47A1',
  cadillac: '#808080',
  astonmartin: '#007A4D',
  lotus: '#FFD700',
  ligier: '#0E6EB5',
  fia: '#002B5C',
  radical: '#D4A017',
  honda: '#CC0000',
}

async function main() {
  const dbUrl = process.env.k10_DATABASE_URL
  if (!dbUrl) {
    console.error('Error: k10_DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const sql = neon(dbUrl)
  const db = drizzle(sql)

  const logosDir = join(__dirname, '..', '..', 'racecor-overlay', 'images', 'logos')
  if (!existsSync(logosDir)) {
    console.error(`Error: Logos directory not found: ${logosDir}`)
    process.exit(1)
  }

  const files = readdirSync(logosDir).filter(f => f.endsWith('.svg'))
  console.log(`Found ${files.length} SVG files in ${logosDir}\n`)

  // Skip special files
  const SKIP = new Set(['generic.svg', 'none.svg', 'iracing.svg', 'le-mans-ultimate.svg', 'honda_white.svg'])

  let created = 0
  let replaced = 0
  let skipped = 0

  for (const file of files) {
    if (SKIP.has(file)) {
      console.log(`  SKIP  ${file} (special/non-brand)`)
      skipped++
      continue
    }

    const key = basename(file, '.svg').toLowerCase()
    const name = BRAND_NAMES[key]
    if (!name) {
      console.log(`  SKIP  ${file} (no brand mapping for "${key}")`)
      skipped++
      continue
    }

    const svgContent = readFileSync(join(logosDir, file), 'utf-8')
    const color = BRAND_COLORS[key] || null

    // Check if already exists
    const existing = await db
      .select({ id: carLogos.id })
      .from(carLogos)
      .where(eq(carLogos.brandKey, key))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(carLogos)
        .set({ logoSvg: svgContent, brandColorHex: color, updatedAt: new Date() })
        .where(eq(carLogos.brandKey, key))
      console.log(`  UPDATE  ${key} → ${name} (${svgContent.length} bytes)`)
      replaced++
    } else {
      await db.insert(carLogos).values({
        brandKey: key,
        brandName: name,
        logoSvg: svgContent,
        brandColorHex: color,
      })
      console.log(`  CREATE  ${key} → ${name} (${svgContent.length} bytes)`)
      created++
    }
  }

  console.log(`\nDone! Created: ${created}, Updated: ${replaced}, Skipped: ${skipped}`)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
