import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AnalyzedMove, GameAnalysis } from '../../analysis/types'
import type { Score } from '../../analysis/winprob'
import { ChessBoard, type BoardArrow } from '../../components/ChessBoard'
import { EvalBar } from '../../components/EvalBar'
import {
  formatDate,
  formatScore,
  formatTimeControl,
  GRADE_LABEL,
  GRADE_SYMBOL,
  isTip,
} from '../../components/format'
import { LabelBadge } from '../../components/LabelBadge'
import { MoveList, type ListMove } from '../../components/MoveList'
import { db } from '../../db/db'
import type { StoredGame } from '../../lib/chesscom'
import { parsePgn, type ParsedMove } from '../../lib/pgn'
import { requestAnalysis, useAnalysisQueue } from '../../services/analysisQueue'

const BAD_GRADES = new Set(['inaccuracy', 'mistake', 'blunder'])

type ReviewMove = ParsedMove | AnalyzedMove

function isAnalyzed(move: ReviewMove | undefined): move is AnalyzedMove {
  return !!move && 'grade' in move
}
const BEST_ARROW = 'rgba(46, 160, 67, 0.85)'

export function ReviewPage() {
  const { id = '' } = useParams()
  // null = not found; undefined = still loading.
  const game = useLiveQuery(async () => (await db.games.get(id)) ?? null, [id])
  const analysis = useLiveQuery(() => db.analyses.get(id), [id])

  if (game === undefined) return null
  if (game === null) {
    return (
      <p className="muted">
        Game not found. <Link to="/">Back to games</Link>
      </p>
    )
  }
  return <Review key={game.id} game={game} analysis={analysis} />
}

