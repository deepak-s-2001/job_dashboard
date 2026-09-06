import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionModel, ExtractionResult } from '@shared/types'
import { getApiKey } from './secrets'
import { getModel, addUsage } from './store'

/** USD per 1M tokens, [input, output]. */
const PRICING: Record<ExtractionModel, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [2, 10],
}

const MAX_JD_CHARS = 24_000 // ~6k tokens; JD text is already clean coming in

const SYSTEM_PROMPT = `You read one job description and pull out what's useful for tailoring a resume to it. Work ONLY from the text provided — never invent facts about the company or role that the text does not support.

Rules:
- Skills: short strings exactly as they'd read on a resume ("Python", "CI/CD", "stakeholder management", "FDA 21 CFR Part 11"). Deduplicate near-identical mentions. Exclude generic filler ("team player", "fast-paced environment", "excellent communication") unless it names a concrete methodology or domain skill. Order each list by how prominently the JD emphasizes it, most important first.
- required vs preferred: split by the JD's own framing ("required", "must have" vs "nice to have", "bonus", "preferred"). If the JD doesn't distinguish, put everything in required.
- industryKeywords: the domain/ATS terms a strong resume for THIS role would mirror — industry, product area, standards, certifications, buzzwords — even if not framed as a "skill".
- companyInsights: concrete, text-grounded things worth knowing when writing the resume — product area, company stage/size signals, tech stack, the kind of work, what they clearly value, tone. 3-7 full sentences. No fluff, no guessing beyond the text.
- tailoringTips: specific, actionable phrasing/emphasis moves for a resume aimed at this JD ("lead with the medical-device validation work", "mirror their 'design controls' language", "quantify test-coverage numbers"). 3-6 full sentences.
- In companyInsights and tailoringTips ONLY, wrap the single most important phrase of each sentence (the part the reader must not miss — a keyword, a number, a name, the actionable verb phrase) in ==double equals==. One marked span per sentence, occasionally two; never mark a whole sentence.
- seniority: your read of the level from the text ("entry-level", "mid", "senior", "staff", "lead / manager"), or null if genuinely unclear.
- jdSummary: 2-3 plain sentences on what this role is.
- responsibilities: the core duties, lightly normalized, from the JD.`

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    seniority: { type: ['string', 'null'] as const },
    jdSummary: { type: 'string' as const },
    responsibilities: { type: 'array' as const, items: { type: 'string' as const } },
    requiredSkills: { type: 'array' as const, items: { type: 'string' as const } },
    preferredSkills: { type: 'array' as const, items: { type: 'string' as const } },
    industryKeywords: { type: 'array' as const, items: { type: 'string' as const } },
    companyInsights: { type: 'array' as const, items: { type: 'string' as const } },
    tailoringTips: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: [
    'seniority',
    'jdSummary',
    'responsibilities',
    'requiredSkills',
    'preferredSkills',
    'industryKeywords',
    'companyInsights',
    'tailoringTips',
  ],
  additionalProperties: false,
}

export class ExtractionError extends Error {}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}

export async function extractJd(params: {
  company: string
  roleTitle: string
  jdText: string
  modelOverride?: ExtractionModel
}): Promise<ExtractionResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new ExtractionError('No Anthropic API key set. Add one in Settings.')
  }

  const jd = params.jdText.trim()
  if (jd.length < 60) {
    throw new ExtractionError('The job description is too short to extract anything useful.')
  }

  const model = params.modelOverride ?? getModel()
  const client = new Anthropic({ apiKey })

  const truncated = jd.length > MAX_JD_CHARS
  const body = truncated ? jd.slice(0, MAX_JD_CHARS) + '\n\n[...truncated]' : jd

  const userContent = [
    `Company: ${params.company || '(unknown)'}`,
    `Role title: ${params.roleTitle || '(unknown)'}`,
    '',
    'Job description:',
    body,
  ].join('\n')

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'save_extraction',
          description: 'Record the structured extraction of this job description.',
          strict: true,
          input_schema: TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'save_extraction' },
      messages: [{ role: 'user', content: userContent }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new ExtractionError(`Anthropic request failed: ${msg}`)
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) {
    throw new ExtractionError('The model did not return a structured result. Try again.')
  }

  const raw = toolBlock.input as Record<string, unknown>

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const [inPrice, outPrice] = PRICING[model]
  const estimatedUsd =
    (inputTokens / 1_000_000) * inPrice + (outputTokens / 1_000_000) * outPrice
  await addUsage(inputTokens, outputTokens, estimatedUsd)

  return {
    seniority:
      raw.seniority === null || raw.seniority === undefined
        ? null
        : String(raw.seniority).trim() || null,
    jdSummary: String(raw.jdSummary ?? '').trim(),
    responsibilities: asStringArray(raw.responsibilities),
    requiredSkills: asStringArray(raw.requiredSkills),
    preferredSkills: asStringArray(raw.preferredSkills),
    industryKeywords: asStringArray(raw.industryKeywords),
    companyInsights: asStringArray(raw.companyInsights),
    tailoringTips: asStringArray(raw.tailoringTips),
    _raw: raw,
    _model: model,
    _usage: { inputTokens, outputTokens, estimatedUsd },
  }
}

/** Lightweight key check — a tiny request that fails fast on a bad key. */
export async function testApiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new Anthropic({ apiKey: key.trim() })
    await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
