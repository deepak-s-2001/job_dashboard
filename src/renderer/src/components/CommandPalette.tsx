import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppData } from '@/lib/store'
import { initials, personInitials } from '@/lib/format'
import { cn } from '@/lib/cn'

interface Item {
  id: string
  label: string
  hint?: string
  icon: string
  run: () => void
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { apps, contacts } = useAppData()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      } else if (
        !open &&
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const openEvt = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', openEvt)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', openEvt)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => {
      navigate(to)
      setOpen(false)
    }
    const base: Item[] = [
      { id: 'add', label: 'Add application', hint: 'from a job link', icon: '＋', run: go('/add') },
      { id: 'import', label: 'Import applications', hint: 'links or a CSV', icon: '⇊', run: go('/import') },
      { id: 'dash', label: 'Dashboard', icon: '▚', run: go('/') },
      { id: 'todos', label: 'To-dos', hint: 'tasks & follow-ups', icon: '✓', run: go('/todos') },
      { id: 'network', label: 'Network', hint: 'contacts & referrals', icon: '❋', run: go('/network') },
      { id: 'settings', label: 'Settings', icon: '⚙', run: go('/settings') },
    ]
    const appItems: Item[] = apps.map((a) => ({
      id: a.id,
      label: `${a.roleTitle} · ${a.company}`,
      hint: a.status,
      icon: initials(a.company),
      run: () => {
        navigate(`/app/${a.id}`)
        setOpen(false)
      },
    }))
    const contactItems: Item[] = contacts.map((c) => ({
      id: `contact-${c.id}`,
      label: c.name,
      hint: [c.title, c.company].filter(Boolean).join(' · ') || 'contact',
      icon: personInitials(c.name),
      run: () => {
        navigate(`/network?c=${c.id}`)
        setOpen(false)
      },
    }))
    const query = q.trim().toLowerCase()
    const all = [...base, ...appItems, ...contactItems]
    if (!query) return all.slice(0, 8)
    return all
      .filter((i) => i.label.toLowerCase().includes(query) || i.hint?.toLowerCase().includes(query))
      .slice(0, 10)
  }, [apps, contacts, q, navigate])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)))
  }, [items.length])

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <motion.div
            initial={{ y: -12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            className="relative w-full max-w-lg border-3 border-ink bg-surface rounded shadow-hard-xl"
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Jump to a job, or a page…"
              className="w-full border-b-3 border-ink bg-transparent px-4 py-3 text-sm outline-none"
            />
            <ul className="max-h-[45vh] overflow-y-auto nb-scroll p-1.5">
              {items.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>
              )}
              {items.map((item, i) => (
                <li key={item.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={item.run}
                    className={cn(
                      'flex w-full items-center gap-3 border-2 px-2.5 py-2 text-left text-sm',
                      i === active ? 'border-ink bg-accent-yellow' : 'border-transparent',
                    )}
                  >
                    <span className="flex h-6 w-6 flex-none items-center justify-center border-2 border-ink bg-surface text-[11px] font-bold">
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate font-semibold">{item.label}</span>
                    {item.hint && (
                      <span className="text-[11px] uppercase tracking-wide text-muted">
                        {item.hint}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t-2 border-ink/30 px-3 py-1.5 text-[12px] text-muted">
              ↑↓ navigate · ↵ open · esc close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
