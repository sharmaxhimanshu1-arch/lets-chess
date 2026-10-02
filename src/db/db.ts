import Dexie, { type EntityTable } from 'dexie'
import type { GameAnalysis } from '../analysis/types'
import type { StoredGame } from '../lib/chesscom'

export interface Settings {
  username: string
  /** Stockfish search depth per position. */
  depth: number
  /** How many of the most recent games to analyse automatically. */
  maxGames: number
  /** Newest Chess.com archive month imported ("2026/09"). */
  lastMonth?: string
  lastImportAt?: number
}

export const DEFAULT_SETTINGS: Settings = { username: '', depth: 14, maxGames: 30 }

type SettingsRow = Settings & { key: 'settings' }

class LetsChessDb extends Dexie {
  games!: EntityTable<StoredGame, 'id'>
  analyses!: EntityTable<GameAnalysis, 'gameId'>
  settings!: EntityTable<SettingsRow, 'key'>

  constructor() {
    super('lets-chess')
    this.version(1).stores({ games: 'id, playedAt', analyses: 'gameId', settings: 'key' })
  }
}

export const db = new LetsChessDb()

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings')
  return { ...DEFAULT_SETTINGS, ...row }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, key: 'settings' })
}

/** Removes all games and analyses, e.g. when switching to a different Chess.com account. */
export async function clearGames(): Promise<void> {
  await db.transaction('rw', db.games, db.analyses, db.settings, async () => {
    await db.games.clear()
    await db.analyses.clear()
    await saveSettings({ lastMonth: undefined, lastImportAt: undefined })
  })
}
