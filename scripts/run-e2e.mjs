import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const serverUrl = 'http://127.0.0.1:4174'
const testDirectory = mkdtempSync(join(tmpdir(), 'guiaconcursos-e2e-'))
const testDataFile = join(testDirectory, 'data.json')
const testSuggestionsFile = join(testDirectory, 'catalog-suggestions.json')
writeFileSync(testDataFile, JSON.stringify({ users: [], sessions: [], studies: {} }), 'utf8')

const build = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build'],
  { stdio: 'inherit' },
)
if (build.status !== 0) {
  rmSync(testDirectory, { recursive: true, force: true })
  throw new Error('O build da interface para o E2E falhou.')
}

const serverProcess = spawn(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'],
  {
    stdio: 'ignore',
    env: {
      ...process.env,
      DATA_FILE: testDataFile,
      CATALOG_SUGGESTIONS_FILE: testSuggestionsFile,
      NODE_ENV: 'test',
      PORT: '4174',
      SERVE_STATIC: 'true',
    },
  },
)

async function waitForServer(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url)
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
      {
        stdio: 'inherit',
        env: { ...process.env, GUIACONCURSOS_E2E_DATA_FILE: testDataFile },
      },
    )
    runner.on('error', reject)
    runner.on('exit', (code) => resolve(code ?? 1))
  })
}

try {
  await waitForServer(`${serverUrl}/api/auth/session`)
  process.exitCode = await runPlaywright()
} finally {
  serverProcess.kill()
  rmSync(testDirectory, { recursive: true, force: true })
}
