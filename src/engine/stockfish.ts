import { createEnginePool, defaultPoolSize } from './pool'
import { UciSession, type Engine } from './uci'

/** Copied into public/engine/ by scripts/copy-engine.mjs. */
export const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`

/** Stockfish (lite, single-threaded WASM) running in a Web Worker. */
export function createStockfish(url = ENGINE_URL): Engine {
  const worker = new Worker(url)
  return new UciSession(
    (command) => worker.postMessage(command),
    (onLine) => {
      worker.onmessage = (event: MessageEvent<string>) => onLine(String(event.data))
    },
    () => worker.terminate(),
  )
}

/** One Stockfish worker per spare CPU core (up to 4), used as a single engine. */
export function createStockfishPool(size = defaultPoolSize()): Engine {
  return createEnginePool(size, () => createStockfish())
}
