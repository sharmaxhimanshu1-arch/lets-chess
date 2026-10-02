import { TIP_KINDS, type LabelKind } from '../analysis/types'
import { winPercent, scoreToCp, type Grade, type Score } from '../analysis/winprob'

/** "+1.3", "-0.4", "M3", "-M2" (White's view). */
export function formatScore(score: Score): string {
  if ('mate' in score) return `${score.mate < 0 ? '-' : ''}M${Math.abs(score.mate)}`
  if (Math.abs(score.cp) >= 10_000) return score.cp > 0 ? '1-0' : '0-1'
  const pawns = score.cp / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
}

export function whiteWinPercent(score: Score): number {
  return winPercent(scoreToCp(score))
}

export const GRADE_SYMBOL: Record<Grade, string> = {
  best: '',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export const GRADE_LABEL: Record<Grade, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export const LABEL_TITLE: Record<LabelKind, string> = {
  missedMate: 'Missed mate',
  allowedMate: 'Allowed mate',
  allowedFork: 'Allowed fork',
  missedFork: 'Missed fork',
  hungPiece: 'Hung piece',
  missedFreePiece: 'Missed free piece',
  rushed: 'Moved too fast',
  earlyQueen: 'Early queen',
  samePieceTwice: 'Same piece twice',
  fPawn: 'Early f-pawn',
  notCastled: 'Castle earlier',
}

export function isTip(kind: LabelKind) {
  return TIP_KINDS.has(kind)
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "600" → "10 min", "600+5" → "10 | 5". */
export function formatTimeControl(tc: string): string {
  const match = tc.match(/^(\d+)(?:\+(\d+))?$/)
  if (!match) return tc
  const minutes = Number(match[1]) / 60
  return match[2] ? `${minutes} | ${match[2]}` : `${minutes} min`
}
