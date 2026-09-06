import type { Adapter } from './types'
import { greenhouse } from './greenhouse'
import { lever } from './lever'
import { ashby } from './ashby'
import { workday } from './workday'
import { linkedin } from './linkedin'

export const ADAPTERS: Adapter[] = [greenhouse, lever, ashby, workday, linkedin]

export function findAdapter(url: URL): Adapter | null {
  return ADAPTERS.find((a) => {
    try {
      return a.match(url)
    } catch {
      return false
    }
  }) ?? null
}
