import { describe, expect, it } from 'vitest'
import { createEnginePool, defaultPoolSize } from './pool'
import type { Engine, EngineLine } from './uci'

/** A fake engine that answers after `ms` with its own id as the score. */
function fakeEngine(id: number, stats: { running: number; peak: number }, ms = 5): Engine {
  return {
    async analyse(fen): Promise<EngineLine[]> {
      stats.running++
      stats.peak = Math.max(stats.peak, stats.running)
      await new Promise((r) => setTimeout(r, ms))
      stats.running--
      if (fen === 'boom') throw new Error('engine crashed')
      return [{ score: { cp: id }, pv: [fen], depth: 1 }]
    },
    dispose() {},
  }
}

describe('createEnginePool', () => {
  it('runs at most `size` searches at once and answers every request', async () => {
    const stats = { running: 0, peak: 0 }
    let next = 0
    const pool = createEnginePool(3, () => fakeEngine(next++, stats))
    const fens = Array.from({ length: 20 }, (_, i) => `fen-${i}`)
    const results = await Promise.all(fens.map((fen) => pool.analyse(fen, { depth: 1 })))
    expect(stats.peak).toBe(3)
    // Each answer belongs to its own request.
    expect(results.map((r) => r[0].pv[0])).toEqual(fens)
    // Work was spread over all three engines.
    expect(new Set(results.map((r) => (r[0].score as { cp: number }).cp)).size).toBe(3)
  })

  it('passes errors through and keeps working afterwards', async () => {
    const stats = { running: 0, peak: 0 }
    const pool = createEnginePool(1, () => fakeEngine(0, stats))
    await expect(pool.analyse('boom', { depth: 1 })).rejects.toThrow('engine crashed')
    await expect(pool.analyse('ok', { depth: 1 })).resolves.toHaveLength(1)
  })

  it('disposes every engine', () => {
    let disposed = 0
    const pool = createEnginePool(3, () => ({
      analyse: async () => [],
      dispose: () => void disposed++,
    }))
    pool.dispose()
    expect(disposed).toBe(3)
  })
})

describe('defaultPoolSize', () => {
  it('leaves one core free and caps at 4', () => {
    expect(defaultPoolSize(1)).toBe(1)
    expect(defaultPoolSize(2)).toBe(1)
    expect(defaultPoolSize(4)).toBe(3)
    expect(defaultPoolSize(16)).toBe(4)
  })
})
