import { useSyncExternalStore } from 'react'
import { analyzeGame } from '../analysis/analyzeGame'
import { ANALYSIS_VERSION } from '../analysis/types'
import { db, getSettings } from '../db/db'
import { createStockfish } from '../engine/stockfish'
import type { Engine } from '../engine/uci'
import type { StoredGame } from '../lib/chesscom'

export type QueueState =
  | { status: 'idle' }
  | { status: 'running'; gameId: string; done: number; total: number; remaining: number }
  | { status: 'error'; message: string }

let state: QueueState = { status: 'idle' }
const listeners = new Set<() => void>()
let engine: Engine | null = null
let running = false
/** Games the user asked for explicitly; analysed before the automatic backlog. */
const requested: string[] = []

function setState(next: QueueState) {
  state = next
  for (const listener of listeners) listener()
}

export function useAnalysisQueue(): QueueState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

function needsAnalysis(version: number | undefined) {
  return version === undefined || version < ANALYSIS_VERSION
}

/** The user's most recent games (up to `maxGames`) plus explicit requests that lack analysis. */
async function backlog(): Promise<StoredGame[]> {
  const { maxGames } = await getSettings()
  const recent = await db.games.orderBy('playedAt').reverse().limit(maxGames).toArray()
  const extra = (await db.games.bulkGet(requested)).filter((g): g is StoredGame => !!g)
  const candidates = [...extra, ...recent.filter((g) => !requested.includes(g.id))]
  const analyses = await db.analyses.bulkGet(candidates.map((g) => g.id))
  return candidates.filter((_, i) => needsAnalysis(analyses[i]?.version))
}

/** Analyses pending games one by one. Safe to call repeatedly; only one run happens at a time. */
export async function runAnalysisQueue(): Promise<void> {
  if (running) return
  running = true
  try {
    for (;;) {
      const pending = await backlog()
      const game = pending[0]
      if (!game) break
      const { depth } = await getSettings()
      engine ??= createStockfish()
      setState({ status: 'running', gameId: game.id, done: 0, total: 1, remaining: pending.length })
      const analysis = await analyzeGame(game, engine, {
        depth,
        onProgress: (done, total) =>
          setState({ status: 'running', gameId: game.id, done, total, remaining: pending.length }),
      })
      await db.analyses.put(analysis)
      const index = requested.indexOf(game.id)
      if (index >= 0) requested.splice(index, 1)
    }
    setState({ status: 'idle' })
  } catch (error) {
    engine?.dispose()
    engine = null
    setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  } finally {
    running = false
  }
}

/** Puts a specific game at the front of the queue and starts the queue. */
export function requestAnalysis(gameId: string): void {
  if (!requested.includes(gameId)) requested.unshift(gameId)
  void runAnalysisQueue()
}
