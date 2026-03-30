import type { LicenseClass, RatingCategory } from '@/lib/constants'

/** A single rating snapshot for one category (road, oval, etc.) */
export interface CategoryRating {
  category: RatingCategory
  iRating: number
  safetyRating: number
  license: LicenseClass
}

/** Full driver rating profile across all categories */
export interface DriverRatings {
  /** The category currently active in the sim (from the loaded race) */
  activeCategory: RatingCategory
  /** Per-category ratings */
  categories: Record<RatingCategory, CategoryRating>
  /** Timestamp of last update */
  updatedAt: string
}

/** A single rating change history entry */
export interface RatingHistoryEntry {
  timestamp: string
  category: RatingCategory
  iRating: number
  safetyRating: number
  license: LicenseClass
  prevIRating: number
  prevSafetyRating: number
  prevLicense: LicenseClass
}

/** Car session record for the heatmap */
export interface CarSession {
  carModel: string
  manufacturer: string
  category: RatingCategory
  count: number
  lastDriven: string
}

/** Full driver profile stored on the backend */
export interface DriverProfile {
  discordId: string
  discordUsername: string
  discordAvatar?: string
  ratings: DriverRatings
  history: RatingHistoryEntry[]
  carSessions: CarSession[]
  createdAt: string
  updatedAt: string
}
