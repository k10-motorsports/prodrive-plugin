import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * Seed the 12 theme sets: default + 11 F1 teams (2024 grid).
 *
 * This only creates the theme_sets rows — it does NOT populate overrides.
 * Overrides are edited via the admin Token Editor UI.
 *
 * Each set will eventually have dark + light override layers that re-skin
 * the entire UI to match the team's livery colors.
 */
export async function seedThemeSets() {
  const sets: Array<{
    slug: string
    name: string
    description: string
    sortOrder: number
  }> = [
    {
      slug: 'default',
      name: 'Default',
      description: 'The original K10 Motorsports dark/light theme',
      sortOrder: 0,
    },
    {
      slug: 'red-bull',
      name: 'Red Bull Racing',
      description: 'Dark navy and yellow — Oracle Red Bull Racing RB20',
      sortOrder: 1,
    },
    {
      slug: 'ferrari',
      name: 'Scuderia Ferrari',
      description: 'Rosso corsa and black — Ferrari SF-24',
      sortOrder: 2,
    },
    {
      slug: 'mclaren',
      name: 'McLaren',
      description: 'Papaya orange and blue — McLaren MCL38',
      sortOrder: 3,
    },
    {
      slug: 'mercedes',
      name: 'Mercedes-AMG',
      description: 'Silver and teal — Mercedes W15',
      sortOrder: 4,
    },
    {
      slug: 'aston-martin',
      name: 'Aston Martin',
      description: 'British racing green and lime — AMR24',
      sortOrder: 5,
    },
    {
      slug: 'alpine',
      name: 'Alpine',
      description: 'French blue and pink — Alpine A524',
      sortOrder: 6,
    },
    {
      slug: 'williams',
      name: 'Williams',
      description: 'Navy blue and light blue — Williams FW46',
      sortOrder: 7,
    },
    {
      slug: 'rb',
      name: 'RB (VCARB)',
      description: 'Dark blue and grey — Visa Cash App RB VCARB 01',
      sortOrder: 8,
    },
    {
      slug: 'haas',
      name: 'Haas',
      description: 'White, red, and black — Haas VF-24',
      sortOrder: 9,
    },
    {
      slug: 'kick-sauber',
      name: 'Kick Sauber',
      description: 'Black and green — Stake F1 Team Kick Sauber C44',
      sortOrder: 10,
    },
    {
      slug: 'cadillac',
      name: 'Cadillac',
      description: 'Black and gold — Cadillac F1 (2026 entrant)',
      sortOrder: 11,
    },
  ]

  for (const set of sets) {
    const existing = await db
      .select()
      .from(schema.themeSets)
      .where(eq(schema.themeSets.slug, set.slug))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.themeSets).values(set)
      console.log(`  Created theme set: ${set.name}`)
    } else {
      console.log(`  Theme set already exists: ${set.name}`)
    }
  }

  console.log(`Seeded ${sets.length} theme sets`)
}
