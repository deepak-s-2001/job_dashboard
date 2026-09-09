import type { Application, Contact, ContactRelationship, UserProfile } from '@shared/types'
import { stripMarkers } from '@/components/Highlighted'

export interface ReferralEmail {
  subject: string
  body: string
  mailto: string
}

function firstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || 'there'
}

function jobLine(app: Application): string {
  const bits = [app.roleTitle, app.company && `at ${app.company}`].filter(Boolean).join(' ')
  return app.url ? `${bits}\n${app.url}` : bits
}

/** One honest line about fit, from the extraction when we have it. */
function fitLine(app: Application): string {
  if (app.extracted) {
    const top = app.skills.required.slice(0, 3).map(stripMarkers).filter(Boolean)
    if (top.length) {
      const skills =
        top.length === 1
          ? top[0]
          : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`
      return `On paper it's a close match — the role leans on ${skills}, which is core to what I've been doing. [Add a specific win or two from your resume that maps here.]`
    }
  }
  return '[One or two lines on why this is a strong fit — pull the most relevant wins straight from your resume.]'
}

/** The user's own "how you know them" text, cleaned — or '' if they left it blank. */
function context(contact: Contact): string {
  return contact.howYouKnow.trim().replace(/[.!]+$/, '')
}

/** The ask paragraph — the part that changes by relationship. */
function askParagraph(rel: ContactRelationship, company: string): string {
  const co = company || 'the company'
  switch (rel) {
    case 'close':
      return `Would you be up for referring me through ${co}'s internal system? Even a quick note to the hiring manager flagging my application would mean a lot.`
    case 'former-colleague':
      return `Given we worked together, would you be comfortable putting in a referral through ${co}'s internal system? Happy to send anything that makes it easy — a short blurb, my resume, whatever helps.`
    case 'acquaintance':
      return `I know we only overlapped briefly, so genuinely no pressure — but if you'd be comfortable submitting a referral, or just pointing me to the right person on the team, that would be a real help.`
    case 'alum':
      return `Would you be open to either a quick referral, or 15 minutes to tell me what the team is actually like? Either one would be genuinely useful — whichever is easier for you.`
    case 'recruiter':
      return `I wanted to raise my hand for this one directly. My resume is attached — happy to fill in anything or apply through whatever channel you prefer.`
    default:
      return `Would you be open to referring me for it, or introducing me to someone on the team? Totally understand if that's not something you can do.`
  }
}

function signOff(profile: UserProfile): string {
  const lines = [
    profile.name.trim() || '[Your name]',
    profile.email.trim(),
    profile.phone.trim(),
    profile.linkedinUrl.trim(),
  ].filter(Boolean)
  return `Thanks so much,\n${lines.join('\n')}`
}

function opener(rel: ContactRelationship, n: string): string {
  switch (rel) {
    case 'former-colleague':
      return `Hi ${n},\n\nHope you're doing well — it's been too long.`
    case 'acquaintance':
      return `Hi ${n},\n\nIt's been a while — hope things are going well on your end.`
    case 'alum':
      return `Hi ${n},\n\nWe haven't met — I'm reaching out because [the connection: same school, a former employer, a mutual contact].`
    default:
      return `Hi ${n},`
  }
}

export function buildReferralEmail(
  contact: Contact,
  app: Application,
  profile: UserProfile,
): ReferralEmail {
  const n = firstName(contact.name)
  const co = app.company || 'your company'
  const role = app.roleTitle || 'a role'
  const rel = contact.relationship

  const subject = `Referral request — ${role}${app.company ? ` at ${app.company}` : ''}`

  const ctx = context(contact)
  const ctxSentence = ctx ? ` ${ctx.charAt(0).toUpperCase() + ctx.slice(1)}.` : ''
  const secondPara =
    rel === 'recruiter'
      ? `I'm applying for ${role}${app.company ? ` at ${co}` : ''}, and I saw you recruit for ${co}.${ctxSentence}`
      : `I'm applying for ${role}${app.company ? ` at ${co}` : ''}, and I saw you're there.${ctxSentence}`

  const paras = [
    opener(rel, n),
    secondPara,
    `Here's the posting:\n${jobLine(app)}`,
    fitLine(app),
    askParagraph(rel, app.company),
    `If this isn't something you can do right now, absolutely no worries — I know these asks add up. Either way, thank you.`,
    signOff(profile),
  ]
  const body = paras.join('\n\n')

  const mailto = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`

  return { subject, body, mailto }
}
