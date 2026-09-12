import { useEffect, useState } from 'react'
import { ComboBox } from './ui/ComboBox'
import { loadCityLocations } from '@/lib/usLocations'

// The full city list is large; load it once, shared across every instance.
let cache: string[] | null = null
let pending: Promise<string[]> | null = null

/**
 * City field with worldwide autocomplete suggestions, for a real address
 * (Settings' "You" card) — unlike LocationInput (job location), it never
 * suggests "Remote"/"Hybrid"/etc. Picking a suggestion also hands back the
 * parsed state/country via onPick, so the caller can fill those fields too.
 */
export function CityInput({
  value,
  onChange,
  onPick,
}: {
  value: string
  onChange: (v: string) => void
  onPick: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [options, setOptions] = useState<string[]>(cache ?? [])

  useEffect(() => setDraft(value), [value])

  useEffect(() => {
    if (cache) return
    pending ??= loadCityLocations().then((l) => (cache = l))
    let alive = true
    void pending.then((l) => alive && setOptions(l))
    return () => {
      alive = false
    }
  }, [])

  return (
    <ComboBox
      value={draft}
      options={options}
      ariaLabel="City"
      placeholder="Austin"
      onChange={(v) => {
        setDraft(v)
        onChange(v)
      }}
      onCommit={(v) => onPick(v)}
    />
  )
}
