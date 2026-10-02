// Copies the Stockfish WASM build the app uses into public/engine/ so Vite serves it
// as a static file next to the page. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pkgDir = dirname(require.resolve('stockfish/package.json'))
const outDir = join(import.meta.dirname, '..', 'public', 'engine')

mkdirSync(outDir, { recursive: true })
for (const file of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(join(pkgDir, 'bin', file), join(outDir, file))
}
// Stockfish is GPLv3; ship its licence alongside the binary.
copyFileSync(join(pkgDir, 'Copying.txt'), join(outDir, 'COPYING.txt'))
console.log(`Copied Stockfish into ${outDir}`)
