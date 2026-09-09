// Shared types used by both the Electron main process and the React renderer.

export type SourceSite =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'linkedin'
  | 'generic'

export type WorkplaceType = 'remote' | 'hybrid' | 'onsite'

export type EmploymentType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'internship'
  | 'temporary'

export type ApplicationStatus =
  | 'not-applied'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'ghosted'
  | 'withdrawn'

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'not-applied',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'ghosted',
  'withdrawn',
]

/** Status a freshly-added job starts in, until the user marks it applied. */
export const DEFAULT_STATUS: ApplicationStatus = 'not-applied'

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'temporary',
]

export const WORKPLACE_TYPES: WorkplaceType[] = ['remote', 'hybrid', 'onsite']

export const ACCENTS = [
  'pink',
  'yellow',
  'cyan',
  'blue',
  'lime',
  'coral',
  'purple',
] as const
export type Accent = (typeof ACCENTS)[number]

export type ExtractionModel = 'claude-haiku-4-5' | 'claude-sonnet-5'

// ---------- Network / referrals ----------

export type ContactRelationship =
  | 'close'
  | 'former-colleague'
  | 'acquaintance'
  | 'alum'
  | 'recruiter'
  | 'other'

export const CONTACT_RELATIONSHIPS: ContactRelationship[] = [
  'close',
  'former-colleague',
  'acquaintance',
  'alum',
  'recruiter',
  'other',
]

export interface ContactLink {
  label: string
  url: string
}

export interface Contact {
  id: string
  name: string
  email: string
  /** where they work — drives the automatic per-job match */
  company: string
  /** their role there */
  title: string
  relationship: ContactRelationship
  linkedinUrl: string
  links: ContactLink[]
  /** free text, e.g. "sensor team at Acme, 2019–2021" — used in the referral email */
  howYouKnow: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type NewContactInput = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>

export interface UserProfile {
  name: string
  email: string
  phone: string
  linkedinUrl: string
}

export const EMPTY_PROFILE: UserProfile = { name: '', email: '', phone: '', linkedinUrl: '' }

export interface Resume {
  id: string
  filename: string
  storedPath: string
  hash: string
  isPrimary: boolean
  addedAt: string
}

export interface ApplicationSkills {
  required: string[]
  preferred: string[]
  industry: string[]
}

export interface Application {
  id: string
  url: string
  sourceSite: SourceSite

  // deterministic parse (no LLM)
  company: string
  roleTitle: string
  location: string | null
  workplaceType: WorkplaceType | null
  employmentType: EmploymentType | null
  datePosted: string | null
  salaryRange: string | null
  jdText: string

  // user-set
  dateApplied: string
  status: ApplicationStatus
  accent: Accent
  tags: string[]
  notes: string
  /** contacts manually linked to this job (auto company-matches are derived, not stored) */
  contactIds: string[]

  // the one Claude call (empty until Extract is run; re-runnable)
  extracted: boolean
  extractionModel: ExtractionModel | null
  extractedAt: string | null
  seniority: string | null
  jdSummary: string
  responsibilities: string[]
  skills: ApplicationSkills
  companyInsights: string[]
  tailoringTips: string[]
  extractionRaw: unknown

  // attachments / bookkeeping
  resumes: Resume[]
  createdAt: string
  updatedAt: string
}

export interface TagDef {
  name: string
  color: string
}

export interface UsageTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  estimatedUsd: number
}

export interface Settings {
  extractionModel: ExtractionModel
  hasApiKey: boolean
  profile: UserProfile
}

export interface DBShape {
  version: number
  applications: Application[]
  contacts: Contact[]
  tags: TagDef[]
  usage: UsageTotals
  settings: { extractionModel: ExtractionModel; profile: UserProfile }
}

// ---------- Scrape / extraction wire types ----------

export interface ScrapedJob {
  url: string
  sourceSite: SourceSite
  company: string | null
  roleTitle: string | null
  location: string | null
  workplaceType: WorkplaceType | null
  employmentType: EmploymentType | null
  datePosted: string | null
  salaryRange: string | null
  jdText: string
  /** true when the scrape produced too little to trust — UI shows a manual-paste box */
  needsManualPaste: boolean
  /** short human note about what happened, shown in the UI */
  note: string
}

export interface ExtractionResult {
  seniority: string | null
  jdSummary: string
  responsibilities: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  industryKeywords: string[]
  companyInsights: string[]
  tailoringTips: string[]
  _raw: unknown
  _model: ExtractionModel
  _usage: { inputTokens: number; outputTokens: number; estimatedUsd: number }
}

/** Payload the renderer sends to create an application (post-review-form). */
export interface NewApplicationInput {
  url: string
  sourceSite: SourceSite
  company: string
  roleTitle: string
  location: string | null
  workplaceType: WorkplaceType | null
  employmentType: EmploymentType | null
  datePosted: string | null
  salaryRange: string | null
  jdText: string
  dateApplied: string
  status: ApplicationStatus
  tags: string[]
  notes: string
  contactIds?: string[]
  /** when present, the app was extracted during the add flow */
  extraction: ExtractionResult | null
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}
