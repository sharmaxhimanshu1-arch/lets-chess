import type { Score } from '../analysis/winprob'
import type { Color } from '../analysis/winprob'
import { formatScore, whiteWinPercent } from './format'

export function EvalBar({ score, orientation }: { score?: Score; orientation: Color }) {
  const white = score ? whiteWinPercent(score) : 50
  const whiteOnBottom = orientation === 'w'
  return (
    <div
      className={`eval-bar ${whiteOnBottom ? '' : 'flipped'}`}
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
    >
      <div className="eval-white" style={{ height: `${white}%` }} />
      <span className={`eval-text ${white >= 50 ? 'on-white' : 'on-black'}`}>
        {score ? formatScore(score) : ''}
      </span>
    </div>
  )
}
