import { spawn } from 'node:child_process'
import process from 'node:process'

const serverUrl = 'http://127.0.0.1:4174'
const viteProcess = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4174'],
  { stdio: 'ignore' },
)

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(serverUrl)
      if (response.ok) return
    } catch {
      // O servidor ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('O servidor de teste não iniciou a tempo.')
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test'],
      { stdio: 'inherit' },
    )
    runner.on('error', reject)
    runner.on('exit', (code) => resolve(code ?? 1))
  })
}

try {
  await waitForServer()
  process.exitCode = await runPlaywright()
} finally {
  viteProcess.kill()
}
