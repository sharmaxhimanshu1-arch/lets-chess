import type { CSSProperties } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Color } from '../analysis/winprob'

export interface BoardArrow {
  from: string
  to: string
  color: string
}

interface Props {
  fen: string
  orientation: Color
  arrows?: BoardArrow[]
  highlight?: { squares: string[]; color: string }
}

export function ChessBoard({ fen, orientation, arrows = [], highlight }: Props) {
  const squareStyles: Record<string, CSSProperties> = {}
  for (const square of highlight?.squares ?? []) {
    squareStyles[square] = { background: highlight?.color }
  }
  return (
    <Chessboard
      options={{
        id: 'review-board',
        position: fen,
        boardOrientation: orientation === 'w' ? 'white' : 'black',
        allowDragging: false,
        allowDrawingArrows: true,
        arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color })),
        squareStyles,
        darkSquareStyle: { backgroundColor: '#b58863' },
        lightSquareStyle: { backgroundColor: '#f0d9b5' },
        animationDurationInMs: 150,
      }}
    />
  )
}
