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

/** One status transition. Oldest → newest; the last entry's status === app.status. */
export interface StatusEvent {
  status: ApplicationStatus
  at: string
}

// ---------- Interviews ----------

export type InterviewFormat = 'phone' | 'video' | 'onsite' | 'take-home' | 'panel' | 'other'
export type InterviewOutcome = 'scheduled' | 'passed' | 'failed' | 'cancelled' | 'no-show'

export const INTERVIEW_FORMATS: InterviewFormat[] = [
  'phone',
  'video',
  'onsite',
  'take-home',
  'panel',
  'other',
]
export const INTERVIEW_OUTCOMES: InterviewOutcome[] = [
  'scheduled',
  'passed',
  'failed',
  'cancelled',
  'no-show',
]
export const INTERVIEW_ROUND_PRESETS = [
  'Recruiter screen',
  'Phone screen',
  'Technical',
  'Hiring manager',
  'Onsite',
  'System design',
  'Behavioral',
  'Final',
]

export interface Interview {
  id: string
  round: string
  /** ISO datetime — has a time-of-day, unlike Todo.dueDate */
  at: string | null
  format: InterviewFormat | null
  withWhom: string
  prepNotes: string
  outcome: InterviewOutcome
  createdAt: string
  updatedAt: string
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
  /** every status this job has been through, maintained by the store */
  statusHistory: StatusEvent[]
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

  // interview stage
  interviews: Interview[]
  offerDeadline: string | null // 'YYYY-MM-DD'

  // attachments / bookkeeping
  resumes: Resume[]
  /** set = hidden from the board; still counts in all-time metrics */
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TagDef {
  name: string
  color: string
}

// ---------- To-dos ----------

export interface Todo {
  id: string
  text: string
  done: boolean
  doneAt: string | null
  /** null = standalone; otherwise the job this task belongs to */
  applicationId: string | null
  /** 'YYYY-MM-DD' or null */
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface NewTodoInput {
  text: string
  applicationId?: string | null
  dueDate?: string | null
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
  todos: Todo[]
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
