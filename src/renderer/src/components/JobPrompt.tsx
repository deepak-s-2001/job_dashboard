import { useMemo, useState } from 'react'
import type { Application } from '@shared/types'
import { buildResumePrompt } from '@/lib/prompt'
import { Button } from './ui/Button'

export function JobPrompt({ app }: { app: Application }) {
  const prompt = useMemo(() => buildResumePrompt(app), [app])
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const words = prompt.trim().split(/\s+/).length

  return (
    <div className="space-y-3">
      <div className="border-3 border-ink bg-ground p-3.5 text-[14px] leading-relaxed">
        <p className="font-semibold">A ready-to-use resume-tailoring prompt for this job.</p>
        <p className="mt-1 text-muted">
          Copy it, paste it into Claude or ChatGPT, and replace the{' '}
          <code className="border border-ink bg-surface px-1 font-mono text-[12px]">
            PASTE YOUR CURRENT RESUME HERE
          </code>{' '}
          block with your master resume. You get back a fit analysis, a skill-by-skill coverage
          table, and line-by-line edits — every job requirement mapped to real experience or
          flagged as a gap.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy prompt'}
        </Button>
        <span className="text-[13px] text-muted">{words.toLocaleString()} words · everything about this job is baked in</span>
      </div>

      <pre className="max-h-[52vh] overflow-auto nb-scroll border-3 border-ink bg-surface p-3.5 font-mono text-[12.5px] leading-relaxed text-ink/90">
        {prompt}
      </pre>
    </div>
  )
}
