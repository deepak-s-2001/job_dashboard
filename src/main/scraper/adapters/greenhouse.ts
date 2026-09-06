import { fetchText } from '../render'
import { htmlToText } from '../htmltext'
import { titleCaseSlug, type Adapter } from './types'

function ids(url: URL): { org: string; jobId: string } | null {
  // boards.greenhouse.io/<org>/jobs/<id>  |  job-boards.greenhouse.io/<org>/jobs/<id>
  const m = url.pathname.match(/\/([^/]+)\/jobs\/(\d+)/)
  if (m) return { org: m[1], jobId: m[2] }
  // company site embed: ?gh_jid=<id> — org unknown, bail to render
  return null
}

export const greenhouse: Adapter = {
  id: 'greenhouse',
  match: (url) => /(^|\.)greenhouse\.io$/.test(url.hostname),
  run: async (url) => {
    const parsed = ids(url)
    if (!parsed) return null
    const { org, jobId } = parsed

    const jobRes = await fetchText(
      `https://boards-api.greenhouse.io/v1/boards/${org}/jobs/${jobId}?content=true`,
    )
    if (!jobRes.ok) return null

    let job: Record<string, unknown>
    try {
      job = JSON.parse(jobRes.body)
    } catch {
      return null
    }

    let company = titleCaseSlug(org)
    const boardRes = await fetchText(`https://boards-api.greenhouse.io/v1/boards/${org}`)
    if (boardRes.ok) {
      try {
        const board = JSON.parse(boardRes.body) as Record<string, unknown>
        if (typeof board.name === 'string' && board.name.trim()) company = board.name.trim()
      } catch {
        /* keep slug-derived name */
      }
    }

    // Greenhouse `content` is HTML-entity-encoded HTML.
    const contentHtml =
      typeof job.content === 'string'
        ? job.content
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
        : ''

    const jdText = htmlToText(contentHtml)
    if (jdText.length < 80) return null

    const location =
      job.location && typeof job.location === 'object'
        ? String((job.location as Record<string, unknown>).name ?? '') || null
        : null
    const updatedAt = typeof job.updated_at === 'string' ? job.updated_at.slice(0, 10) : null
    const roleTitle = typeof job.title === 'string' ? job.title.trim() : null

    return {
      sourceSite: 'greenhouse',
      company,
      roleTitle,
      location,
      datePosted: updatedAt,
      jdText,
    }
  },
}
