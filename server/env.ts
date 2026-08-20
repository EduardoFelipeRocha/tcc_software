import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

if (process.env.NODE_ENV !== 'test') {
  const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
  const environmentFile = join(rootDirectory, '.env')

  if (existsSync(environmentFile)) {
    try {
      loadEnvFile(environmentFile)
    } catch (error) {
      console.error('O arquivo .env existe, mas não pôde ser carregado.', error)
    }
  }
}
