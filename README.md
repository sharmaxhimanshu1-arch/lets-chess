# Let’s Chess

A personal training app for a beginner chess player who wants a higher rating. It imports your
**rapid games from Chess.com**, runs **Stockfish in your browser** over them, labels your mistakes in
plain language ("you hung your knight", "you missed a fork"), and turns them into a learning loop:
game review, a mistake dashboard, puzzles built from your own mistakes, and a weekly focus plan.

Everything runs client-side. There is no server or account, and your data stays in your browser
(IndexedDB).

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and milestones.

## What works today (Milestone 1)

- **Import**: enter your Chess.com username to pull your standard rapid games. Later imports only
  re-fetch the latest month. You can also paste a PGN in Settings.
- **Analysis**: Stockfish 19 Lite (WASM) runs in a Web Worker over every position of your latest
  games (30 by default, depth 14). Moves are graded inaccuracy / mistake / blunder by the win %
  they gave away (Lichess thresholds).
- **Explanations**: rule-based detectors label your mistakes in plain words: hung pieces,
  missed free pieces, allowed or missed mates, allowed or missed forks, moving too fast, and
  opening habits (early queen, the same piece twice, early f-pawn, not castling).
- **Review**: board with eval bar, best-move arrow, move-by-move explanations, your key moments
  and keyboard navigation (← → Home End).

## Code map

| Path                          | What                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/chesscom.ts`         | Chess.com archive client (rapid filter, incremental import), PGN game import |
| `src/lib/pgn.ts`              | PGN → positions, clocks and time spent per move                              |
| `src/engine/`                 | UCI session and the Stockfish Web Worker wrapper                             |
| `src/analysis/winprob.ts`     | Win %, move grading, accuracy                                                |
| `src/analysis/patterns.ts`    | Beginner mistake detectors                                                   |
| `src/analysis/analyzeGame.ts` | Runs the engine over a game and builds the analysis                          |
| `src/services/`               | Import service and background analysis queue                                 |
| `src/db/db.ts`                | IndexedDB storage (Dexie)                                                    |
| `src/features/`               | Pages: games list, review, settings                                          |

## Development

Requires Node 22+.

```sh
npm install
npm run dev        # start the dev server
npm run check      # lint + format check + typecheck + tests (same as CI)
npm run build      # production build into dist/
```

| Script                            | What it does |
| --------------------------------- | ------------ |
| `npm run lint`                    | oxlint       |
| `npm run format` / `format:check` | Prettier     |
| `npm run typecheck`               | `tsc -b`     |
| `npm test` / `test:watch`         | Vitest       |

## Engine licence

Stockfish is GPLv3. `scripts/copy-engine.mjs` (run before `dev` and `build`) copies the unmodified
`stockfish` npm build, plus its licence, into `public/engine/`. It is served as a separate file and
loaded as a Web Worker, never bundled into the app code.

## Deployment

Pushing to `main` builds the app and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). To enable it once, go to **Settings → Pages → Build and
deployment** and set **Source** to **GitHub Actions**.
