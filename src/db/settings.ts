export interface Settings {
  username: string
  /** Stockfish search depth per position. */
  depth: number
  /** How many of the most recent games to analyse automatically. */
  maxGames: number
  /** Newest Chess.com archive month imported ("2026/09"). */
  lastMonth?: string
  lastImportAt?: number
  /** Schema version of this record; see `migrateSettings`. */
  settingsVersion?: number
}

export const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  username: '',
  depth: 12,
  maxGames: 30,
  settingsVersion: SETTINGS_VERSION,
}

/** Brings a stored settings record up to date. Pure, so it is easy to test. */
export function migrateSettings(stored: Settings): Settings {
  let settings = stored
  if ((settings.settingsVersion ?? 1) < 2) {
    // Version 1 wrote its default depth (14) on every save. Depth 14 turned out too slow
    // in the browser, so move anyone still on it to the new default.
    settings = {
      ...settings,
      depth: settings.depth === 14 ? DEFAULT_SETTINGS.depth : settings.depth,
    }
  }
  return { ...settings, settingsVersion: SETTINGS_VERSION }
}
