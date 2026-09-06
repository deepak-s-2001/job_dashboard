import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** URL-safe short id, ~72 bits — plenty for a personal single-user store. */
export function genId(len = 12): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/**
 * Minimal durable JSON store: load once into memory, write atomically
 * (temp file + rename) with a short debounce so bursts of edits coalesce.
 */
export class JsonDb<T extends object> {
  data: T
  private path: string
  private timer: NodeJS.Timeout | null = null
  private writing: Promise<void> = Promise.resolve()

  private constructor(path: string, data: T) {
    this.path = path
    this.data = data
  }

  static open<T extends object>(path: string, defaults: T): JsonDb<T> {
    mkdirSync(dirname(path), { recursive: true })
    let data = defaults
    if (existsSync(path)) {
      try {
        data = { ...defaults, ...(JSON.parse(readFileSync(path, 'utf8')) as T) }
      } catch {
        // corrupt file — keep a copy and start fresh rather than lose the app
        try {
          renameSync(path, `${path}.corrupt-${Date.now()}`)
        } catch {
          /* ignore */
        }
        data = defaults
      }
    }
    return new JsonDb(path, data)
  }

  /** Debounced write (coalesces rapid edits). */
  write(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    return new Promise<void>((resolve, reject) => {
      this.timer = setTimeout(() => {
        this.timer = null
        this.writing = this.flush().then(resolve, reject)
      }, 120)
    })
  }

  /** Force an immediate synchronous-ish flush (used on quit). */
  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.writing
    await this.flush()
  }

  private async flush(): Promise<void> {
    const tmp = `${this.path}.tmp-${process.pid}`
    const json = JSON.stringify(this.data, null, 2)
    writeFileSync(tmp, json, 'utf8')
    renameSync(tmp, this.path)
  }
}
