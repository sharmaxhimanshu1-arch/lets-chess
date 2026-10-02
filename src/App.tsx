const MILESTONES = [
  { name: 'Import & review', detail: 'Pull your rapid games from Chess.com and review each move.' },
  {
    name: 'Mistake dashboard',
    detail: 'See which mistakes cost you the most, and how that changes.',
  },
  {
    name: 'Mistake puzzles',
    detail: 'Replay the positions you got wrong until you get them right.',
  },
  { name: 'Weekly focus', detail: 'One or two things to work on this week, with drills.' },
]

export default function App() {
  return (
    <main className="shell">
      <header>
        <h1>♞ Let’s Chess</h1>
        <p className="tagline">Learn from your own games. Stop repeating the same mistakes.</p>
      </header>
      <section>
        <h2>Coming next</h2>
        <ol className="milestones">
          {MILESTONES.map((m) => (
            <li key={m.name}>
              <strong>{m.name}</strong>
              <span>{m.detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
