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
    writeFileSync(path, safeStorage.encryptString(trimmed), { mode: 0o600 })
  } else {
    // Fallback for a machine with no OS keyring (rare on Windows/macOS; can
    // happen on a headless Linux login). The key still never reaches the
    // renderer or db.json, but it is NOT encrypted at rest here.
    console.warn(
      '[secrets] OS encryption unavailable — API key stored unencrypted at ' + path,
    )
    writeFileSync(path, Buffer.from('plain:' + trimmed, 'utf8'), { mode: 0o600 })
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
