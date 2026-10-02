import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { GamesPage } from './features/games/GamesPage'
import { ReviewPage } from './features/review/ReviewPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { runAnalysisQueue, useAnalysisQueue } from './services/analysisQueue'

const COMING_SOON = ['Dashboard', 'Puzzles', 'Weekly plan']

export default function App() {
  useEffect(() => {
    void runAnalysisQueue()
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          ♞ Let’s Chess
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Games
          </NavLink>
          {COMING_SOON.map((name) => (
            <span key={name} className="nav-soon" title="Coming in a later milestone">
              {name}
            </span>
          ))}
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <QueueStatus />
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<GamesPage />} />
          <Route path="/game/:id" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function QueueStatus() {
  const queue = useAnalysisQueue()
  if (queue.status === 'running') {
    return (
      <div className="queue-status" aria-live="polite">
        <span className="spinner" />
        Analysing… {queue.remaining > 1 ? `${queue.remaining} games left` : 'last game'}
      </div>
    )
  }
  if (queue.status === 'error') {
    return (
      <div className="queue-status error">
        Analysis stopped: {queue.message}{' '}
        <button type="button" onClick={() => void runAnalysisQueue()}>
          Retry
        </button>
      </div>
    )
  }
  return null
}
