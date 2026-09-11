import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionModel, TailoredExperienceEntry, TailoredResume } from '@shared/types'
import { getApiKey } from './secrets'
import { getModel, addUsage } from './store'
import { asStringArray, asStrOrNull } from './aiHelpers'

/** USD per 1M tokens, [input, output] — same pricing table as extract.ts. */
const PRICING: Record<ExtractionModel, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [2, 10],
}

const MAX_RESUME_CHARS = 20_000 // a resume is at most ~2 pages; this is generous headroom

const SYSTEM_PROMPT = `You read the plain text extracted from one resume PDF and structure it for reuse — this text is about to be typed into real job applications, so accuracy matters more than tidiness.

Rules:
- Work only from the text given. Never invent a company, title, date, bullet, or skill that isn't in it. Never paraphrase a bullet's wording — copy it as written (fix only obvious PDF-extraction artifacts: a stray line break mid-sentence, a duplicated word from column-interleaving). If a bullet's meaning is genuinely garbled by extraction, drop it rather than guess what it originally said.
- headline: the line that names the target role, usually right under the person's name near the top — often in the form "Title | Theme | Theme". Extract it verbatim if present. If genuinely absent, do not invent one — use the most recent role's title instead.
- summary: a short paragraph near the top describing the person, if the resume has one. null if it doesn't — do not write one yourself.
- skills: every skill listed in a Skills/Technologies/Technical section, as separate short strings, in the order the resume lists them.
- experience: one entry per job, oldest-listed-fields aside — in the same order the resume presents them (usually most recent first). company and roleTitle exactly as written. bullets: every bullet under that role, verbatim, in original order. A role with no bullets (e.g. a single-line entry) gets an empty bullets array — do not fabricate content to fill it.
- If the extracted text looks scrambled by a multi-column layout (fragments from two different sections interleaved on one line), do your best to reassign each fragment to the section it actually belongs to based on content, but if you cannot tell, leave it out rather than attach it to the wrong role — this output gets reviewed and corrected by the person before it's used, so a gap is safer than a wrong attribution.`

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    headline: { type: 'string' as const },
    summary: { type: ['string', 'null'] as const },
    skills: { type: 'array' as const, items: { type: 'string' as const } },
    experience: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          company: { type: 'string' as const },
          roleTitle: { type: 'string' as const },
          bullets: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['company', 'roleTitle', 'bullets'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'summary', 'skills', 'experience'],
  additionalProperties: false,
}

export class TailoredResumeError extends Error {}

function asExperience(v: unknown): TailoredExperienceEntry[] {
  if (!Array.isArray(v)) return []
  return v
    .map((e) => {
      if (!e || typeof e !== 'object') return null
      const o = e as Record<string, unknown>
      const company = asStrOrNull(o.company)
      const roleTitle = asStrOrNull(o.roleTitle)
      if (!company || !roleTitle) return null
      return { company, roleTitle, bullets: asStringArray(o.bullets) }
    })
    .filter((e): e is TailoredExperienceEntry => e !== null)
}

export async function parseTailoredResume(
  resumeText: string,
  modelOverride?: ExtractionModel,
): Promise<TailoredResume & { _model: ExtractionModel }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new TailoredResumeError('No Anthropic API key set. Add one in Settings.')
  }

  const text = resumeText.trim()
  if (text.length < 60) {
    throw new TailoredResumeError('Could not read enough text from that PDF to parse.')
  }

  const model = modelOverride ?? getModel()
  const client = new Anthropic({ apiKey })

  const truncated = text.length > MAX_RESUME_CHARS
  const body = truncated ? text.slice(0, MAX_RESUME_CHARS) + '\n\n[...truncated]' : text

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'save_tailored_resume',
          description: 'Record the structured resume content.',
          strict: true,
          input_schema: TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'save_tailored_resume' },
      messages: [{ role: 'user', content: `Resume text (extracted from a PDF):\n\n${body}` }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new TailoredResumeError(`Anthropic request failed: ${msg}`)
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) {
    throw new TailoredResumeError('The model did not return a structured result. Try again.')
  }

  const raw = toolBlock.input as Record<string, unknown>

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const [inPrice, outPrice] = PRICING[model]
  const estimatedUsd =
    (inputTokens / 1_000_000) * inPrice + (outputTokens / 1_000_000) * outPrice
  await addUsage(inputTokens, outputTokens, estimatedUsd)

  return {
    headline: asStrOrNull(raw.headline) ?? '',
    summary: asStrOrNull(raw.summary),
    skills: asStringArray(raw.skills),
    experience: asExperience(raw.experience),
    _model: model,
  }
}
