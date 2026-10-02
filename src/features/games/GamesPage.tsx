import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameAnalysis } from '../../analysis/types'
import { formatDate, formatTimeControl } from '../../components/format'
import { db, getSettings, saveSettings } from '../../db/db'
import type { StoredGame } from '../../lib/chesscom'
import { runAnalysisQueue, useAnalysisQueue } from '../../services/analysisQueue'
import { importFromChessCom } from '../../services/importGames'

export function GamesPage() {
  const settings = useLiveQuery(getSettings)
  const games = useLiveQuery(() => db.games.orderBy('playedAt').reverse().toArray(), [])
  const analyses = useLiveQuery(
    async () => new Map((await db.analyses.toArray()).map((a) => [a.gameId, a])),
    [],
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  async function runImport() {
    setBusy(true)
    setMessage({ text: 'Contacting Chess.com…' })
    try {
      const added = await importFromChessCom((text) => setMessage({ text }))
      setMessage({
        text:
          added === 0
            ? 'No new rapid games.'
            : `Imported ${added} new rapid game${added === 1 ? '' : 's'}.`,
      })
      void runAnalysisQueue()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    } finally {
      setBusy(false)
    }
  }

  if (!settings || !games || !analyses) return null
  if (!settings.username) return <Onboarding onSaved={runImport} />

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Your rapid games</h1>
          <p className="muted">
            {settings.username} on Chess.com
            {settings.lastImportAt ? ` · last import ${formatDate(settings.lastImportAt)}` : ''}
          </p>
        </div>
        <button type="button" className="primary" onClick={runImport} disabled={busy}>
          {busy ? 'Importing…' : 'Import new games'}
        </button>
      </div>
      {message && <p className={message.error ? 'error' : 'muted'}>{message.text}</p>}
      {games.length === 0 ? (
        <div className="card empty">
          No rapid games yet. Import from Chess.com, or paste a PGN in Settings.
        </div>
      ) : (
        <GameTable games={games} analyses={analyses} />
      )}
    </section>
  )
}

function Onboarding({ onSaved }: { onSaved: () => void }) {
  const [username, setUsername] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim()) return
    await saveSettings({ username: username.trim() })
    onSaved()
  }
  return (
    <section className="card onboarding">
      <h1>Learn from your own games</h1>
      <p className="muted">
        Enter your Chess.com username. Your recent rapid games are imported and analysed by
        Stockfish right here in your browser. Nothing is uploaded anywhere.
      </p>
      <form onSubmit={submit} className="inline-form">
        <input
          aria-label="Chess.com username"
          placeholder="Chess.com username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <button type="submit" className="primary">
          Import my games
        </button>
      </form>
    </section>
  )
}

function GameTable({
  games,
  analyses,
}: {
  games: StoredGame[]
  analyses: Map<string, GameAnalysis>
}) {
  const navigate = useNavigate()
  const queue = useAnalysisQueue()
  return (
    <table className="games">
      <thead>
        <tr>
          <th>Date</th>
          <th>Opponent</th>
          <th>Result</th>
          <th className="opening">Opening</th>
          <th className="num">Accuracy</th>
          <th>Mistakes</th>
        </tr>
      </thead>
      <tbody>
        {games.map((game) => {
          const analysis = analyses.get(game.id)
          const opponent = game.myColor === 'w' ? game.black : game.white
          const open = () => navigate(`/game/${encodeURIComponent(game.id)}`)
          return (
            <tr
              key={game.id}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
              tabIndex={0}
              className="clickable"
            >
              <td>
                {formatDate(game.playedAt)}
                <div className="muted small">{formatTimeControl(game.timeControl)}</div>
              </td>
              <td>
                <span
                  className={`piece-dot ${game.myColor === 'w' ? 'black' : 'white'}`}
                  title={`They played ${game.myColor === 'w' ? 'Black' : 'White'}`}
                />
                {opponent.name}
                {opponent.rating ? <span className="muted"> ({opponent.rating})</span> : null}
              </td>
              <td>
                <span className={`result ${game.result}`}>{game.result}</span>
                {game.termination && <div className="muted small">{game.termination}</div>}
              </td>
              <td className="opening">{game.opening ?? '–'}</td>
              <td className="num">
                {analysis ? `${Math.round(analysis.accuracy[game.myColor])}%` : '–'}
              </td>
              <td>
                {analysis ? (
                  <MistakeCounts analysis={analysis} />
                ) : queue.status === 'running' && queue.gameId === game.id ? (
                  <span className="muted small">
                    Analysing {Math.round((queue.done / queue.total) * 100)}%
                  </span>
                ) : (
                  <span className="muted small">Not analysed yet</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MistakeCounts({ analysis }: { analysis: GameAnalysis }) {
  const { blunder, mistake, inaccuracy } = analysis.summary
  if (blunder + mistake + inaccuracy === 0) return <span className="muted small">Clean game</span>
  return (
    <span className="counts">
      {blunder > 0 && <span className="grade-blunder">{blunder} ??</span>}
      {mistake > 0 && <span className="grade-mistake">{mistake} ?</span>}
      {inaccuracy > 0 && <span className="grade-inaccuracy">{inaccuracy} ?!</span>}
    </span>
  )
}
