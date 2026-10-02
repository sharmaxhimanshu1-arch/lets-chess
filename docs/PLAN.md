# Plan: "lets-chess" — personal Chess.com game-analysis trainer

## Context

The goal is a personal web app that helps one beginner (<1000) who plays **rapid** games on **Chess.com** raise their rating. At that level most games are lost to a handful of repeated mistakes: hanging pieces, missing free captures, missing forks or mates, and weak opening habits. The app imports your own games, runs Stockfish over them, labels each mistake in plain beginner terms using rule-based detectors (no AI or API costs), and turns those mistakes into a learning loop:

- **Game review**: step through a game with an eval bar and a short annotation for each move.
- **Mistake dashboard**: shows where you lose points, over time.
- **Mistake puzzles**: replays the positions where you went wrong, with spaced repetition.
- **Weekly focus plan**: names your one or two biggest weaknesses and what to practice.

Decisions made: personal tool (no auth or payments), runs fully in the browser (Stockfish as WASM, data in IndexedDB, static hosting), React + TypeScript + Vite, desktop-first layout, delivered as a thin slice first and then one milestone per PR.

The repo (`sharmaxhimanshu1-arch/lets-chess`) is empty, so this is a greenfield project on branch `claude/wonderful-noether-dnflh0`.

## Tech choices

| Concern     | Choice                                                           | Why                                                     |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Build       | Vite + React 19 + TypeScript (strict)                            | Recommended stack                                       |
| Rules / PGN | `chess.js`                                                       | Legal moves, SAN↔FEN, PGN parsing                       |
| Board       | `react-chessboard` (MIT)                                         | Avoids chessground's GPL licence                        |
| Engine      | `stockfish` npm, **single-threaded lite WASM** in a Web Worker   | Needs no COOP/COEP headers, so it works on GitHub Pages |
| Storage     | IndexedDB via `dexie`                                            | Analysis persists across sessions, no server needed     |
| Charts      | `recharts`                                                       | Dashboard trends                                        |
| Tests       | Vitest (+ Playwright smoke test using the preinstalled Chromium) |                                                         |
| Hosting     | GitHub Pages via a GitHub Actions workflow                       | Free and static                                         |

## Architecture (src/)

- `lib/chesscom.ts`: fetches `https://api.chess.com/pub/player/{user}/games/archives` and then the monthly archives. Keeps only `rules === "chess"` and `time_class === "rapid"`, de-duplicates by game `url`, and imports incrementally (only months newer than the last import). Also supports pasting a PGN as a fallback.
- `lib/pgn.ts`: parses PGNs into positions (FEN before and after each move), the player's colour, ratings, ECO/opening name, and `%clk` clock times, from which it derives time spent per move.
- `engine/stockfish.worker.ts` + `engine/engine.ts`: a promise-based UCI wrapper, `analyse(fen, {depth: 14, multiPV: 2}) → {bestMove, pv, score(cp|mate)}`. It runs jobs one at a time from a queue and can be cancelled.
- `analysis/winprob.ts`: converts centipawns to win % using the Lichess formula (`50 + 50·(2/(1+e^(-0.00368208·cp)) − 1)`). Moves are graded by the win % lost: ≥5 inaccuracy, ≥10 mistake, ≥15 blunder (Lichess thresholds). It also computes per-game accuracy.
- `analysis/patterns/*.ts`: rule-based beginner labels. Each detector is a pure function `(ctx) → Label | null` and gets its own unit tests:
  - `hungPiece`: after your move, the opponent's best reply wins material according to a material count along the engine PV.
  - `missedFreePiece`: the best move was a capture that wins material, and you didn't play it.
  - `allowedMate` / `missedMate`: engine mate scores (mate in 1–3).
  - `fork`: the engine's best move (missed or allowed) attacks the king or two or more pieces that are undefended or worth more than the attacker.
  - `openingPrinciples` (first ~12 moves): early queen sorties, moving the same piece twice, not castled by move 12, weakening f-pawn moves.
  - `rushed`: a mistake or blunder played in under 5 s while more than 3 min remained.
  - Phase tag (opening/middlegame/endgame) from move number and material.
- `analysis/analyzeGame.ts`: runs the engine over every position, then classification, then patterns, and saves a `GameAnalysis` record. A background queue analyses the newest games first, resumes after a reload, and shows progress.
- `db/db.ts`: Dexie tables `games`, `analyses`, `puzzles` (holding SRS state), `settings` (username, depth).
- `features/`: `import/`, `review/`, `dashboard/`, `puzzles/`, `plan/`. Shared `components/`: `Board`, `EvalBar`, `MoveList`, `LabelBadge`.
- Routing with `react-router`: `/` (game list), `/game/:id`, `/dashboard`, `/puzzles`, `/plan`, `/settings`.

## Status

- ✅ M0 Scaffold
- ✅ M1 Import → Analyse → Review. Notes: detectors live in a single `analysis/patterns.ts`. Analysis uses MultiPV 1 for speed. For a mistake no detector explains, the review shows the best move and the opponent's best reply ("your move allowed Nxe5").
- ✅ Speed fix: analysis was ~200 ms/position at depth 14 in a single worker. It now uses depth 12 by default plus a pool of up to 4 workers, ~6× faster on a 4-core machine. Engine start-up and searches time out with a visible error instead of hanging.
- ⏳ M2 Mistake dashboard

## Milestones (one PR each)

1. **M0 Scaffold**: Vite + TS + oxlint/Prettier + Vitest, CI workflow (lint, typecheck, test, build), Pages deploy, `docs/PLAN.md` copy of this plan.
2. **M1 Thin slice: Import → Analyse → Review**: settings (Chess.com username), rapid-game import, engine worker and analysis queue, game list showing result, accuracy and blunder count, and a review screen with board, eval bar, a move list with ?!/?/?? markers, label badges ("You hung your knight on f3"), and a "best was Nxe5" arrow.
3. **M2 Mistake dashboard**: rating trend (from Chess.com game data), accuracy trend, label frequency, and win % lost by label, phase and colour, for the last 10, 30 or all games.
4. **M3 Mistake puzzles**: each of your mistakes or blunders becomes a "find the better move" drill. Any move within 5 win % of the best counts as correct. Uses Leitner/SM-2 spaced repetition, with a daily queue and filters by label.
5. **M4 Weekly focus plan**: ranks labels by total win % lost over the last N games, picks the top one or two, and pairs each with beginner advice (e.g. a blunder-check routine for `hungPiece`), today's own-mistake puzzles for that label, and links to the matching Lichess themed puzzles (`/training/hangingPiece`, `/fork`, `/mateIn1`).

## Verification

- **Unit tests** (Vitest): win-prob and grading thresholds, PGN or clock parsing on a real Chess.com PGN fixture, and each pattern detector against hand-picked FENs (one positive and one negative case each).
- **Engine**: integration test that the worker returns a mate score for a known mate-in-1 FEN.
- **End to end**: run `npm run dev`, enter a real Chess.com username, import, and confirm games get analysed and the review screen labels a known blunder. Take a Playwright screenshot of the review page.
- CI must be green (lint, typecheck, test, build) before each milestone PR.

## Open items (to be settled during M1, no blocker)

- Your Chess.com username, which only goes into settings at runtime and is never committed.
- Default engine depth (12) and how many recent games to analyse by default (30). Both can be changed in settings.
