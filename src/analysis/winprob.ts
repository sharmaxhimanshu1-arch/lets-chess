// Converts engine evaluations into win percentages and grades moves by how much
// winning chance they throw away. Formulas follow Lichess's public implementation.

export type Color = 'w' | 'b'

/** Engine score from White's point of view: centipawns, or moves until mate (negative = Black mates). */
export type Score = { cp: number } | { mate: number }

export type Grade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

/**
 * Win % lost (0–100 scale) at which each grade starts. Lichess uses 0.1/0.2/0.3 on a
 * -1..1 "winning chances" scale, which is 5/10/15 percentage points here.
 */
export const GRADE_THRESHOLDS = { inaccuracy: 5, mistake: 10, blunder: 15 } as const

const MATE_CP = 10_000

export function scoreToCp(score: Score): number {
  if ('cp' in score) return score.cp
  return score.mate >= 0 ? MATE_CP : -MATE_CP
}

/** White's chance of winning (0–100) for a centipawn evaluation. */
export function winPercent(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1)
}

/** Win % for the given side. */
export function winPercentFor(score: Score, color: Color): number {
  const white = winPercent(scoreToCp(score))
  return color === 'w' ? white : 100 - white
}

/** How much winning chance the mover gave away with a move (never negative). */
export function winPercentLost(before: Score, after: Score, mover: Color): number {
  return Math.max(0, winPercentFor(before, mover) - winPercentFor(after, mover))
}

export function gradeMove(lost: number, playedBest = false): Grade {
  if (playedBest) return 'best'
  if (lost >= GRADE_THRESHOLDS.blunder) return 'blunder'
  if (lost >= GRADE_THRESHOLDS.mistake) return 'mistake'
  if (lost >= GRADE_THRESHOLDS.inaccuracy) return 'inaccuracy'
  return 'good'
}

/** Per-move accuracy (0–100) from win % lost. */
export function moveAccuracy(lost: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * lost) - 3.1669
  return Math.max(0, Math.min(100, raw))
}

/**
 * Game accuracy as the plain mean of move accuracies. Lichess blends weighted and
 * harmonic means; the simple mean is close enough for tracking a trend over time.
 */
export function gameAccuracy(lostPerMove: readonly number[]): number {
  if (lostPerMove.length === 0) return 100
  const total = lostPerMove.reduce((sum, lost) => sum + moveAccuracy(lost), 0)
  return total / lostPerMove.length
}
