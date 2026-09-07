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
  const role = (app.roleTitle || 'Untitled role').replace(/[\s,;:–—-]+$/, '')

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
        className="nb-focus group flex flex-col border-3 border-ink bg-surface rounded shadow-hard transition-shadow hover:shadow-hard-lg"
      >
        <div className="h-2.5 w-full flex-none border-b-3 border-ink" style={{ background: accent }} />

        <div className="flex flex-col gap-3 p-4 pb-3.5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 flex-none items-center justify-center border-3 border-ink rounded font-display text-base font-bold"
              style={{ background: accent }}
            >
              {initials(app.company)}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-display text-[17px] font-bold leading-tight"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {role}
              </div>
              <div className="mt-1 truncate text-[14px] font-semibold text-muted">{app.company}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={app.status} />
            {app.employmentType && (
              <span className="border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold uppercase">
                {app.employmentType}
              </span>
            )}
            {app.workplaceType && (
              <span className="border-2 border-ink bg-ground px-1.5 py-0.5 text-[11px] font-bold uppercase">
                {app.workplaceType}
              </span>
            )}
          </div>

          {app.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {app.tags.slice(0, 4).map((t) => (
                <span key={t} className="bg-accent-lime/60 px-1.5 py-0.5 text-[13px] font-semibold">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t-2 border-dashed border-ink/60" />
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-4 py-3">
            <div
              className="text-[13px] font-semibold text-muted"
              title={
                app.status === 'not-applied'
                  ? `Added ${fmtDate(app.createdAt)} · not applied yet`
                  : `Applied ${fmtDate(app.dateApplied)} · via ${SOURCE_LABEL[app.sourceSite] ?? titleCase(app.sourceSite)}`
              }
            >
              {app.status === 'not-applied'
                ? `Added ${relDays(app.createdAt)}`
                : `Applied ${relDays(app.dateApplied)}`}{' '}
              · {SOURCE_LABEL[app.sourceSite] ?? titleCase(app.sourceSite)}
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <span className="border-2 border-ink bg-ground px-2 py-0.5 text-[13px] font-bold">
                {app.resumes.length} {app.resumes.length === 1 ? 'resume' : 'resumes'}
              </span>
              {app.extracted ? (
                <span
                  className="border-2 border-ink bg-accent-yellow px-2 py-0.5 text-[13px] font-bold"
                  title={`${skillCount} skills extracted`}
                >
                  {skillCount} skills
                </span>
              ) : (
                <span className="border-2 border-dashed border-ink/55 px-2 py-0.5 text-[13px] font-bold text-muted">
                  no AI
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
})
