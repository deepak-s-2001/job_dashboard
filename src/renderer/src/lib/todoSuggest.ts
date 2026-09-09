import type { Application, ApplicationStatus } from '@shared/types'

/** Status-aware next steps. `{company}` is templated at render time. */
export const TODO_SUGGESTIONS: Record<ApplicationStatus, string[]> = {
  'not-applied': [
    'Tailor my resume for this role',
    'Write a short cover note',
    'Find a referral at {company}',
    'Apply',
  ],
  applied: [
    'Follow up in a week',
    'Connect with someone at {company} on LinkedIn',
    'Find a referral at {company}',
  ],
  interviewing: [
    'Prep for the interview',
    'Research the team & product',
    'Prepare questions to ask them',
    'Send a thank-you note after',
  ],
  offer: [
    'Compare against my other options',
    'Ask about start date & comp details',
    'Decide by the deadline',
  ],
  rejected: ['Ask for feedback', 'Note what to do differently next time'],
  ghosted: ['Send one more follow-up', 'Move on'],
  withdrawn: [],
}

/** Suggestions for a job, minus anything already on its list (case-insensitive). */
export function suggestionsFor(app: Application, existingTexts: string[]): string[] {
  const have = new Set(existingTexts.map((t) => t.trim().toLowerCase()))
  return TODO_SUGGESTIONS[app.status]
    .map((s) => s.replace('{company}', app.company || 'the company'))
    .filter((s) => !have.has(s.toLowerCase()))
}
