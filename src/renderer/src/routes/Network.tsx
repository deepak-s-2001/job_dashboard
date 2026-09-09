import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Fuse from 'fuse.js'
import type { Contact } from '@shared/types'
import { useAppData } from '@/lib/store'
import { ContactCard } from '@/components/ContactCard'
import { ContactDialog } from '@/components/ContactDialog'
import { Button } from '@/components/ui/Button'
import { EmptyState, Spinner } from '@/components/ui/misc'

export function Network() {
  const { contacts, apps, loading, error } = useAppData()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined) // undefined = closed

  // open a contact from ?c=<id> (command palette deep-link)
  useEffect(() => {
    const id = params.get('c')
    if (!id) return
    const c = contacts.find((x) => x.id === id)
    if (c) setEditing(c)
    params.delete('c')
    setParams(params, { replace: true })
  }, [params, contacts, setParams])

  const fuse = useMemo(
    () =>
      new Fuse(contacts, {
        threshold: 0.34,
        ignoreLocation: true,
        keys: [
          { name: 'name', weight: 3 },
          { name: 'company', weight: 3 },
          { name: 'title', weight: 2 },
          { name: 'email', weight: 1 },
          { name: 'howYouKnow', weight: 1 },
          { name: 'notes', weight: 1 },
        ],
      }),
    [contacts],
  )
  const results = useMemo(() => {
    const q = query.trim()
    return q ? fuse.search(q).map((r) => r.item) : contacts
  }, [query, fuse, contacts])

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b-3 border-ink bg-ground/95 px-6 py-4 backdrop-blur">
        <h1 className="font-display text-2xl font-bold">Network</h1>
        <span className="border-2 border-ink bg-surface px-2 py-0.5 text-sm font-bold">
          {results.length}
          {results.length !== contacts.length && (
            <span className="text-muted"> / {contacts.length}</span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {contacts.length > 0 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, role…"
              className="h-9 w-56 border-3 border-ink bg-surface rounded px-3 text-[14px] nb-focus placeholder:text-muted/90"
            />
          )}
          <Button variant="accent" onClick={() => setEditing(null)}>
            <span className="text-lg leading-none">+</span> Add contact
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto nb-scroll p-6">
        {error && (
          <div className="mb-4 border-3 border-ink bg-accent-coral p-3 text-sm font-semibold">
            {error}
          </div>
        )}
        {loading && contacts.length === 0 ? (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> Loading…
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            emoji="🤝"
            title="No contacts yet"
            action={<Button onClick={() => setEditing(null)}>Add your first contact</Button>}
          >
            People who might refer you. Add someone with their company and, when you save a job
            at that company, they show up on it automatically — with a ready-to-send email.
          </EmptyState>
        ) : results.length === 0 ? (
          <EmptyState emoji="🔍" title="No contacts match that search" />
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            <AnimatePresence mode="popLayout">
              {results.map((c) => (
                <ContactCard key={c.id} contact={c} apps={apps} onClick={() => setEditing(c)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ContactDialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        contact={editing}
      />
    </div>
  )
}
