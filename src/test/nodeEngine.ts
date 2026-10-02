import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { UciSession, type Engine } from '../engine/uci'

/** The same Stockfish build the browser uses, run under Node for tests. */
export function createNodeStockfish(): Engine {
  const require = createRequire(import.meta.url)
  const script = require.resolve('stockfish/bin/stockfish-19-lite-single.js')
  const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'inherit'] })
  let buffer = ''
  return new UciSession(
    (command) => child.stdin.write(command + '\n'),
    (onLine) => {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk
        const end = buffer.lastIndexOf('\n')
        if (end < 0) return
        onLine(buffer.slice(0, end))
        buffer = buffer.slice(end + 1)
      })
    },
    () => {
      child.stdin.end('quit\n')
      child.kill()
    },
  )
}
