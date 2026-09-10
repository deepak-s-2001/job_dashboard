import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Textarea } from './ui/Field'
import { Button } from './ui/Button'

/**
 * A textarea with an explicit Save button (and Ctrl/Cmd+Enter). Auto-saves on
 * blur too, but the button is the obvious affordance.
 */
export function NotesEditor({
  value,
  onSave,
  rows = 12,
  placeholder,
}: {
  value: string
  onSave: (v: string) => void | Promise<unknown>
  rows?: number
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const [savedFlash, setSavedFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // re-sync when the underlying value changes (paging between jobs, external edit)
  useEffect(() => setDraft(value), [value])

  const dirty = draft !== value

  async function save() {
    if (!dirty) return
    await onSave(draft)
    setSavedFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setSavedFlash(false), 1600)
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
  }

  return (
    <div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => void save()}
        rows={rows}
        className="text-[15px]"
        placeholder={placeholder}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
          {savedFlash ? 'Saved ✓' : 'Save'}
        </Button>
        <span className="text-[12px] text-muted">
          {dirty ? 'Unsaved changes · ⌘/Ctrl+Enter' : savedFlash ? '' : 'Also saves when you click away'}
        </span>
      </div>
    </div>
  )
}
