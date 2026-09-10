import { useEffect, useId, useState } from 'react'
import { Input } from './ui/Field'
import { US_LOCATIONS } from '@/lib/usLocations'

/**
 * Free-type location field with US state / metro / remote suggestions.
 * Self-stateful: `onChange` fires per keystroke (optional), `onBlur` fires the
 * final value — a parent can act on either.
 */
export function LocationInput({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange?: (v: string) => void
  onBlur?: (v: string) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <>
      <Input
        list={id}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange?.(e.target.value)
        }}
        onBlur={(e) => onBlur?.(e.target.value)}
        placeholder="City, ST · a state · Remote"
        autoComplete="off"
      />
      <datalist id={id}>
        {US_LOCATIONS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </>
  )
}
