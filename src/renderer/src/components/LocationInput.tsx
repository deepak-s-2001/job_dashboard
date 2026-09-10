import { useEffect, useState } from 'react'
import { ComboBox } from './ui/ComboBox'
import { US_LOCATIONS } from '@/lib/usLocations'

/**
 * Free-type location field with US state / metro / remote suggestions.
 * `onChange` fires per keystroke (optional); `onBlur` fires the final value.
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
  useEffect(() => setDraft(value), [value])

  return (
    <ComboBox
      value={draft}
      options={US_LOCATIONS}
      size={size}
      ariaLabel="Location"
      placeholder="City, ST · a state · Remote"
      onChange={(v) => {
        setDraft(v)
        onChange?.(v)
      }}
      onCommit={(v) => onBlur?.(v)}
    />
  )
}
