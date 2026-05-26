import path from 'path'
import { promises as fs } from 'fs'

export const authStatePath = path.join(process.cwd(), 'playwright', '.auth', 'user.json')
const repoEnvPath = path.join(process.cwd(), '..', '.env')

function parseEnvValue(rawValue: string) {
  const trimmed = rawValue.trim()

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export async function readPlaywrightCredentials() {
  const envText = await fs.readFile(repoEnvPath, 'utf8')
  const entries = new Map<string, string>()

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase()
    const value = parseEnvValue(line.slice(separatorIndex + 1))
    entries.set(key, value)
  }

  const username = entries.get('test_user') || ''
  const password = entries.get('test_password') || ''
  const email = entries.get('test_email') || ''

  if (!username || !password || !email) {
    throw new Error('Missing Playwright test credentials in the repo-root .env file.')
  }

  return { username, password, email }
}