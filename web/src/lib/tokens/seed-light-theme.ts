/**
 * Seed script for light theme overrides.
 * Run with: source .env.local && npx tsx src/lib/tokens/seed-light-theme.ts
 *
 * Inserts light theme overrides into the themeOverrides table.
 * Only tokens that differ from the dark base need overrides.
 * Idempotent — safe to re-run.
 */

import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { eq, and } from 'drizzle-orm'
import * as schema from '../../db/schema'

const sql = neon(process.env.k10_DATABASE_URL || process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const THEME_ID = 'light'

// Light theme overrides — only tokens that change from dark
// Semantic colors (red, green, blue, etc.) stay the same for brand consistency.
// Backgrounds, text, and borders invert for light mode.
const lightOverrides: Array<{ tokenPath: string; value: string }> = [
  // ── Backgrounds ──
  // Light backgrounds need higher opacity for readability
  { tokenPath: 'color.background.base', value: '#f5f5f8' },
  { tokenPath: 'color.background.surface', value: 'rgba(255, 255, 255, 0.95)' },
  { tokenPath: 'color.background.panel', value: 'rgba(240, 240, 245, 0.95)' },
  { tokenPath: 'color.background.elevated', value: 'rgba(255, 255, 255, 1.0)' },
  { tokenPath: 'color.background.logo', value: 'rgba(235, 235, 240, 0.92)' },
  { tokenPath: 'color.background.overlay', value: 'rgba(0, 0, 0, 0.40)' },

  // ── Text ──
  // Dark text on light backgrounds
  { tokenPath: 'color.text.primary', value: 'hsla(0, 0%, 10%, 1.0)' },
  { tokenPath: 'color.text.secondary', value: 'rgba(0, 0, 0, 0.65)' },
  { tokenPath: 'color.text.dim', value: 'rgba(0, 0, 0, 0.50)' },
  { tokenPath: 'color.text.muted', value: 'rgba(0, 0, 0, 0.40)' },
  { tokenPath: 'color.text.web-primary', value: 'hsla(0, 0%, 10%, 1.0)' },

  // ── Borders ──
  // Dark borders on light backgrounds
  { tokenPath: 'color.border.default', value: 'rgba(0, 0, 0, 0.12)' },
  { tokenPath: 'color.border.subtle', value: 'rgba(0, 0, 0, 0.06)' },
  { tokenPath: 'color.border.accent', value: 'rgba(0, 0, 0, 0.20)' },
  { tokenPath: 'color.border.active', value: 'rgba(0, 0, 0, 0.30)' },

  // ── Brand ──
  // Slightly deepened reds for better contrast on light backgrounds
  { tokenPath: 'color.brand.red', value: '#d32f2f' },
  { tokenPath: 'color.brand.red-mid', value: '#c62828' },
  { tokenPath: 'color.brand.red-dark', value: '#b71c1c' },

  // ── Semantic colors ──
  // Slight saturation/darkness adjustments for light background readability
  { tokenPath: 'color.semantic.green', value: '#2e7d32' },
  { tokenPath: 'color.semantic.blue', value: '#1565c0' },
  { tokenPath: 'color.semantic.amber', value: '#f57f17' },
  { tokenPath: 'color.semantic.orange', value: '#e65100' },
  { tokenPath: 'color.semantic.cyan', value: '#00838f' },
  { tokenPath: 'color.semantic.purple', value: '#6a1b9a' },

  // ── Flag colors ──
  // Adjusted for light background visibility
  { tokenPath: 'color.flag.white', value: '#e0e0e0' },
  { tokenPath: 'color.flag.debris', value: '#6d4c41' },

  // ── Sentiment ──
  // Lower lightness for sentiment indicators on light backgrounds
  { tokenPath: 'color.sentiment.lightness', value: '40%' },
  { tokenPath: 'color.sentiment.alpha', value: '0.75' },
]

async function seedLightTheme() {
  console.log(`Seeding ${lightOverrides.length} light theme overrides...`)

  let created = 0
  let updated = 0

  for (const override of lightOverrides) {
    const existing = await db
      .select()
      .from(schema.themeOverrides)
      .where(
        and(
          eq(schema.themeOverrides.themeId, THEME_ID),
          eq(schema.themeOverrides.tokenPath, override.tokenPath)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(schema.themeOverrides)
        .set({ value: override.value, updatedAt: new Date() })
        .where(eq(schema.themeOverrides.id, existing[0].id))
      updated++
    } else {
      await db.insert(schema.themeOverrides).values({
        themeId: THEME_ID,
        tokenPath: override.tokenPath,
        value: override.value,
      })
      created++
    }
  }

  console.log(`Done! Created ${created}, updated ${updated} overrides.`)
}

seedLightTheme().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
