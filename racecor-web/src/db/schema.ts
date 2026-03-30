import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar } from 'drizzle-orm/pg-core'

// ── Users (Discord-authenticated members) ──
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  discordId: varchar('discord_id', { length: 32 }).notNull().unique(),
  discordUsername: varchar('discord_username', { length: 64 }).notNull(),
  discordDisplayName: varchar('discord_display_name', { length: 64 }),
  discordAvatar: text('discord_avatar'),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Plugin Tokens (OAuth2 tokens issued to the desktop plugin) ──
export const pluginTokens = pgTable('plugin_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: varchar('access_token', { length: 128 }).notNull().unique(),
  refreshToken: varchar('refresh_token', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  deviceName: varchar('device_name', { length: 128 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Authorization Codes (short-lived codes for OAuth2 flow) ──
export const authCodes = pgTable('auth_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeChallenge: varchar('code_challenge', { length: 128 }),
  codeChallengeMethod: varchar('code_challenge_method', { length: 8 }),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Driver Ratings (iRacing performance data) ──
export const driverRatings = pgTable('driver_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 16 }).notNull(), // road, oval, dirt_road, dirt_oval, sports_car
  iRating: integer('irating').notNull().default(0),
  safetyRating: varchar('safety_rating', { length: 8 }).notNull().default('0.00'),
  license: varchar('license', { length: 4 }).notNull().default('R'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Rating History (historical snapshots after each race) ──
export const ratingHistory = pgTable('rating_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 16 }).notNull(),
  iRating: integer('irating').notNull(),
  safetyRating: varchar('safety_rating', { length: 8 }).notNull(),
  license: varchar('license', { length: 4 }).notNull(),
  prevIRating: integer('prev_irating'),
  prevSafetyRating: varchar('prev_safety_rating', { length: 8 }),
  prevLicense: varchar('prev_license', { length: 4 }),
  sessionType: varchar('session_type', { length: 32 }),
  trackName: varchar('track_name', { length: 128 }),
  carModel: varchar('car_model', { length: 128 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Race Sessions (aggregated car/session data) ──
export const raceSessions = pgTable('race_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  carModel: varchar('car_model', { length: 128 }).notNull(),
  manufacturer: varchar('manufacturer', { length: 64 }),
  category: varchar('category', { length: 16 }).notNull(),
  trackName: varchar('track_name', { length: 128 }),
  sessionType: varchar('session_type', { length: 32 }),
  finishPosition: integer('finish_position'),
  incidentCount: integer('incident_count'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
