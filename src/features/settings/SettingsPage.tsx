import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearGames, db, getSettings, saveSettings, type Settings } from '../../db/db'
import { ENGINE_URL } from '../../engine/stockfish'
import { runAnalysisQueue } from '../../services/analysisQueue'
import { importPgn } from '../../services/importGames'

const DEPTHS = [10, 12, 14, 16, 18]
const MAX_GAMES = [10, 30, 50, 100]

export function SettingsPage() {
  const settings = useLiveQuery(getSettings)
  if (!settings) return null
  return (
    <section className="settings">
      <h1>Settings</h1>
      <AccountForm settings={settings} />
      <PgnImport />
      <DataSection />
      <About />
    </section>
  )
}

function AccountForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const username = form.username.trim()
    const switching =
      settings.username && username.toLowerCase() !== settings.username.toLowerCase()
    if (switching && (await db.games.count()) > 0) {
      if (
        !confirm(`Switch to ${username}? Games imported for ${settings.username} will be removed.`)
      )
        return
      await clearGames()
    }
    await saveSettings({ username, depth: form.depth, maxGames: form.maxGames })
    setSaved(true)
    void runAnalysisQueue()
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Analysis</h2>
      <label>
        Chess.com username
        <input
          value={form.username}
          onChange={(e) => {
            setSaved(false)
            setForm({ ...form, username: e.target.value })
          }}
        />
      </label>
      <label>
        Engine depth
        <select
          value={form.depth}
          onChange={(e) => {
            setSaved(false)
            setForm({ ...form, depth: Number(e.target.value) })
          }}
        >
          {DEPTHS.map((d) => (
            <option key={d} value={d}>
              {d}
              {d === 14 ? ' (recommended)' : d < 14 ? ' (faster)' : ' (slower, stronger)'}
            </option>
          ))}
        </select>
      </label>
      <label>
        Analyse automatically
        <select
          value={form.maxGames}
          onChange={(e) => {
            setSaved(false)
            setForm({ ...form, maxGames: Number(e.target.value) })
          }}
        >
          {MAX_GAMES.map((n) => (
            <option key={n} value={n}>
              the latest {n} games
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <button type="submit" className="primary">
          Save
        </button>
        {saved && <span className="muted small">Saved.</span>}
      </div>
    </form>
  )
}

function PgnImport() {
  const [pgn, setPgn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const id = await importPgn(pgn)
      navigate(`/game/${encodeURIComponent(id)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that PGN.')
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Paste a PGN</h2>
      <p className="muted small">
        For over-the-board games or anything not on Chess.com. Your side is worked out from your
        username in the White/Black headers.
      </p>
      <textarea
        rows={6}
        value={pgn}
        onChange={(e) => {
          setError(null)
          setPgn(e.target.value)
        }}
        placeholder={'[White "you"]\n[Black "opponent"]\n\n1. e4 e5 2. Nf3 ...'}
      />
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={!pgn.trim()}>
          Add and review
        </button>
      </div>
    </form>
  )
}

function DataSection() {
  const counts = useLiveQuery(async () => ({
    games: await db.games.count(),
    analyses: await db.analyses.count(),
  }))
  return (
    <div className="card">
      <h2>Your data</h2>
      <p className="muted small">
        {counts ? `${counts.games} games, ${counts.analyses} analysed. ` : ''}
        Everything is stored in this browser only.
      </p>
      <button
        type="button"
        className="danger"
        onClick={async () => {
          if (confirm('Delete all imported games and analysis from this browser?')) {
            await clearGames()
          }
        }}
      >
        Delete all games
      </button>
    </div>
  )
}

function About() {
  return (
    <div className="card">
      <h2>Engine</h2>
      <p className="muted small">
        Analysis uses Stockfish 19 Lite (WebAssembly, single-threaded) running in your browser.
        Stockfish is free software under the GNU GPL v3:{' '}
        <a href={ENGINE_URL.replace(/[^/]+$/, 'COPYING.txt')}>licence</a> ·{' '}
        <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">
          source
        </a>
        .
      </p>
    </div>
  )
}
