import type { Accent } from '@shared/types'

export const ACCENT_HEX: Record<Accent, string> = {
  pink: '#ff90e8',
  yellow: '#ffc900',
  cyan: '#23a094',
  blue: '#6c8cff',
  lime: '#a8e10c',
  coral: '#ff6b57',
  purple: '#b47cff',
}

export const STATUS_HEX: Record<string, string> = {
  'not-applied': '#ddd6c6',
  applied: '#6c8cff',
  interviewing: '#ffc900',
  offer: '#22c55e',
  rejected: '#ff6b57',
  ghosted: '#9ca3af',
  withdrawn: '#b47cff',
}

export const STATUS_LABEL: Record<string, string> = {
  'not-applied': 'Not applied',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  withdrawn: 'Withdrawn',
}

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? titleCase(s)
}

export const SOURCE_LABEL: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  linkedin: 'LinkedIn',
  generic: 'Web',
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function relDays(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  const diff = Math.round((Date.now() - d.getTime()) / 86_400_000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 30) return `${diff}d ago`
  if (diff < 365) return `${Math.round(diff / 30)}mo ago`
  return `${Math.round(diff / 365)}y ago`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function initials(company: string): string {
  const words = company.replace(/[^a-z0-9 ]/gi, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function money(n: number): string {
  if (n < 0.01) return '<$0.01'
  return '$' + n.toFixed(2)
}
