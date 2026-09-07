import type { Application } from '@shared/types'
import { stripMarkers } from '@/components/Highlighted'
import { SOURCE_LABEL, titleCase } from './format'

const RESUME_PLACEHOLDER =
  'PASTE YOUR CURRENT RESUME HERE AS PLAIN TEXT.\nInclude every section — summary, skills, all experience with bullet points, projects, education.'

function bullets(items: string[]): string {
  return items.length ? items.map((i) => `  - ${stripMarkers(i)}`).join('\n') : '  (none captured)'
}

function list(items: string[]): string {
  return items.length ? items.map((i) => stripMarkers(i)).join(', ') : '(none captured)'
}

/**
 * Builds a self-contained, copy-paste resume-tailoring prompt for one job.
 * Structure follows current prompt-engineering guidance: role → context →
 * source data in tags → task → rules (with the reasoning behind them) →
 * explicit output format. Everything the app knows about the job is embedded
 * so the target model needs nothing but the user's resume.
 */
export function buildResumePrompt(app: Application): string {
  const source = SOURCE_LABEL[app.sourceSite] ?? titleCase(app.sourceSite)
  const meta = [
    `company: ${app.company}`,
    `role: ${app.roleTitle}`,
    app.seniority ? `seniority: ${app.seniority}` : null,
    app.location ? `location: ${app.location}` : null,
    app.employmentType ? `employment type: ${app.employmentType}` : null,
    app.workplaceType ? `workplace: ${app.workplaceType}` : null,
    `source: ${source}${app.url ? ` (${app.url})` : ''}`,
  ]
    .filter(Boolean)
    .map((l) => `  ${l}`)
    .join('\n')

  const hasExtraction = app.extracted

  const skillsBlock = hasExtraction
    ? `  <required_skills>${list(app.skills.required)}</required_skills>
  <preferred_skills>${list(app.skills.preferred)}</preferred_skills>
  <ats_keywords>${list(app.skills.industry)}</ats_keywords>`
    : `  <required_skills>Not pre-extracted — read them yourself from <full_text> before you start.</required_skills>`

  const notesBlock = hasExtraction
    ? `  <what_this_company_values>
${bullets(app.companyInsights)}
  </what_this_company_values>
  <notes_for_tailoring>
${bullets(app.tailoringTips)}
  </notes_for_tailoring>`
    : ''

  const responsibilities =
    hasExtraction && app.responsibilities.length
      ? `  <key_responsibilities>
${bullets(app.responsibilities)}
  </key_responsibilities>`
      : ''

  const summaryLine =
    hasExtraction && app.jdSummary ? `  <summary>${app.jdSummary}</summary>\n` : ''

  return `<role>
You are a senior technical resume strategist who spent years as an in-house recruiter and hiring manager. You know how ATS keyword matching works, how a busy reviewer skims a resume in 20 seconds, and how to reposition real experience so it maps cleanly to a specific job — without ever inflating it.
</role>

<context>
I am applying for the job described in <job>. I want to tailor my current resume to it before I submit.

My current resume — my "default" / master version — is in <resume>. Treat it as the single source of truth for my experience: everything in it is real, and nothing outside it is.

The <job> block already contains the parsed job description plus notes on the skills it asks for and what the company seems to value, so you have everything you need except my resume.
</context>

<job>
  <basics>
${meta}
  </basics>
${summaryLine}${responsibilities ? responsibilities + '\n' : ''}${skillsBlock}
${notesBlock ? notesBlock + '\n' : ''}  <full_text>
${app.jdText.trim()}
  </full_text>
</job>

<resume>
${RESUME_PLACEHOLDER}
</resume>

<task>
Do these two things, in this order:

1. FIT ANALYSIS — assess my current resume against this job exactly as it stands, before any edits.
2. LINE-BY-LINE TAILORING — give me the specific edits that make my resume match this job's skills, responsibilities and language.
</task>

<rules>
- Work only from what my resume actually says. Do not invent employers, job titles, dates, tools, projects, or metrics. The point of this exercise is to reposition true experience, not to manufacture qualifications — a fabricated resume fails the interview even if it passes the screen.
- Account for every item in <required_skills>, <preferred_skills> and <ats_keywords>. For each one, do exactly one of:
    (a) point to the specific resume bullet or line that already supports it — either directly, or indirectly through closely adjacent work;
    (b) if nothing supports it yet, propose the smallest truthful rewrite of an existing bullet that would; or
    (c) if I genuinely cannot back it up, name it as a real gap.
  Do not skip any skill, and do not merge several into one vague row.
- A skill may appear in my Skills or Summary section only if at least one bullet in Experience or Projects backs it up (directly or indirectly). Call out anything I would be claiming with no supporting evidence — that is the single biggest tell of a padded resume.
- Where my experience genuinely matches, mirror the job's own wording rather than my paraphrase (for example, use their "design controls" instead of my "regulated development process"). Where it does not match, do not adopt their wording.
- Keep every suggestion ATS-plain: standard section headings, no tables / columns / graphics inside the resume itself, one clear phrasing per bullet, active voice, real numbers where I have them.
- Preserve my voice and every truthful accomplishment. Reword and reorder; never water down.
- If the resume I paste is incomplete, truncated, or ambiguous, tell me what is missing and ask — do not guess to fill the hole. You are allowed to say "I can't assess this from what you gave me."
</rules>

<output_format>
Respond in this structure and nothing else. You may reason through the skill mapping first, but keep that out of the reply.

## 1. Fit analysis
- **Overall match:** Strong / Moderate / Stretch — one short paragraph on why.
- **Lead with these:** 3–5 strengths, each tied to a named requirement from the job.
- **Gaps & risks:** requirements I do not currently evidence, ordered most important first.

## 2. Skill coverage matrix
A markdown table with one row for every entry in <required_skills>, <preferred_skills> and <ats_keywords>:

| JD skill / keyword | Priority | Evidence in my resume (quote the bullet, or "none") | Action |
|---|---|---|---|

Priority = required / preferred / keyword. Action = keep as-is / reword bullet / add evidence to bullet / real gap.

## 3. Line-by-line changes
For each bullet you would change:

> **[Section] — [role / project]**
> BEFORE: <my current text>
> AFTER: <your proposed text>
> WHY: <which JD skill or phrase this now hits, and one line confirming it stays true to my resume>

Then:
- **Summary / headline:** a rewritten version aimed at this job.
- **Skills section:** my skills regrouped and reordered, most-relevant-to-this-job first, using the job's terminology where it truthfully applies.

## 4. Final checklist
Tick each, or explain why not:
- [ ] every required skill is either covered or explicitly flagged as a gap
- [ ] no new employer, title, date, tool, project, or metric was introduced
- [ ] every item in the tailored Skills section has a backing bullet
- [ ] the job's key phrases are mirrored everywhere my experience truthfully supports them
</output_format>`
}
