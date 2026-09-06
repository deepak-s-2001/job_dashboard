import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Application } from '@shared/types'
import { ACCENT_HEX, SOURCE_LABEL, fmtDate, initials, relDays, titleCase } from '@/lib/format'
import { StatusPill } from './StatusControl'

export const AppCard = memo(function AppCard({ app }: { app: Application }) {
  const accent = ACCENT_HEX[app.accent]
  const skillCount =
    app.skills.required.length + app.skills.preferred.length + app.skills.industry.length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      whileHover={{ y: -4, x: -1 }}
    >
      <Link
        to={`/app/${app.id}`}
        className="nb-focus group flex h-full flex-col border-3 border-ink bg-surface rounded shadow-hard transition-shadow hover:shadow-hard-lg"
      >
        <div className="h-2 w-full flex-none border-b-3 border-ink" style={{ background: accent }} />
        <div className="flex flex-1 flex-col p-3.5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 flex-none items-center justify-center border-3 border-ink rounded font-display text-sm font-bold"
              style={{ background: accent }}
            >
              {initials(app.company)}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-display text-[15px] font-bold leading-tight"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              >
                {app.roleTitle || 'Untitled role'}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-muted">
                {app.company}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusPill status={app.status} />
            {app.employmentType && (
              <span className="border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase">
                {app.employmentType}
              </span>
            )}
            {app.workplaceType && (
              <span className="border-2 border-ink bg-ground px-1.5 py-0.5 text-[10px] font-bold uppercase">
                {app.workplaceType}
              </span>
            )}
          </div>

          {app.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {app.tags.slice(0, 4).map((t) => (
                <span key={t} className="bg-accent-lime/60 px-1.5 text-[11px] font-semibold">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 border-t-2 border-dashed border-ink/25 pt-2.5">
            <div className="min-w-0 text-[11px] font-semibold text-muted">
              <div title={fmtDate(app.dateApplied)}>Applied {relDays(app.dateApplied)}</div>
              <div className="truncate">via {SOURCE_LABEL[app.sourceSite] ?? titleCase(app.sourceSite)}</div>
            </div>
            <div className="flex flex-none items-center gap-1">
              <span
                className="border-2 border-ink bg-ground px-1.5 py-0.5 text-[11px] font-bold"
                title={`${app.resumes.length} resume${app.resumes.length === 1 ? '' : 's'} attached`}
              >
                📄 {app.resumes.length}
              </span>
              {app.extracted ? (
                <span
                  className="border-2 border-ink bg-accent-yellow px-1.5 py-0.5 text-[11px] font-bold"
                  title={`${skillCount} skills extracted`}
                >
                  ✦ {skillCount}
                </span>
              ) : (
                <span
                  className="border-2 border-dashed border-ink/40 px-1.5 py-0.5 text-[11px] font-bold text-ink/40"
                  title="Not extracted yet"
                >
                  ✦
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
})