function Review({ game, analysis }: { game: StoredGame; analysis?: GameAnalysis }) {
  const parsed = useMemo(() => parsePgn(game.pgn), [game.pgn])
  const moves: ReviewMove[] = analysis?.moves ?? parsed.moves
  const [ply, setPly] = useState(0)
  const go = useCallback(
    (next: number) => setPly(Math.max(0, Math.min(moves.length, next))),
    [moves.length],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return
      const step: Record<string, number> = {
        ArrowLeft: ply - 1,
        ArrowRight: ply + 1,
        Home: 0,
        End: moves.length,
      }
      if (event.key in step) {
        event.preventDefault()
        go(step[event.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, ply, moves.length])

  const current = ply > 0 ? moves[ply - 1] : undefined
  const analyzed = isAnalyzed(current) ? current : undefined
  const fen = current ? current.fenAfter : parsed.startFen
  const score: Score | undefined = analysis
    ? ply === 0
      ? analysis.moves[0]?.evalBefore
      : analysis.moves[ply - 1]?.evalAfter
    : undefined

  const arrows: BoardArrow[] = []
  if (analyzed?.bestUci && analyzed.bestUci !== analyzed.uci && BAD_GRADES.has(analyzed.grade)) {
    arrows.push({
      from: analyzed.bestUci.slice(0, 2),
      to: analyzed.bestUci.slice(2, 4),
      color: BEST_ARROW,
    })
  }
  const highlight = current
    ? {
        squares: [current.uci.slice(0, 2), current.uci.slice(2, 4)],
        color:
          analyzed && (analyzed.grade === 'blunder' || analyzed.grade === 'mistake')
            ? 'rgba(220, 60, 50, 0.45)'
            : 'rgba(255, 220, 80, 0.5)',
      }
    : undefined

  const me = game.myColor === 'w' ? game.white : game.black
  const opponent = game.myColor === 'w' ? game.black : game.white

  return (
    <div className="review">
      <div className="board-column">
        <PlayerLine name={opponent.name} rating={opponent.rating} />
        <div className="board-with-eval">
          <EvalBar score={score} orientation={game.myColor} />
          <div className="board">
            <ChessBoard
              fen={fen}
              orientation={game.myColor}
              arrows={arrows}
              highlight={highlight}
            />
          </div>
        </div>
        <PlayerLine name={me.name} rating={me.rating} you />
        <div className="controls">
          <button type="button" onClick={() => go(0)} aria-label="First move">
            ⏮
          </button>
          <button type="button" onClick={() => go(ply - 1)} aria-label="Previous move">
            ◀
          </button>
          <button type="button" onClick={() => go(ply + 1)} aria-label="Next move">
            ▶
          </button>
          <button type="button" onClick={() => go(moves.length)} aria-label="Last move">
            ⏭
          </button>
        </div>
        <p className="muted small center">Use ← → to step through moves.</p>
      </div>

      <aside className="side-panel">
        <div className="card">
          <div className="game-title">
            <span className={`result ${game.result}`}>{game.result}</span>
            <span>
              vs {opponent.name} · {formatDate(game.playedAt)} ·{' '}
              {formatTimeControl(game.timeControl)}
            </span>
          </div>
          {game.opening && <div className="muted small">{game.opening}</div>}
          {game.url && (
            <a className="small" href={game.url} target="_blank" rel="noreferrer">
              Open on Chess.com ↗
            </a>
          )}
          {analysis ? (
            <Summary analysis={analysis} color={game.myColor} />
          ) : (
            <Pending game={game} />
          )}
        </div>

        <MoveCard ply={ply} moves={moves} myColor={game.myColor} />

        {analysis && (
          <KeyMoments analysis={analysis} color={game.myColor} onSelect={go} current={ply} />
        )}

        <div className="card">
          <h2>Moves</h2>
          <MoveList moves={moves as ListMove[]} currentPly={ply} onSelect={go} />
        </div>
      </aside>
    </div>
  )
}

function PlayerLine({ name, rating, you }: { name: string; rating?: number; you?: boolean }) {
  return (
    <div className="player-line">
      <strong>{name}</strong>
      {rating ? <span className="muted"> ({rating})</span> : null}
      {you && <span className="you">you</span>}
    </div>
  )
}

function Summary({ analysis, color }: { analysis: GameAnalysis; color: 'w' | 'b' }) {
  const { blunder, mistake, inaccuracy } = analysis.summary
  return (
    <div className="summary">
      <div className="stat">
        <span className="stat-value">{Math.round(analysis.accuracy[color])}%</span>
        <span className="muted small">your accuracy</span>
      </div>
      <div className="stat">
        <span className="stat-value grade-blunder">{blunder}</span>
        <span className="muted small">blunders</span>
      </div>
      <div className="stat">
        <span className="stat-value grade-mistake">{mistake}</span>
        <span className="muted small">mistakes</span>
      </div>
      <div className="stat">
        <span className="stat-value grade-inaccuracy">{inaccuracy}</span>
        <span className="muted small">inaccuracies</span>
      </div>
    </div>
  )
}

function Pending({ game }: { game: StoredGame }) {
  const queue = useAnalysisQueue()
  if (queue.status === 'running' && queue.gameId === game.id) {
    return (
      <div className="pending">
        <progress max={queue.total} value={queue.done} />
        <span className="muted small">
          Analysing position {queue.done} of {queue.total}…
        </span>
      </div>
    )
  }
  return (
    <div className="pending">
      <span className="muted small">This game hasn’t been analysed yet.</span>
      <button type="button" className="primary" onClick={() => requestAnalysis(game.id)}>
        Analyse now
      </button>
    </div>
  )
}

function MoveCard({
  ply,
  moves,
  myColor,
}: {
  ply: number
  moves: ReviewMove[]
  myColor: 'w' | 'b'
}) {
  const current = ply > 0 ? moves[ply - 1] : undefined
  if (!current) {
    return (
      <div className="card move-card">
        <p className="muted">Start position. Step forward to review each move.</p>
      </div>
    )
  }
  const analyzed = isAnalyzed(current) ? current : undefined
  const mine = current.color === myColor
  const next = moves[ply]
  const punish = analyzed && !mine && (analyzed.grade === 'mistake' || analyzed.grade === 'blunder')
  return (
    <div className={`card move-card ${analyzed ? `grade-border-${analyzed.grade}` : ''}`}>
      <div className="move-card-head">
        <span className="move-san">
          {current.moveNumber}
          {current.color === 'w' ? '.' : '...'} {current.san}
          {analyzed ? GRADE_SYMBOL[analyzed.grade] : ''}
        </span>
        {analyzed && (
          <span className={`pill grade-${analyzed.grade}`}>{GRADE_LABEL[analyzed.grade]}</span>
        )}
        {analyzed && <span className="muted small">eval {formatScore(analyzed.evalAfter)}</span>}
      </div>
      {analyzed?.bestSan && analyzed.bestUci !== analyzed.uci && BAD_GRADES.has(analyzed.grade) && (
        <p>
          Best was <strong>{analyzed.bestSan}</strong> (green arrow).
          {mine && isAnalyzed(next) && next.bestSan && (
            <>
              {' '}
              Your move allowed <strong>{next.bestSan}</strong>.
            </>
          )}
        </p>
      )}
      {punish && (
        <p>
          Your opponent slipped here.
          {isAnalyzed(next) && next.bestSan
            ? ` The punishing reply was ${next.bestSan}.`
            : ' Look for a way to punish it.'}
        </p>
      )}
      {analyzed?.labels.map((label) => (
        <LabelBadge key={label.kind} label={label} />
      ))}
      {current.timeSpent !== undefined && (
        <p className="muted small">Took {Math.round(current.timeSpent)}s on this move.</p>
      )}
    </div>
  )
}

/** For mistakes no detector explains: what was better, and what the move allowed. */
function fallbackExplanation(move: AnalyzedMove, analysis: GameAnalysis): string {
  const reply = analysis.moves[move.ply]?.bestSan
  return `Best was ${move.bestSan}.${reply ? ` Your move allowed ${reply}.` : ''}`
}

function KeyMoments({
  analysis,
  color,
  onSelect,
  current,
}: {
  analysis: GameAnalysis
  color: 'w' | 'b'
  onSelect: (ply: number) => void
  current: number
}) {
  const moments = analysis.moves.filter(
    (m) => m.color === color && (m.grade === 'mistake' || m.grade === 'blunder'),
  )
  const tips = analysis.moves.flatMap((m) =>
    m.color === color
      ? m.labels.filter((l) => isTip(l.kind)).map((l) => ({ ...l, ply: m.ply }))
      : [],
  )
  return (
    <div className="card">
      <h2>Your key moments</h2>
      {moments.length === 0 ? (
        <p className="muted small">No mistakes or blunders. Nice game!</p>
      ) : (
        <ul className="moments">
          {moments.map((m) => (
            <li key={m.ply}>
              <button
                type="button"
                className={`moment ${m.ply === current ? 'current' : ''}`}
                onClick={() => onSelect(m.ply)}
              >
                <span className={`grade-${m.grade}`}>
                  {m.moveNumber}
                  {m.color === 'w' ? '.' : '...'} {m.san}
                  {GRADE_SYMBOL[m.grade]}
                </span>
                <span className="muted small">
                  {m.labels.find((l) => !isTip(l.kind))?.text ?? fallbackExplanation(m, analysis)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(tips.length > 0 || analysis.notes.length > 0) && (
        <>
          <h3>Opening habits</h3>
          {tips.map((tip) => (
            <button
              type="button"
              key={`${tip.kind}-${tip.ply}`}
              className="tip-link"
              onClick={() => onSelect(tip.ply)}
            >
              <LabelBadge label={tip} />
            </button>
          ))}
          {analysis.notes.map((note) => (
            <LabelBadge key={note.kind} label={note} />
          ))}
        </>
      )}
    </div>
  )
}
