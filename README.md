# Let’s Chess

A personal training app for a beginner chess player who wants a higher rating. It imports your
**rapid games from Chess.com**, runs **Stockfish in your browser** over them, labels your mistakes in
plain language ("you hung your knight", "you missed a fork"), and turns them into a learning loop:
game review, a mistake dashboard, puzzles built from your own mistakes, and a weekly focus plan.

Everything runs client-side. There is no server or account, and your data stays in your browser
(IndexedDB).

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and milestones.

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

## Deployment

Pushing to `main` builds the app and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). To enable it once, go to **Settings → Pages → Build and
deployment** and set **Source** to **GitHub Actions**.
