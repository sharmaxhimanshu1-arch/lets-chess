import type { Color, Score } from '../analysis/winprob'
import { sideToMove } from '../chess/board'

export interface EngineLine {
  /** Score from White's point of view. */
  score: Score
  /** Principal variation in UCI notation, starting with the engine's best move. */
  pv: string[]
  depth: number
}

export interface AnalyseOptions {
  depth: number
  multiPv?: number
}

export interface Engine {
  /** Lines sorted best first. Empty for positions with no legal moves. */
  analyse(fen: string, options: AnalyseOptions): Promise<EngineLine[]>
  dispose(): void
}

interface InfoLine {
  depth: number
  multipv: number
  score: Score
  pv: string[]
}

/** Parses a UCI `info … score … pv …` line. Bound scores and lines without a PV are ignored. */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ') || line.includes(' bound ')) return null
  if (/ (lower|upper)bound/.test(line)) return null
  const tokens = line.split(' ')
  const at = (key: string) => tokens.indexOf(key)
  const scoreAt = at('score')
  const pvAt = at('pv')
  if (scoreAt < 0 || pvAt < 0) return null
  const kind = tokens[scoreAt + 1]
  const value = Number(tokens[scoreAt + 2])
  if (Number.isNaN(value) || (kind !== 'cp' && kind !== 'mate')) return null
  const depthAt = at('depth')
  const multipvAt = at('multipv')
  return {
    depth: depthAt >= 0 ? Number(tokens[depthAt + 1]) : 0,
    multipv: multipvAt >= 0 ? Number(tokens[multipvAt + 1]) : 1,
    score: kind === 'cp' ? { cp: value } : { mate: value },
    pv: tokens.slice(pvAt + 1),
  }
}

/** UCI scores are from the side to move; flip them to White's point of view. */
export function toWhitePov(score: Score, mover: Color): Score {
  if (mover === 'w') return score
  return 'cp' in score ? { cp: -score.cp } : { mate: -score.mate }
}

export interface UciSessionOptions {
  /** Transposition table size in MB. */
  hashMb?: number
  /** How long the engine may take to start up before we give up. */
  readyTimeoutMs?: number
  /** How long a single position may take before we give up. */
  searchTimeoutMs?: number
}

export class EngineError extends Error {}

/**
 * Drives a UCI engine over a line-based transport (a Web Worker or a child process).
 * Requests run one at a time. Startup and searches time out instead of hanging forever.
 */
export class UciSession implements Engine {
  private listener: ((line: string) => void) | null = null
  private readonly ready: Promise<void>
  private queue: Promise<unknown>
  private multiPv = 1
  private readonly send: (command: string) => void
  private readonly close: () => void
  private readonly options: Required<UciSessionOptions>

  constructor(
    send: (command: string) => void,
    subscribe: (onLine: (line: string) => void) => void,
    close: () => void,
    { hashMb = 16, readyTimeoutMs = 20_000, searchTimeoutMs = 60_000 }: UciSessionOptions = {},
  ) {
    this.send = send
    this.close = close
    this.options = { hashMb, readyTimeoutMs, searchTimeoutMs }
    subscribe((text) => {
      for (const line of text.split('\n')) if (line.trim()) this.listener?.(line.trim())
    })
    this.ready = this.handshake()
    this.queue = this.ready.catch(() => undefined)
  }

  private async handshake() {
    const { readyTimeoutMs, hashMb } = this.options
    const failed = 'The chess engine failed to load in this browser.'
    await this.command('uci', (line) => line === 'uciok', undefined, readyTimeoutMs, failed)
    this.send(`setoption name Hash value ${hashMb}`)
    await this.command('isready', (line) => line === 'readyok', undefined, readyTimeoutMs, failed)
  }

  private command(
    command: string,
    isDone: (line: string) => boolean,
    onLine: ((line: string) => void) | undefined,
    timeoutMs: number,
    timeoutMessage: string,
  ) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listener = null
        reject(new EngineError(timeoutMessage))
      }, timeoutMs)
      this.listener = (line) => {
        onLine?.(line)
        if (isDone(line)) {
          clearTimeout(timer)
          this.listener = null
          resolve()
        }
      }
      this.send(command)
    })
  }

  analyse(fen: string, { depth, multiPv = 1 }: AnalyseOptions): Promise<EngineLine[]> {
    const run = async () => {
      await this.ready
      if (multiPv !== this.multiPv) {
        this.send(`setoption name MultiPV value ${multiPv}`)
        this.multiPv = multiPv
      }
      const latest = new Map<number, InfoLine>()
      this.send(`position fen ${fen}`)
      await this.command(
        `go depth ${depth}`,
        (line) => line.startsWith('bestmove'),
        (line) => {
          const info = parseInfo(line)
          if (info) latest.set(info.multipv, info)
        },
        this.options.searchTimeoutMs,
        'The chess engine stopped responding.',
      )
      const mover = sideToMove(fen)
      return [...latest.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, info]) => ({
          score: toWhitePov(info.score, mover),
          pv: info.pv,
          depth: info.depth,
        }))
    }
    const result = this.queue.then(run)
    this.queue = result.catch(() => undefined)
    return result
  }

  dispose() {
    this.close()
  }
}
