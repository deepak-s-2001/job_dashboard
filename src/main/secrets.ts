import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './store'

function secretsPath(): string {
  return join(dataDir(), 'secrets.bin')
}

/** Store the Anthropic API key, OS-encrypted at rest. */
export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    clearApiKey()
    return
  }
  const path = secretsPath()
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(path, safeStorage.encryptString(trimmed))
  } else {
    // Fallback: still keep it off the renderer and out of the db.json,
    // but note it is not OS-encrypted on this machine.
    writeFileSync(path, Buffer.from('plain:' + trimmed, 'utf8'))
  }
}

export function getApiKey(): string | null {
  const path = secretsPath()
  if (!existsSync(path)) return null
  try {
    const buf = readFileSync(path)
    if (buf.subarray(0, 6).toString('utf8') === 'plain:') {
      return buf.subarray(6).toString('utf8')
    }
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return null
  } catch {
    return null
  }
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

export function clearApiKey(): void {
  const path = secretsPath()
  if (existsSync(path)) rmSync(path)
}
