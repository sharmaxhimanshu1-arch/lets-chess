import type { AnalyseOptions, Engine, EngineLine } from './uci'

/** How many engines to run: one per spare CPU core, at most 4. */
export function defaultPoolSize(cores = globalThis.navigator?.hardwareConcurrency ?? 2): number {
  return Math.max(1, Math.min(4, cores - 1))
}

/**
 * Runs several engines side by side. Each `analyse` call goes to an idle engine,
 * or waits for one, so callers can fire off many positions at once.
 */
export function createEnginePool(size: number, create: () => Engine): Engine {
  const engines = Array.from({ length: size }, create)
  const idle = [...engines]
  const waiting: ((engine: Engine) => void)[] = []

  function acquire(): Promise<Engine> {
    const engine = idle.pop()
    return engine ? Promise.resolve(engine) : new Promise((resolve) => waiting.push(resolve))
  }

  function release(engine: Engine) {
    const next = waiting.shift()
    if (next) next(engine)
    else idle.push(engine)
  }

  return {
    async analyse(fen: string, options: AnalyseOptions): Promise<EngineLine[]> {
      const engine = await acquire()
      try {
        return await engine.analyse(fen, options)
      } finally {
        release(engine)
      }
    },
    dispose() {
      for (const engine of engines) engine.dispose()
    },
  }
}
