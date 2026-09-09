import { memo } from 'react'
import { motion } from 'framer-motion'
import type { Application, Contact } from '@shared/types'
import { jobsForContact } from '@/lib/company'
import { personInitials, relationshipLabel } from '@/lib/format'

export const ContactCard = memo(function ContactCard({
  contact,
  apps,
  onClick,
}: {
  contact: Contact
  apps: Application[]
  onClick: () => void
}) {
  const jobs = jobsForContact(apps, contact)
  const links = [
    contact.linkedinUrl && { label: 'LinkedIn', url: contact.linkedinUrl },
    ...contact.links,
  ].filter(Boolean) as { label: string; url: string }[]

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onClick={onClick}
      className="nb-focus flex flex-col border-3 border-ink bg-surface rounded p-4 text-left shadow-hard transition-shadow hover:shadow-hard-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center border-3 border-ink rounded bg-accent-cyan font-display text-base font-bold">
          {personInitials(contact.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16px] font-bold leading-tight">
            {contact.name || 'Unnamed contact'}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold text-muted">
            {[contact.title, contact.company].filter(Boolean).join(' · ') || 'No company yet'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="border-2 border-ink bg-ground px-1.5 py-0.5 text-[11px] font-bold uppercase">
          {relationshipLabel(contact.relationship)}
        </span>
        {links.slice(0, 3).map((l) => (
          <span
            key={l.label + l.url}
            className="border-2 border-ink px-1.5 py-0.5 text-[11px] font-semibold"
          >
            {l.label}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-3 text-[12px] font-semibold text-muted">
        <span className="truncate">{contact.email || 'no email'}</span>
        <span className="flex-none border-2 border-ink bg-ground px-2 py-0.5 text-ink">
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
        </span>
      </div>
    </motion.button>
  )
})
