import type { AnalyzedMove } from '../analysis/types'
import { GRADE_SYMBOL } from './format'

/** A move as shown in the list; `grade` is missing until the game is analysed. */
export type ListMove = Pick<AnalyzedMove, 'ply' | 'san' | 'color' | 'moveNumber'> &
  Partial<Pick<AnalyzedMove, 'grade'>>

interface Props {
  moves: ListMove[]
  currentPly: number
  onSelect: (ply: number) => void
}

interface Row {
  number: number
  white?: ListMove
  black?: ListMove
}

export function MoveList({ moves, currentPly, onSelect }: Props) {
  const rows: Row[] = []
  for (const move of moves) {
    const last = rows.at(-1)
    if (move.color === 'b' && last && !last.black && last.number === move.moveNumber) {
      last.black = move
    } else {
      rows.push({ number: move.moveNumber, [move.color === 'w' ? 'white' : 'black']: move })
    }
  }
  const cell = (move?: ListMove) =>
    move ? (
      <button
        type="button"
        className={`move grade-${move.grade ?? 'none'}${move.ply === currentPly ? ' current' : ''}`}
        onClick={() => onSelect(move.ply)}
      >
        {move.san}
        {move.grade ? GRADE_SYMBOL[move.grade] : ''}
      </button>
    ) : (
      <span />
    )
  return (
    <div className="move-list">
      {rows.map((row) => (
        <div className="move-row" key={row.white?.ply ?? row.black?.ply}>
          <span className="move-number">{row.number}.</span>
          {cell(row.white)}
          {cell(row.black)}
        </div>
      ))}
    </div>
  )
}
