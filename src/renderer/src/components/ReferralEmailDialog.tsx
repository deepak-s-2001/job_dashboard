import { useEffect, useMemo, useState } from 'react'
import type { Application, Contact } from '@shared/types'
import { useAppData } from '@/lib/store'
import { api, call } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { buildReferralEmail } from '@/lib/referralEmail'

export function ReferralEmailDialog({
  open,
  onClose,
  contact,
  app,
}: {
  open: boolean
  onClose: () => void
  contact: Contact | null
  app: Application
}) {
  const { settings } = useAppData()
  const toast = useToast()

  const base = useMemo(
    () => (contact ? buildReferralEmail(contact, app, settings.profile) : null),
    [contact, app, settings.profile],
  )
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // (re)seed from the template whenever the dialog opens for a contact
  useEffect(() => {
    if (open && base) {
      setSubject(base.subject)
      setBody(base.body)
    }
  }, [open, base])

  if (!contact) return null
  const c = contact

  const mailto = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    toast.push('success', 'Email copied.')
  }

  async function openMail() {
    if (!c.email) {
      toast.push('error', 'This contact has no email — add one, or copy the text.')
      return
    }
    try {
      await call(api.system.openExternal(mailto))
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not open your mail app.')
    }
  }

  const bracketWarn = /\[[^\]]+\]/.test(body)

  return (
    <Dialog open={open} onClose={onClose} title={`Referral email — ${contact.name}`} width="max-w-2xl">
      <div className="space-y-3">
        <div className="border-3 border-ink bg-ground p-3 text-[13px] leading-relaxed text-muted">
          Drafted from this job and your <strong className="text-ink">You</strong> details in
          Settings, tuned for a <strong className="text-ink">{contact.relationship.replace('-', ' ')}</strong>.
          Edit it, then copy or open it in your mail app. Attach your resume before sending.
        </div>

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted">
            Subject
          </span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted">
            Body
          </span>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="font-mono text-[13px]"
          />
        </label>

        {bracketWarn && (
          <p className="text-[13px] font-semibold text-accent-coral">
            Fill in the [bracketed] bits before you send.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t-3 border-ink pt-3">
        <Button variant="outline" onClick={copy}>
          Copy email
        </Button>
        <Button variant="primary" onClick={openMail}>
          Open in mail app
        </Button>
      </div>
    </Dialog>
  )
}
