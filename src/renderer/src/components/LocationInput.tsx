import { useEffect, useState } from 'react'
import { ComboBox } from './ui/ComboBox'
import { WORK_ARRANGEMENTS, loadLocations } from '@/lib/usLocations'

// the full city list is large; load it once, shared across every instance
let cache: string[] | null = null
let pending: Promise<string[]> | null = null

/**
 * Free-type location field with worldwide city suggestions ("City, Region,
 * Country"; US as "City, State"). Any typed value is kept as-is.
 */
export function LocationInput({
  value,
  onChange,
  onBlur,
  size,
}: {
  value: string
  onChange?: (v: string) => void
  onBlur?: (v: string) => void
  size?: 'sm' | 'md'
}) {
  const [draft, setDraft] = useState(value)
  const [options, setOptions] = useState<string[]>(cache ?? WORK_ARRANGEMENTS)

  useEffect(() => setDraft(value), [value])

  useEffect(() => {
    if (cache) return
    pending ??= loadLocations().then((l) => (cache = l))
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
      size={size}
      ariaLabel="Location"
      placeholder="City, Region · a US state · Remote"
      onChange={(v) => {
        setDraft(v)
        onChange?.(v)
      }}
      onCommit={(v) => onBlur?.(v)}
    />
  )
}
