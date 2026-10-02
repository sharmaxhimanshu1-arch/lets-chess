import { db, getSettings, saveSettings } from '../db/db'
import { fetchRapidGames, gameFromPgn } from '../lib/chesscom'

/** Imports new rapid games from Chess.com and returns how many were new. */
export async function importFromChessCom(onProgress?: (message: string) => void): Promise<number> {
  const settings = await getSettings()
  if (!settings.username) throw new Error('Set your Chess.com username first.')
  const { games, latestMonth } = await fetchRapidGames(settings.username, {
    sinceMonth: settings.lastMonth,
    onProgress,
  })
  const existing = await db.games.bulkGet(games.map((g) => g.id))
  const added = existing.filter((g) => g === undefined).length
  await db.games.bulkPut(games)
  await saveSettings({ lastMonth: latestMonth, lastImportAt: Date.now() })
  return added
}

export async function importPgn(pgn: string): Promise<string> {
  const { username } = await getSettings()
  const game = gameFromPgn(pgn.trim(), username)
  await db.games.put(game)
  return game.id
}
