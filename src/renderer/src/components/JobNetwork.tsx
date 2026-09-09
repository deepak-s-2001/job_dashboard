import { useMemo, useState } from 'react'
import type { Application, Contact } from '@shared/types'
import { useAppData } from '@/lib/store'
import { contactsForJob } from '@/lib/company'
import { relationshipLabel, personInitials } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { ContactDialog } from '@/components/ContactDialog'
import { ReferralEmailDialog } from '@/components/ReferralEmailDialog'

export function JobNetwork({ app }: { app: Application }) {
  const { contacts, linkContact, unlinkContact } = useAppData()
  const { matched, linked } = useMemo(() => contactsForJob(contacts, app), [contacts, app])

  const [emailFor, setEmailFor] = useState<Contact | null>(null)
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined)
  const [pickerId, setPickerId] = useState('')

  const shownIds = new Set([...matched, ...linked].map((c) => c.id))
  const linkable = contacts.filter((c) => !shownIds.has(c.id))

  const Row = ({ contact, kind }: { contact: Contact; kind: 'matched' | 'linked' }) => (
    <li className="flex flex-wrap items-center gap-2 border-3 border-ink bg-surface rounded p-3 shadow-hard-sm">
      <div className="flex h-9 w-9 flex-none items-center justify-center border-2 border-ink rounded bg-accent-cyan font-display text-[13px] font-bold">
        {personInitials(contact.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{contact.name}</div>
        <div className="truncate text-[13px] text-muted">
          {[contact.title, relationshipLabel(contact.relationship)].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="flex flex-none items-center gap-1.5">
        <Button size="sm" variant="primary" onClick={() => setEmailFor(contact)}>
          Draft email
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(contact)}>
          Edit
        </Button>
        {kind === 'linked' && (
          <button
            onClick={() => void unlinkContact(app.id, contact.id)}
            className="nb-focus border-2 border-ink px-2 py-1 text-[12px] font-bold hover:bg-accent-coral"
            title="Unlink from this job"
          >
            Unlink
          </button>
        )}
      </div>
    </li>
  )

  return (
    <div className="space-y-6">
      <section>
        <h4 className="mb-2 font-display text-base font-bold uppercase tracking-wide">
          {app.company ? `People at ${app.company}` : 'People at this company'}
        </h4>
        {matched.length > 0 ? (
          <ul className="space-y-2">
            {matched.map((c) => (
              <Row key={c.id} contact={c} kind="matched" />
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">
            No one in your network is at {app.company || 'this company'} yet.{' '}
            <button
              onClick={() => setEditing(null)}
              className="font-semibold text-ink underline hover:no-underline"
            >
              Add a contact
            </button>
            .
          </p>
        )}
      </section>

      {linked.length > 0 && (
        <section>
          <h4 className="mb-2 font-display text-base font-bold uppercase tracking-wide">
            Also helping with this one
          </h4>
          <ul className="space-y-2">
            {linked.map((c) => (
              <Row key={c.id} contact={c} kind="linked" />
            ))}
          </ul>
        </section>
      )}

      {linkable.length > 0 && (
        <section className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/60 pt-4">
          <span className="text-[13px] font-semibold text-muted">Link someone else:</span>
          <div className="w-64">
            <Select
              ariaLabel="Link a contact to this job"
              value={pickerId}
              onChange={setPickerId}
              options={[
                { value: '', label: 'Pick a contact…' },
                ...linkable.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.company ? ` · ${c.company}` : ''}`,
                })),
              ]}
            />
          </div>
          <Button
            size="sm"
            disabled={!pickerId}
            onClick={() => {
              void linkContact(app.id, pickerId)
              setPickerId('')
            }}
          >
            Link
          </Button>
        </section>
      )}

      <ReferralEmailDialog
        open={!!emailFor}
        onClose={() => setEmailFor(null)}
        contact={emailFor}
        app={app}
      />
      <ContactDialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        contact={editing}
        prefillCompany={app.company}
      />
    </div>
  )
}
