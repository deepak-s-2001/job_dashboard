import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact, ContactLink, ContactRelationship, NewContactInput } from '@shared/types'
import { CONTACT_RELATIONSHIPS } from '@shared/types'
import { useAppData } from '@/lib/store'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Fieldset, Select } from '@/components/ui/Field'
import { LinksInput } from '@/components/LinksInput'
import { jobsForContact } from '@/lib/company'
import { relationshipLabel } from '@/lib/format'

const BLANK: NewContactInput = {
  name: '',
  email: '',
  company: '',
  title: '',
  relationship: 'former-colleague',
  linkedinUrl: '',
  links: [],
  howYouKnow: '',
  notes: '',
}

export function ContactDialog({
  open,
  onClose,
  contact,
  prefillCompany,
}: {
  open: boolean
  onClose: () => void
  contact?: Contact | null
  prefillCompany?: string
}) {
  const { apps, createContact, updateContact, removeContact } = useAppData()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [form, setForm] = useState<NewContactInput>(BLANK)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (contact) {
      const { id, createdAt, updatedAt, ...rest } = contact
      void id
      void createdAt
      void updatedAt
      setForm(rest)
    } else {
      setForm({ ...BLANK, company: prefillCompany ?? '' })
    }
  }, [open, contact, prefillCompany])

  const set = <K extends keyof NewContactInput>(k: K, v: NewContactInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const connectedJobs = useMemo(
    () => (contact ? jobsForContact(apps, contact) : []),
    [apps, contact],
  )

  async function save() {
    if (!form.name.trim()) {
      toast.push('error', 'A name is required.')
      return
    }
    setBusy(true)
    try {
      if (contact) await updateContact(contact.id, form)
      else await createContact(form)
      toast.push('success', contact ? 'Contact updated.' : `Added ${form.name.trim()}.`)
      onClose()
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!contact) return
    const yes = await confirm({
      title: 'Delete this contact?',
      body: (
        <>
          <strong>{contact.name}</strong> will be removed and unlinked from any jobs. This can't
          be undone.
        </>
      ),
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!yes) return
    try {
      await removeContact(contact.id)
      toast.push('info', 'Contact removed.')
      onClose()
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not delete.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={contact ? 'Edit contact' : 'Add a contact'} width="max-w-xl">
      <div className="max-h-[68vh] space-y-4 overflow-y-auto nb-scroll pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Fieldset label="Name *">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Fieldset>
          <Fieldset label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="name@company.com"
            />
          </Fieldset>
          <Fieldset label="Company" hint="drives the per-job match">
            <Input
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="Bank of America"
            />
          </Fieldset>
          <Fieldset label="Their title">
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Senior Engineer"
            />
          </Fieldset>
          <Fieldset label="How you know them">
            <Select
              ariaLabel="Relationship"
              value={form.relationship}
              onChange={(v) => set('relationship', v as ContactRelationship)}
              options={CONTACT_RELATIONSHIPS.map((r) => ({ value: r, label: relationshipLabel(r) }))}
            />
          </Fieldset>
          <Fieldset label="LinkedIn URL">
            <Input
              value={form.linkedinUrl}
              onChange={(e) => set('linkedinUrl', e.target.value)}
              placeholder="linkedin.com/in/…"
            />
          </Fieldset>
        </div>

        <Fieldset label="Other links">
          <LinksInput value={form.links} onChange={(links: ContactLink[]) => set('links', links)} />
        </Fieldset>

        <Fieldset label="Context" hint="used in the referral email">
          <Textarea
            rows={2}
            value={form.howYouKnow}
            onChange={(e) => set('howYouKnow', e.target.value)}
            placeholder="Sensor team at Acme, 2019–2021 — we shipped the beamforming firmware together."
          />
        </Fieldset>

        <Fieldset label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Private to you."
          />
        </Fieldset>

        {contact && connectedJobs.length > 0 && (
          <div className="border-t-2 border-dashed border-ink/60 pt-3">
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">
              Connected to {connectedJobs.length} job{connectedJobs.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {connectedJobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    onClose()
                    navigate(`/app/${j.id}`)
                  }}
                  className="nb-focus border-2 border-ink bg-ground px-2 py-0.5 text-[12px] font-semibold hover:bg-accent-lime"
                >
                  {j.roleTitle} · {j.company}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t-3 border-ink pt-3">
        {contact ? (
          <Button variant="danger" size="sm" onClick={del}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : contact ? 'Save' : 'Add contact'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
